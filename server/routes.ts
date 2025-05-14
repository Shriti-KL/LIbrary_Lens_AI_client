import { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import multer from "multer";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBookSchema, bookAnalysisSchema } from "@shared/schema";
import { analyzeBookCover } from "./services/openai";

// Configure multer for in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes: /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // Book analysis endpoint
  app.post("/api/books/analyze", upload.single("coverImage"), async (req: Request, res: Response) => {
    try {
      // Process form data from request
      const formData = req.body;
      const language = formData.language || "de";
      
      // Track analysis ID for logging
      const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      console.log(`[${analysisId}] Processing book analysis request`);
      
      let bookData;
      
      // Case 1: ISBN provided - Use this as primary source
      if (formData.isbn) {
        console.log(`[${analysisId}] Analysis by ISBN: ${formData.isbn}`);
        const { verifyBookByIsbn } = await import("./services/verificationService");
        bookData = await verifyBookByIsbn(formData.isbn);
      }
      // Case 2: Cover image provided - Use image analysis
      else if (req.file) {
        console.log(`[${analysisId}] Analysis by cover image`);
        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');
        
        // Extract data from cover image
        const coverData = await analyzeBookCover(base64Image);
        
        // If ISBN detected, use it for verification
        if (coverData.isbn) {
          console.log(`[${analysisId}] ISBN detected in cover: ${coverData.isbn}`);
          const { verifyBookByIsbn } = await import("./services/verificationService");
          bookData = await verifyBookByIsbn(coverData.isbn);
          
          // Add cover image data
          bookData.coverImageData = base64Image;
        } else if (coverData.title) {
          // Use the openai service directly
          console.log(`[${analysisId}] No ISBN in cover, using title: ${coverData.title}`);
          bookData = coverData;
          bookData.coverImageData = base64Image;
          
          // Add verification info
          bookData.verification = {
            status: "ai_generated",
            confidence: 0.3,
            sources: ["OpenAI"],
            message: "Book information extracted from cover image by AI"
          };
        } else {
          return res.status(400).json({ 
            error: "Could not extract book information from cover image" 
          });
        }
      }
      // Case 3: Title provided - Use title for search
      else if (formData.title) {
        console.log(`[${analysisId}] Analysis by title: ${formData.title}`);
        
        // Use the verification service with title
        const { searchBooks } = await import("./services/googleBooks");
        const { processBookAnalysis } = await import("./services/openai");
        
        // Search by title
        const searchResults = await searchBooks({
          title: formData.title,
          author: formData.author || "",
          maxResults: 1
        });
        
        if (searchResults && searchResults.length > 0) {
          console.log(`[${analysisId}] Found book by title search`);
          
          // If we found an ISBN, verify with that
          if (searchResults[0].isbn) {
            console.log(`[${analysisId}] ISBN found in title search: ${searchResults[0].isbn}`);
            const { verifyBookByIsbn } = await import("./services/verificationService");
            bookData = await verifyBookByIsbn(searchResults[0].isbn);
          } else {
            // Otherwise use the search result directly
            bookData = searchResults[0];
            
            // Add verification info
            bookData.verification = {
              status: "partially_verified",
              confidence: 0.5,
              sources: ["Google Books"],
              message: "Book information found by title search but not fully verified"
            };
            
            // Get additional details
            const openAiResult = await processBookAnalysis({
              title: bookData.title,
              author: bookData.author || "",
              language
            });
            
            // Add summary and themes
            if (openAiResult.summary) bookData.summary = openAiResult.summary;
            if (openAiResult.themes) bookData.themes = openAiResult.themes;
            
            // Add genres if not present
            if (openAiResult.genres && (!bookData.genres || !Array.isArray(bookData.genres) || bookData.genres.length === 0)) {
              bookData.genres = openAiResult.genres;
            }
            
            // Add OpenAI as source
            bookData.verification.sources.push("OpenAI");
          }
        } else {
          console.log(`[${analysisId}] No books found by title search`);
          
          // Use OpenAI directly if no books found
          bookData = await processBookAnalysis({
            title: formData.title,
            author: formData.author || "",
            language
          });
          
          // Add verification info
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
      
      // Check that we got some results
      if (!bookData || !bookData.title) {
        return res.status(400).json({ 
          error: "Could not analyze book with provided information" 
        });
      }
      
      // Log successful analysis
      console.log(`[${analysisId}] Successfully analyzed book: "${bookData.title}" by ${bookData.author || 'Unknown'}`);
      
      // Send response
      res.status(200).json(bookData);
    } catch (error: any) {
      console.error("Error in book analysis:", error);
      res.status(500).json({ error: "Error during book analysis" });
    }
  });

  // API routes for books
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
      // Parse and validate the request body
      const validatedData = insertBookSchema.parse(req.body);
      
      // Check for required fields
      if (!validatedData.title || !validatedData.author) {
        return res.status(400).json({ error: "Title and author are required" });
      }
      
      // Add logged-in user ID if authenticated
      if (req.isAuthenticated()) {
        validatedData.userId = req.user.id;
      }
      
      // Create the book
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
      const validatedData = insertBookSchema.partial().parse(req.body);
      
      // Update the book
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
      // This is a protected route, only available to authenticated users
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

  // Batch upload endpoint
  app.post("/api/books/batch", upload.array("coverImages", 10), async (req: Request, res: Response) => {
    try {
      // Check if files were uploaded
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No cover images provided" });
      }
      
      const results = [];
      
      // Process each cover image
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        
        try {
          // Convert image to base64
          const base64Image = file.buffer.toString('base64');
          
          // Extract data from cover image
          const coverData = await analyzeBookCover(base64Image);
          
          let bookData;
          
          // If ISBN detected, use it for verification
          if (coverData.isbn) {
            const { verifyBookByIsbn } = await import("./services/verificationService");
            bookData = await verifyBookByIsbn(coverData.isbn);
            bookData.coverImageData = base64Image;
          } else if (coverData.title) {
            // Use cover data directly
            bookData = coverData;
            bookData.coverImageData = base64Image;
            
            // Add verification info
            bookData.verification = {
              status: "ai_generated",
              confidence: 0.3,
              sources: ["OpenAI"],
              message: "Book information extracted from cover image by AI"
            };
          } else {
            results.push({ 
              success: false, 
              error: "Could not extract book information from cover image", 
              originalName: file.originalname
            });
            continue;
          }
          
          // Add user ID if authenticated
          if (req.isAuthenticated()) {
            bookData.userId = req.user.id;
          }
          
          // Store in database
          const savedBook = await storage.createBook(bookData as any);
          results.push({ 
            success: true, 
            book: savedBook,
            originalName: file.originalname
          });
        } catch (fileError: any) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          results.push({ 
            success: false, 
            error: `Error processing file: ${fileError.message}`,
            originalName: file.originalname 
          });
        }
      }
      
      res.status(200).json({ results });
    } catch (error: any) {
      console.error("Error in batch upload:", error);
      res.status(500).json({ error: "Error processing batch upload" });
    }
  });

  // ISBN lookup endpoint
  app.get("/api/books/isbn/:isbn", async (req: Request, res: Response) => {
    try {
      const isbn = req.params.isbn;
      
      if (!isbn) {
        return res.status(400).json({ error: "ISBN is required" });
      }
      
      // Use the simplified verification service
      const { verifyBookByIsbn } = await import("./services/verificationService");
      const bookData = await verifyBookByIsbn(isbn);
      
      if (!bookData || !bookData.title) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(bookData);
    } catch (error: any) {
      console.error("Error in ISBN lookup:", error);
      res.status(500).json({ error: "Error during ISBN lookup" });
    }
  });

  // Similar books endpoint
  app.post("/api/books/similar", async (req: Request, res: Response) => {
    try {
      const { title, author, genres } = req.body;
      
      if (!title && !author && (!genres || genres.length === 0)) {
        return res.status(400).json({ error: "At least title, author, or genres are required" });
      }
      
      // Import OpenAI service
      const { searchSimilarBooks } = await import("./services/openai");
      
      // Use title and author to get recommendations
      const similarBooks = await searchSimilarBooks({
        title: title || "",
        author: author || "",
        genres: genres || []
      });
      
      res.json({ similarBooks });
    } catch (error: any) {
      console.error("Error finding similar books:", error);
      res.status(500).json({ error: "Error finding similar books" });
    }
  });

  // Create and return the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}