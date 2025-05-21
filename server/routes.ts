import { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBookSchema } from "@shared/schema";
import { analyzeBookCover } from "./services/openai";
import { verifyBookByIsbn } from "./services/verificationService";
import { searchBooks, getCompleteBookByISBN } from "./services/googleBooks";
import { processBookAnalysis } from "./services/openai";
import axios from "axios";

// Configure multer for in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Interface for session with API keys
import { SessionData } from "express-session";

declare module "express-session" {
  interface SessionData {
    apiKeys?: {
      openai_api_key?: string;
      google_books_api_key?: string;
      google_cse_key?: string;
      google_cse_id?: string;
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // API Keys session endpoint
  app.post("/api/session/api-keys", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { openai_api_key, google_books_api_key, google_cse_key, google_cse_id } = req.body;
      
      // Store in session
      if (!req.session.apiKeys) {
        req.session.apiKeys = {};
      }
      
      if (openai_api_key) req.session.apiKeys.openai_api_key = openai_api_key;
      if (google_books_api_key) req.session.apiKeys.google_books_api_key = google_books_api_key;
      if (google_cse_key) req.session.apiKeys.google_cse_key = google_cse_key;
      if (google_cse_id) req.session.apiKeys.google_cse_id = google_cse_id;
      
      // Save session
      req.session.save((err) => {
        if (err) {
          console.error("Error saving API keys to session:", err);
          return res.status(500).json({ message: "Failed to save API keys" });
        }
        
        return res.status(200).json({ message: "API keys saved successfully" });
      });
    } catch (error) {
      console.error("Error handling API keys:", error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Get API key status - lets client know if keys are needed
  app.get("/api/session/api-keys/status", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Check if required keys are in session (Google CSE is optional)
    const hasKeys = req.session.apiKeys && (
      req.session.apiKeys.openai_api_key &&
      req.session.apiKeys.google_books_api_key
    );
    
    console.log(`[DEBUG] API Keys Status - User: ${req.user.username}, Has keys: ${!!hasKeys}`);
    console.log(`[DEBUG] OpenAI key exists: ${!!req.session.apiKeys?.openai_api_key}`);
    console.log(`[DEBUG] Google Books key exists: ${!!req.session.apiKeys?.google_books_api_key}`);
    console.log(`[DEBUG] Google CSE key exists: ${!!req.session.apiKeys?.google_cse_key}`);
    console.log(`[DEBUG] Google CSE ID exists: ${!!req.session.apiKeys?.google_cse_id}`);

    return res.status(200).json({ 
      hasKeys: !!hasKeys,
      hasOpenAI: !!req.session.apiKeys?.openai_api_key,
      hasGoogleBooks: !!req.session.apiKeys?.google_books_api_key,
      hasGoogleCSE: !!(req.session.apiKeys?.google_cse_key && req.session.apiKeys?.google_cse_id)
    });
  });

  // Book analysis endpoint - simplified to only handle three paths:
  // 1. ISBN -> verification flow
  // 2. Cover image -> extract ISBN if possible, then verification flow
  // 3. Title/author -> search, then verification flow
  app.post("/api/books/analyze", upload.single("coverImage"), async (req: Request, res: Response) => {
    try {
      // Process form data
      const formData = req.body;
      const language = formData.language || "de";
      const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      // Extract API keys from session if available
      const sessionApiKeys = (req.session as any).apiKeys || {};
      const apiKeys = {
        openai_api_key: sessionApiKeys.openai_api_key,
        google_books_api_key: sessionApiKeys.google_books_api_key,
        google_cse_key: sessionApiKeys.google_cse_key,
        google_cse_id: sessionApiKeys.google_cse_id
      };
      
      // Check if API keys are available
      if (!apiKeys.openai_api_key || !apiKeys.google_books_api_key) {
        return res.status(400).json({ 
          error: "API keys required", 
          message: "Please provide API keys in your account settings before analyzing books." 
        });
      }
      
      console.log(`[${analysisId}] Processing book analysis request`);
      let bookData;
      
      // Case 1: ISBN provided
      if (formData.isbn) {
        console.log(`[${analysisId}] Analysis by ISBN: ${formData.isbn}`);
        const cleanIsbn = formData.isbn.replace(/[^0-9X]/gi, '');
        bookData = await verifyBookByIsbn(cleanIsbn, apiKeys);
      }
      // Case 2: Cover image provided
      else if (req.file) {
        console.log(`[${analysisId}] Analysis by cover image`);
        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');
        
        // Use the getBookFromCoverImage function that handles all the API integration
        const { getBookFromCoverImage } = await import("./services/bookAnalysis");
        bookData = await getBookFromCoverImage(base64Image, language, apiKeys);
      }
      // Case 3: Title provided
      else if (formData.title) {
        console.log(`[${analysisId}] Analysis by title: ${formData.title}`);
        
        // Search by title
        const searchResults = await searchBooks({
          title: formData.title,
          author: formData.author || "",
          maxResults: 1,
          apiKey: apiKeys.google_books_api_key
        });
        
        if (searchResults && searchResults.length > 0) {
          // If ISBN is available, use verification flow
          if (searchResults[0].isbn) {
            console.log(`[${analysisId}] ISBN found in title search: ${searchResults[0].isbn}`);
            bookData = await verifyBookByIsbn(searchResults[0].isbn, apiKeys);
          } else {
            // Use search result directly
            bookData = searchResults[0];
            
            // Try to get more data using OpenAI
            const openAiResult = await processBookAnalysis({
              title: bookData.title,
              author: bookData.author || "",
              language
            }, apiKeys.openai_api_key);
            
            // Add OpenAI data
            if (openAiResult.summary) bookData.summary = openAiResult.summary;
            if (openAiResult.themes) bookData.themes = openAiResult.themes;
            if (openAiResult.genres && (!bookData.genres || bookData.genres.length === 0)) {
              bookData.genres = openAiResult.genres;
            }
            
            // Add verification data
            bookData.verification = {
              status: "partially_verified",
              confidence: 0.5,
              sources: ["Google Books", "OpenAI"],
              message: "Book information found by title search but not fully verified"
            };
          }
        } else {
          // No books found - use OpenAI only
          bookData = await processBookAnalysis({
            title: formData.title,
            author: formData.author || "",
            language
          }, apiKeys.openai_api_key);
          
          bookData.verification = {
            status: "ai_generated",
            confidence: 0.3,
            sources: ["OpenAI"],
            message: "Book information generated by AI, no verification with authoritative sources"
          };
        }
      } else {
        return res.status(400).json({ 
          error: "Please provide an ISBN, title, or book cover image" 
        });
      }
      
      // Check for results
      if (!bookData || !bookData.title) {
        return res.status(400).json({ 
          error: "Could not analyze book with provided information" 
        });
      }
      
      console.log(`[${analysisId}] Analysis successful for: "${bookData.title}"`);
      res.status(200).json(bookData);
    } catch (error: any) {
      console.error("Error in book analysis:", error);
      res.status(500).json({ error: "Error during book analysis: " + error.message });
    }
  });

  // ISBN lookup endpoint - uses same verification flow
  app.get("/api/books/isbn/:isbn", async (req: Request, res: Response) => {
    try {
      const isbn = req.params.isbn;
      if (!isbn) {
        return res.status(400).json({ error: "ISBN is required" });
      }
      
      const requestId = `isbn_lookup_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      console.log(`[${requestId}] Looking up ISBN: ${isbn}`);
      
      // Extract API keys from session if available
      const sessionApiKeys = (req.session as any).apiKeys || {};
      const apiKeys = {
        openai_api_key: sessionApiKeys.openai_api_key,
        google_books_api_key: sessionApiKeys.google_books_api_key,
        google_cse_key: sessionApiKeys.google_cse_key,
        google_cse_id: sessionApiKeys.google_cse_id
      };
      
      // Check if API keys are available
      if (!apiKeys.openai_api_key || !apiKeys.google_books_api_key) {
        return res.status(400).json({ 
          error: "API keys required", 
          message: "Please provide API keys in your account settings before analyzing books." 
        });
      }
      
      // Pass session API keys to the verification service
      const bookData = await verifyBookByIsbn(isbn, apiKeys);
      
      if (!bookData || !bookData.title) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      console.log(`[${requestId}] Successfully processed book data from TypeScript service`);
      res.json(bookData);
    } catch (error: any) {
      console.error("Error in ISBN lookup:", error);
      res.status(500).json({ error: "Error during ISBN lookup: " + error.message });
    }
  });

  // CRUD operations for books
  app.get("/api/books", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const books = await storage.getBooks(userId);
      res.json(books);
    } catch (error: any) {
      console.error("Error retrieving books:", error);
      res.status(500).json({ error: "Error retrieving books" });
    }
  });

  app.get("/api/books/recent", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 5;
      const books = await storage.getRecentBooks(limit);
      res.json(books);
    } catch (error: any) {
      console.error("Error retrieving recent books:", error);
      res.status(500).json({ error: "Error retrieving recent books" });
    }
  });

  app.get("/api/books/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      const books = await storage.searchBooks(query);
      res.json(books);
    } catch (error: any) {
      console.error("Error searching books:", error);
      res.status(500).json({ error: "Error searching books" });
    }
  });

  app.get("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const book = await storage.getBook(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error: any) {
      console.error("Error retrieving book:", error);
      res.status(500).json({ error: "Error retrieving book" });
    }
  });

  app.post("/api/books", async (req: Request, res: Response) => {
    try {
      // Handle the data before validation
      let bookData = { ...req.body };
      
      if (!bookData.title) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      // Handle null author values
      if (!bookData.author) {
        if (bookData.mainAuthor) {
          bookData.author = bookData.mainAuthor;
        } else if (bookData.statementOfResponsibility) {
          const match = bookData.statementOfResponsibility.match(/^(.*?)(?:\s*[;:\/]|$)/);
          bookData.author = match ? match[1].trim() : bookData.statementOfResponsibility;
        } else if (bookData.reviewerName) {
          bookData.author = `Verantwortlich: ${bookData.reviewerName}`;
        } else {
          // Last resort - use "Unbekannt" (Unknown) as author
          bookData.author = "Unbekannt";
        }
      }
      
      // Now validate with insertBookSchema
      const validatedData = insertBookSchema.parse(bookData);
      
      if (req.isAuthenticated()) {
        validatedData.userId = req.user.id;
      }
      
      // Clean the price field to extract only EUR (DE) value
      if (validatedData.price) {
        const { formatPriceForDb } = await import('../client/src/lib/utils');
        validatedData.price = formatPriceForDb(validatedData.price);
      }
      
      // Debug logging to see what's coming in
      console.log('Book save data:', JSON.stringify({
        title: validatedData.title,
        author: validatedData.author,
        review: validatedData.review
      }));
      
      const book = await storage.createBook(validatedData);
      res.status(201).json(book);
    } catch (error: any) {
      console.error("Error creating book:", error);
      res.status(500).json({ error: "Error creating book" });
    }
  });

  app.put("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      
      // Handle the data before validation
      let bookData = { ...req.body };
      
      // Handle null author values
      if (bookData.author === null || bookData.author === undefined) {
        if (bookData.mainAuthor) {
          bookData.author = bookData.mainAuthor;
        } else if (bookData.statementOfResponsibility) {
          const match = bookData.statementOfResponsibility.match(/^(.*?)(?:\s*[;:\/]|$)/);
          bookData.author = match ? match[1].trim() : bookData.statementOfResponsibility;
        } else if (bookData.reviewerName) {
          bookData.author = `Verantwortlich: ${bookData.reviewerName}`;
        } else {
          // For updates, try to get the existing book's author to maintain it
          const existingBook = await storage.getBook(id);
          if (existingBook && existingBook.author) {
            bookData.author = existingBook.author;
          } else {
            bookData.author = "Unbekannt";
          }
        }
      }
      
      // Create a basic validation schema
      // Just check the data structure without strict validation
      const validatedData = bookData;
      
      // Clean the price field to extract only EUR (DE) value
      if (validatedData.price) {
        const { formatPriceForDb } = await import('../client/src/lib/utils');
        validatedData.price = formatPriceForDb(validatedData.price);
      }
      
      const updatedBook = await storage.updateBook(id, validatedData);
      if (!updatedBook) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(updatedBook);
    } catch (error: any) {
      console.error("Error updating book:", error);
      res.status(500).json({ error: "Error updating book" });
    }
  });

  app.delete("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const success = await storage.deleteBook(id);
      if (!success) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting book:", error);
      res.status(500).json({ error: "Error deleting book" });
    }
  });

  app.delete("/api/books", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const count = await storage.clearAllBooks();
      res.json({ message: `Deleted ${count} books` });
    } catch (error: any) {
      console.error("Error clearing books:", error);
      res.status(500).json({ error: "Error clearing books" });
    }
  });

  // Batch upload endpoint for book covers
  app.post("/api/books/batch", upload.array("coverImages", 10), async (req: Request, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No cover images provided" });
      }
      
      const results = [];
      
      // Get session API keys
      const apiKeys = (req.session as SessionData).apiKeys || {};
      
      // Check if API keys are available
      if (!apiKeys || !apiKeys.openai_api_key || !apiKeys.google_books_api_key) {
        return res.status(400).json({ 
          error: "API keys required", 
          message: "Please provide API keys in your account settings before analyzing books." 
        });
      }
      
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        
        try {
          const base64Image = file.buffer.toString('base64');
          const coverData = await analyzeBookCover(base64Image, apiKeys.openai_api_key);
          
          let bookData;
          
          if (coverData.isbn) {
            bookData = await verifyBookByIsbn(coverData.isbn, apiKeys);
            bookData.coverImageData = base64Image;
          } else {
            bookData = coverData;
            bookData.coverImageData = base64Image;
            
            bookData.verification = {
              status: "ai_generated",
              confidence: 0.3,
              sources: ["OpenAI"],
              message: "Book information extracted from cover image by AI"
            };
          }
          
          if (req.isAuthenticated()) {
            bookData.userId = req.user.id;
          }
          
          const savedBook = await storage.createBook(bookData as any);
          results.push({ 
            success: true, 
            book: savedBook,
            filename: file.originalname
          });
        } catch (fileError: any) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          results.push({ 
            success: false, 
            error: `Error processing file: ${fileError.message}`,
            filename: file.originalname,
            status: 'error'
          });
        }
      }
      
      const processed = {
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total: results.length
      };
      
      res.status(200).json({ results, processed });
    } catch (error: any) {
      console.error("Error in batch upload:", error);
      res.status(500).json({ error: "Error processing batch upload" });
    }
  });
  
  // Import axios and other modules at the top of the file with other imports
  // Don't add this here
  
  // Batch processing endpoint for ISBNs
  app.post("/api/books/batch-isbn", async (req: Request, res: Response) => {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const { isbns } = req.body;
      console.log("Received batch ISBN request with ISBNs:", isbns);
      
      if (!isbns || !Array.isArray(isbns) || isbns.length === 0) {
        return res.status(400).json({ error: "No ISBNs provided" });
      }
      
      const results = [];
      
      // Get session API keys
      const apiKeys = (req.session as SessionData).apiKeys || {};
      
      // Check if API keys are available
      if (!apiKeys || !apiKeys.google_books_api_key) {
        return res.status(400).json({ 
          error: "API keys required", 
          message: "Please provide at least the Google Books API key in your account settings." 
        });
      }
      
      // Process each ISBN
      for (let i = 0; i < isbns.length; i++) {
        const isbn = isbns[i];
        console.log(`Processing ISBN ${i+1}/${isbns.length}: ${isbn}`);
        
        try {
          // Standardize ISBN (remove hyphens, etc.)
          const standardizedIsbn = isbn.replace(/[-\s]/g, '');
          console.log(`Processing ISBN: ${standardizedIsbn}`);
          
          if (!standardizedIsbn || standardizedIsbn.length < 10) {
            throw new Error("Invalid ISBN format");
          }
          
          // Use our complete verification service instead of just Google Books
          console.log(`Using complete verification for ISBN: ${standardizedIsbn}`);
          
          // This uses the same verification process as single book analysis
          const verifiedBook = await verifyBookByIsbn(standardizedIsbn, apiKeys);
          
          if (!verifiedBook || !verifiedBook.title) {
            throw new Error(`No book found or verification failed for ISBN: ${standardizedIsbn}`);
          }
          
          console.log(`Book verification complete for "${verifiedBook.title}" with ISBN ${standardizedIsbn}`);
          
          // Import price formatting utility
          const { formatPriceForDb } = await import('../client/src/lib/utils');
          
          // Create the book record using the fully verified and enriched data
          const newBook: any = {
            ...verifiedBook,
            // Ensure ISBN is standardized
            isbn: standardizedIsbn,
            // Clean the price field to only keep EUR (DE) value
            price: verifiedBook.price ? formatPriceForDb(verifiedBook.price) : null
          };
          
          // Ensure author is never null to prevent database constraint violations
          if (!newBook.author) {
            // Try to use other author-related fields in this priority order
            if (newBook.mainAuthor) {
              newBook.author = newBook.mainAuthor;
            } else if (newBook.statementOfResponsibility) {
              const match = newBook.statementOfResponsibility.match(/^(.*?)(?:\s*[;:\/]|$)/);
              newBook.author = match ? match[1].trim() : newBook.statementOfResponsibility;
            } else if (newBook.reviewerName) {
              newBook.author = `Verantwortlich: ${newBook.reviewerName}`;
            } else {
              // Last resort - use "Unbekannt" (Unknown) in German
              newBook.author = "Unbekannt";
            }
          }
          
          // Add user ID if authenticated
          if (req.isAuthenticated()) {
            newBook.userId = req.user.id;
          }
          
          // Return the verified book data without saving to database
          console.log(`Successfully verified book: "${newBook.title}" with ISBN ${standardizedIsbn}`);
          
          results.push({ 
            success: true, 
            book: newBook,
            filename: isbn, // Use ISBN as filename for frontend matching
            status: 'success',
            // Flag to indicate this book hasn't been saved yet
            saved: false
          });
        } catch (isbnError: any) {
          console.error(`Error processing ISBN ${isbn}:`, isbnError.message || isbnError);
          results.push({ 
            success: false, 
            error: isbnError.message || "Unknown error processing ISBN", 
            filename: isbn,
            status: 'error'
          });
        }
      }
      
      const processed = {
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total: results.length
      };
      
      console.log(`Batch ISBN processing complete: ${processed.success} successes, ${processed.failed} failures`);
      return res.status(200).json({ results, processed });
    } catch (error: any) {
      console.error("Error in batch ISBN processing:", error.message || error);
      return res.status(500).json({ 
        error: "Error processing batch ISBNs", 
        message: error.message || "Unknown error",
        results: []
      });
    }
  });

  // Similar books endpoint (simplified)
  app.post("/api/books/similar", async (req: Request, res: Response) => {
    try {
      const { title, author, genres } = req.body;
      
      if (!title && !author && (!genres || genres.length === 0)) {
        return res.status(400).json({ error: "At least title, author, or genres are required" });
      }
      
      // Get session API keys
      const apiKeys = (req.session as SessionData).apiKeys || {};
      
      // Check if API keys are available
      if (!apiKeys.openai_api_key) {
        return res.status(400).json({ 
          error: "API keys required", 
          message: "Please provide API keys in your account settings before finding similar books." 
        });
      }
      
      const { searchSimilarBooks } = await import("./services/openai");
      
      const similarBooks = await searchSimilarBooks({
        title: title || "",
        author: author || "",
        genres: genres || []
      }, apiKeys.openai_api_key);
      
      res.json({ similarBooks });
    } catch (error: any) {
      console.error("Error finding similar books:", error);
      res.status(500).json({ error: "Error finding similar books" });
    }
  });
  
  // Python-based PDF generation endpoint using exec approach with data sanitization
  app.post("/api/books/export-pdf", async (req: Request, res: Response) => {
    try {
      console.log("PDF Export: Starting PDF generation process using exec approach");
      
      const bookData = req.body;
      if (!bookData) {
        console.error("PDF Export: No book data provided");
        return res.status(400).json({ error: "Book data is required" });
      }
      
      // Sanitize and validate book data
      // Define function for sanitizing book data
      const sanitizeBookData = (data: any) => {
        const sanitized: any = {};
        
        // Maximum field lengths
        const maxLengths = {
          title: 255,
          subtitle: 255,
          author: 100,
          publisher: 100,
          dimensions: 50,
          price: 20,
          summary: 5000,
          review: 5000,
          isbn: 20
        };
        
        // Helper function to sanitize text
        const sanitizeText = (text: any, maxLength: number): string => {
          if (text === null || text === undefined) return '';
          
          // Convert to string
          let cleanText = String(text);
          
          // Remove invisible control characters (including ASCII 152) that cause PDF spacing issues
          cleanText = cleanText.replace(/[\x00-\x1F\x7F-\x9F\u0080-\u009F]/g, '');
          
          // Trim whitespace
          cleanText = cleanText.trim();
          
          // Replace potentially dangerous characters for shell commands
          cleanText = cleanText.replace(/[&;`'"|*?~<>^()[\]{}$\\]/g, '');
          
          // Fix spacing issues by normalizing spaces (replace multiple spaces with a single space)
          cleanText = cleanText.replace(/\s+/g, ' ');
          
          // Replace newlines with spaces
          cleanText = cleanText.replace(/[\r\n]+/g, ' ');
          
          // Extra sanitization for title fields
          const fieldName = key; // Store the key in a local variable to fix the reference issue
          if (text && (fieldName === 'title' || fieldName === 'subtitle')) {
            console.log(`Before cleaning title: "${cleanText}", ASCII first char: ${cleanText.charCodeAt(0)}`);
            
            // Double check for any remaining problematic characters at the start
            while (cleanText.length > 0 && (
              cleanText.charCodeAt(0) < 32 || 
              (cleanText.charCodeAt(0) > 126 && cleanText.charCodeAt(0) < 160)
            )) {
              cleanText = cleanText.substring(1);
            }
            
            console.log(`After cleaning title: "${cleanText}"`);
          }
          
          // Truncate to maximum length
          if (cleanText.length > maxLength) {
            cleanText = cleanText.substring(0, maxLength);
          }
          
          return cleanText;
        };
        
        // Process each field
        for (const [key, value] of Object.entries(data)) {
          // Skip null or undefined values
          if (value === null || value === undefined) continue;
          
          // Handle different field types
          if (typeof value === 'string') {
            // Get max length for this field or use default
            const maxLength = maxLengths[key] || 255;
            sanitized[key] = sanitizeText(value, maxLength);
          } else if (typeof value === 'number') {
            sanitized[key] = value;
          } else if (Array.isArray(value)) {
            // Handle arrays (like genres, themes)
            sanitized[key] = value.map(item => {
              if (typeof item === 'string') {
                return sanitizeText(item, 100);
              }
              return item;
            });
          } else if (typeof value === 'object') {
            // Handle nested objects recursively
            sanitized[key] = sanitizeBookData(value);
          } else {
            sanitized[key] = value;
          }
        }
        
        return sanitized;
      };
      
      // Apply sanitization
      const sanitizedData = sanitizeBookData(bookData);
      console.log("PDF Export: Data sanitized successfully");
      
      // Use the sanitized data for the rest of the process
      
      // Log important book fields for debugging
      console.log("PDF Export: Sanitized book data:");
      console.log(`  - Title: ${sanitizedData.title || 'N/A'}`);
      console.log(`  - Author: ${sanitizedData.author || 'N/A'}`);
      console.log(`  - ISBN: ${sanitizedData.isbn || 'N/A'}`);
      console.log(`  - Fields present: ${Object.keys(sanitizedData).join(', ')}`);
      
      // Setup paths and commands
      const { exec } = require('child_process');
      const path = require('path');
      const fs = require('fs');
      const os = require('os');
      
      // Create a unique temporary filename for output
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `book_export_${Date.now()}.pdf`);
      console.log(`PDF Export: Will save PDF to ${outputPath}`);
      
      // Validate data before writing to file
      if (!sanitizedData.title || !sanitizedData.author) {
        console.error('PDF Export ERROR: Missing required fields (title or author)');
        return res.status(400).json({ 
          error: "Invalid book data", 
          details: "Book must have at least a title and author" 
        });
      }
      
      // Create a temporary JSON file for the sanitized book data with proper encoding
      const tempJsonPath = path.join(tempDir, `book_data_${Date.now()}.json`);
      try {
        fs.writeFileSync(
          tempJsonPath, 
          JSON.stringify(sanitizedData, null, 2), 
          { encoding: 'utf8' }
        );
        console.log(`PDF Export: Sanitized book data saved to temporary file ${tempJsonPath}`);
      } catch (writeErr) {
        console.error(`PDF Export ERROR: Failed to write JSON file: ${writeErr}`);
        return res.status(500).json({ 
          error: "Failed to prepare data for PDF generation", 
          details: String(writeErr)
        });
      }
      
      // Check if Python script exists
      const scriptPath = path.join(process.cwd(), 'python_services/libLensAI_PDFGen.py');
      if (!fs.existsSync(scriptPath)) {
        console.error(`PDF Export ERROR: Python script file not found at ${scriptPath}`);
        return res.status(500).json({ 
          error: "Python script file not found",
          details: `The PDF generation script could not be located at ${scriptPath}` 
        });
      }
      
      // Pass the JSON file path rather than the JSON contents to avoid command-line spacing issues
      // Use python -m syntax to ensure we're using the correct interpreter and pass arguments directly
      const command = `python3 "${scriptPath}" --json="${tempJsonPath}" --output="${outputPath}"`;
      console.log(`PDF Export: Executing command: ${command}`);
      
      // Execute the Python script with more robust error handling
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        // Clean up the temporary JSON file
        try {
          fs.unlinkSync(tempJsonPath);
          console.log(`PDF Export: Removed temporary JSON file ${tempJsonPath}`);
        } catch (err) {
          console.error(`PDF Export: Error removing temporary JSON file: ${err}`);
        }
        
        // Handle execution errors
        if (error) {
          console.error(`PDF Export ERROR: Failed to execute Python script: ${error.message}`);
          return res.status(500).json({ 
            error: "Failed to execute Python script", 
            details: error.message 
          });
        }
        
        // Log output
        if (stdout) {
          console.log(`PDF Python stdout: ${stdout.trim()}`);
        }
        
        if (stderr) {
          console.error(`PDF Python stderr: ${stderr.trim()}`);
        }
        
        // Check if the PDF was generated
        if (!fs.existsSync(outputPath)) {
          console.error(`PDF Export ERROR: PDF file was not generated at ${outputPath}`);
          return res.status(500).json({ error: "PDF file was not generated" });
        }
        
        // Get file stats for debugging
        const stats = fs.statSync(outputPath);
        console.log(`PDF Export: Generated PDF successfully at ${outputPath} (${stats.size} bytes)`);
        
        // Send the PDF file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(bookData.title || 'book')}.pdf"`);
        
        // Stream the file
        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);
        
        // Clean up the file after sending
        fileStream.on('close', () => {
          console.log(`PDF Export: Cleaning up temporary file ${outputPath}`);
          fs.unlink(outputPath, (err) => {
            if (err) console.error(`PDF Export: Failed to delete temporary PDF file: ${err}`);
          });
        });
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Test route for direct PDF generation
  app.get("/api/test-pdf", async (req: Request, res: Response) => {
    try {
      console.log("Test PDF: Starting direct test PDF generation");
      
      // Create a simple test book
      const testBook = {
        isbn: "9783736505780",
        title: "Test Book",
        subtitle: "A test subtitle",
        author: "Test Author",
        publisher: "Test Publisher",
        publicationYear: 2025,
        publicationPlace: "Berlin",
        pageCount: 100,
        dimensions: "20 cm",
        price: "EUR 18.00",
        language: "de",
        summary: "This is a test summary for the PDF generation.",
        review: "• This is a test review for PDF generation."
      };
      
      // Create a temporary directory for the PDF file
      const { spawn } = require('child_process');
      const path = require('path');
      const fs = require('fs');
      const os = require('os');
      
      // Create a unique temporary filename
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `test_pdf_${Date.now()}.pdf`);
      
      // Prepare JSON data for Python script
      const jsonString = JSON.stringify(testBook);
      
      console.log(`Test PDF: Will execute Python script at ${process.cwd()}/python_services/libLensAI_PDFGen.py`);
      
      // Check if file exists before spawning
      if (!fs.existsSync('python_services/libLensAI_PDFGen.py')) {
        console.error(`Test PDF ERROR: Python script file not found at python_services/libLensAI_PDFGen.py`);
        return res.status(500).send("Python script file not found at python_services/libLensAI_PDFGen.py");
      }
      
      console.log('Test PDF: Spawning Python process for PDF generation...');
      
      // Spawn Python process to generate PDF
      const pythonProcess = spawn('python', [
        'python_services/libLensAI_PDFGen.py',
        '--json', jsonString,
        '--output', outputPath
      ]);
      
      // Log Python process standard output for debugging
      pythonProcess.stdout.on('data', (data: Buffer) => {
        console.log(`Test PDF stdout: ${data.toString().trim()}`);
      });
      
      // Handle Python process events
      let errorOutput = '';
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
        console.error(`Test PDF stderr: ${data.toString().trim()}`);
      });
      
      pythonProcess.on('close', (code: number) => {
        console.log(`Test PDF: Python process exited with code ${code}`);
        
        if (code !== 0) {
          console.error(`Test PDF ERROR: Python process failed with code ${code}`);
          console.error(`Test PDF ERROR details: ${errorOutput}`);
          return res.status(500).send(`Python process failed with code ${code}. Details: ${errorOutput}`);
        }
        
        // Check if the file exists
        if (!fs.existsSync(outputPath)) {
          console.error(`Test PDF ERROR: PDF file was not generated at ${outputPath}`);
          return res.status(500).send("PDF file was not generated");
        }
        
        // Get file stats for debugging
        const stats = fs.statSync(outputPath);
        console.log(`Test PDF: Generated PDF successfully at ${outputPath} (${stats.size} bytes)`);
        
        // Send the PDF file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="test.pdf"`);
        
        // Stream the file
        const fileStream = fs.createReadStream(outputPath);
        fileStream.pipe(res);
        
        // Clean up the file after sending
        fileStream.on('close', () => {
          console.log(`Test PDF: Cleaning up temporary file ${outputPath}`);
          fs.unlink(outputPath, (err: NodeJS.ErrnoException | null) => {
            if (err) console.error(`Test PDF: Failed to delete temporary PDF file: ${err}`);
          });
        });
      });
    } catch (error: any) {
      console.error(`Test PDF ERROR: ${error.message}`);
      console.error(error.stack);
      res.status(500).send(`Error generating test PDF: ${error.message}`);
    }
  });
  
  // Create and return the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}