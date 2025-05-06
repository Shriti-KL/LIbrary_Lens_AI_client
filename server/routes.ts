import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { z } from "zod";
import { bookAnalysisSchema, Book, InsertBook } from "@shared/schema";
import { 
  processBookAnalysis, 
  analyzeBookCover, 
  generateBookSummary, 
  extractBookGenres, 
  extractBookThemes, 
  assessReadingLevel, 
  generateCatalogEntry 
} from "./services/openai";
import { enrichBookMetadata, searchBooks, getBookByISBN, searchSimilarBooks } from "./services/googleBooks";

// Set up multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create server
  const httpServer = createServer(app);

  // API Endpoints - prefix all with /api
  
  // Book Analysis endpoints
  app.post("/api/books/analyze", upload.single("coverImage"), async (req: Request, res: Response) => {
    try {
      // Parse and validate request data
      let bookInfo: any = {};
      let hasCoverData = false;
      let isUserEntry = false;
      
      // Generate a unique ID for this analysis request for tracking
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[${requestId}] Starting book analysis`);
      
      // Parse the body data first
      if (req.body) {
        const bodyData = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        
        // Check for isManualSubmission flag, which is explicitly set by the client
        if (bodyData.isManualSubmission === 'true') {
          isUserEntry = true;
          console.log(`[${requestId}] Manual submission explicitly marked`);
        }
        // Also check if user has entered title or author manually as a fallback
        else if ((bodyData.title && bodyData.title.trim() !== "") || 
                 (bodyData.author && bodyData.author.trim() !== "")) {
          isUserEntry = true;
          console.log(`[${requestId}] Manual entry detected from content`);
        }
        
        // Check if the client is forcing a new analysis (happens when modifying a previous result)
        const forceNewAnalysis = bodyData.forceNewAnalysis;
        if (forceNewAnalysis) {
          console.log(`[${requestId}] Force new analysis flag detected with timestamp: ${forceNewAnalysis}`);
          isUserEntry = true; // Treat as manual entry to ensure new analysis
        }
        
        bookInfo = {
          ...bodyData,
          options: typeof bodyData.options === "string" ? JSON.parse(bodyData.options) : bodyData.options
        };
      }
      
      // If coverImage is uploaded, process it
      if (req.file) {
        console.log(`[${requestId}] Processing uploaded cover image`);
        const imageBase64 = req.file.buffer.toString("base64");
        bookInfo.coverImage = imageBase64;
        hasCoverData = true;
        
        // Determine if we need to analyze the cover image based on complete data
        const hasTitle = bookInfo.title && bookInfo.title.trim() !== '';
        const hasAuthor = bookInfo.author && bookInfo.author.trim() !== '';
        
        // If we have empty title/author fields OR explicit auto-extract mode
        if ((!hasTitle && !hasAuthor) || !isUserEntry) {
          console.log(`[${requestId}] Analyzing book cover to extract information`);
          console.log(`[${requestId}] Auto-extract mode detected with empty fields: title=${hasTitle}, author=${hasAuthor}`);
          
          // Get language preference from request, default to German
          const language = bookInfo.language || 'de';
          console.log(`[${requestId}] Using language ${language} for book cover analysis`);
          
          const coverAnalysisResult = await analyzeBookCover(imageBase64, language);
          
          // Use the analysis results for fields that weren't provided
          bookInfo = {
            ...bookInfo,
            title: coverAnalysisResult.title || "Unknown Title",
            author: coverAnalysisResult.author || "Unknown Author",
            isbn: coverAnalysisResult.isbn || null,
            publisher: coverAnalysisResult.publisher || null,
            publishedYear: coverAnalysisResult.publishedYear || null,
            coverImageData: `data:${req.file.mimetype};base64,${imageBase64}`
          };
        } else {
          console.log(`[${requestId}] Using manually entered book details`);
          bookInfo.coverImageData = `data:${req.file.mimetype};base64,${imageBase64}`;
          
          // Clear any previous analysis fields to force regeneration
          bookInfo = {
            ...bookInfo,
            summary: null,
            genres: null,
            themes: null,
            readingLevel: null,
            catalogEntry: null,
            deweyDecimal: null,
            metadata: null
          };
        }
      }
      
      console.log(`[${requestId}] Book info before validation:`, {
        title: bookInfo.title,
        author: bookInfo.author,
        isbn: bookInfo.isbn,
        isUserEntry: isUserEntry
      });
      
      // Validate the analysis request
      const validatedData = bookAnalysisSchema.parse(bookInfo);
      
      // Mark this as a user entry for the enrichment process
      validatedData.isUserEntry = isUserEntry;
      
      // Always enrich book metadata from Google Books API to get proper spelling and capitalization
      console.log(`[${requestId}] Enriching book metadata with Google Books API`);
      let enrichedBookInfo = await enrichBookMetadata(validatedData);
      
      // Log what got corrected from Google Books data
      if (enrichedBookInfo.title !== validatedData.title) {
        console.log(`[${requestId}] Title was corrected: "${validatedData.title}" → "${enrichedBookInfo.title}"`);
      }
      
      if (enrichedBookInfo.author !== validatedData.author) {
        console.log(`[${requestId}] Author was corrected: "${validatedData.author}" → "${enrichedBookInfo.author}"`);
      }
      
      // For manual entries without a cover image, fetch from Google Books if we found a match
      if (!req.file && enrichedBookInfo.coverImageUrl) {
        console.log(`[${requestId}] Using cover image from Google Books: ${enrichedBookInfo.coverImageUrl}`);
        
        try {
          // Fetch the cover image from Google Books API
          const imageResponse = await fetch(enrichedBookInfo.coverImageUrl);
          
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            
            // Determine image type from URL
            const imageType = enrichedBookInfo.coverImageUrl.endsWith('.jpg') || 
                             enrichedBookInfo.coverImageUrl.endsWith('.jpeg') 
                             ? 'image/jpeg' : 'image/png';
            
            // Add the image to the book info
            enrichedBookInfo.coverImageData = `data:${imageType};base64,${base64Image}`;
            console.log(`[${requestId}] Successfully fetched cover image from Google Books`);
          }
        } catch (error) {
          console.error(`[${requestId}] Error fetching cover image from Google Books:`, error);
        }
      }
      
      // Process book analysis with OpenAI
      console.log(`[${requestId}] Processing full book analysis with OpenAI`);
      const analysisResult = await processBookAnalysis(enrichedBookInfo);
      
      console.log(`[${requestId}] Analysis complete, responding with data`);
      res.status(200).json(analysisResult);
    } catch (error) {
      console.error("Book analysis error:", error);
      res.status(500).json({ message: `Error analyzing book: ${error.message}` });
    }
  });

  // Book CRUD operations
  
  // GET /api/books - Get all books
  app.get("/api/books", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const books = await storage.getBooks(userId);
      res.status(200).json(books);
    } catch (error) {
      res.status(500).json({ message: `Error fetching books: ${error.message}` });
    }
  });
  
  // GET /api/books/recent - Get recent books
  app.get("/api/books/recent", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const books = await storage.getRecentBooks(limit);
      res.status(200).json(books);
    } catch (error) {
      res.status(500).json({ message: `Error fetching recent books: ${error.message}` });
    }
  });
  
  // GET /api/books/search - Search books
  app.get("/api/books/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const books = await storage.searchBooks(query);
      res.status(200).json(books);
    } catch (error) {
      res.status(500).json({ message: `Error searching books: ${error.message}` });
    }
  });
  
  // GET /api/books/:id - Get a specific book
  app.get("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const book = await storage.getBook(id);
      
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }
      
      res.status(200).json(book);
    } catch (error) {
      res.status(500).json({ message: `Error fetching book: ${error.message}` });
    }
  });
  
  // POST /api/books/translate - Translate book content to another language
  app.post("/api/books/translate", async (req: Request, res: Response) => {
    try {
      const { bookId, language } = req.body;
      
      if (!bookId || !language) {
        return res.status(400).json({ message: "Book ID and language are required" });
      }
      
      // Get the book from storage
      const book = await storage.getBook(parseInt(bookId));
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }
      
      // Create a unique ID for this translation request for tracking
      const translationId = `translation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[${translationId}] Translating book "${book.title}" to ${language}`);
      
      // Clone the book and prepare to translate its fields
      const translatedBook: Partial<Book> = { ...book, language };
      
      // Translate the summary if it exists
      if (book.summary) {
        console.log(`[${translationId}] Translating summary`);
        translatedBook.summary = await generateBookSummary({
          ...book,
          language
        });
      }
      
      // Translate the genres if they exist
      if (book.genres && Array.isArray(book.genres)) {
        console.log(`[${translationId}] Translating genres`);
        translatedBook.genres = await extractBookGenres({
          ...book,
          language
        });
      }
      
      // Translate the themes if they exist
      if (book.themes) {
        console.log(`[${translationId}] Translating themes`);
        translatedBook.themes = await extractBookThemes({
          ...book,
          language
        });
      }
      
      // Translate the reading level if it exists
      if (book.readingLevel) {
        console.log(`[${translationId}] Translating reading level`);
        translatedBook.readingLevel = await assessReadingLevel({
          ...book,
          language
        });
      }
      
      // Translate the catalog entry if it exists
      if (book.catalogEntry) {
        console.log(`[${translationId}] Translating catalog entry`);
        translatedBook.catalogEntry = await generateCatalogEntry({
          ...book,
          language
        });
      }
      
      console.log(`[${translationId}] Translation complete`);
      res.status(200).json(translatedBook);
    } catch (error: any) {
      console.error("Translation error:", error);
      res.status(500).json({ message: `Error translating book: ${error.message}` });
    }
  });
  
  // POST /api/books - Create a new book
  app.post("/api/books", async (req: Request, res: Response) => {
    try {
      // Get the raw book data from the request
      const bookData: InsertBook = req.body;
      
      // Always enrich with Google Books API to ensure proper spelling and capitalization
      let enrichedData = bookData;
      
      // Only attempt to enrich if we have at least a title or ISBN
      if (bookData.title || bookData.isbn) {
        try {
          // Mark as a user entry to prioritize Google Books data
          const tempData = { ...bookData, isUserEntry: true };
          enrichedData = await enrichBookMetadata(tempData);
          
          // Log what was corrected
          if (enrichedData.title !== bookData.title) {
            console.log(`Book creation: Title corrected from "${bookData.title}" to "${enrichedData.title}"`);
          }
          
          if (enrichedData.author !== bookData.author) {
            console.log(`Book creation: Author corrected from "${bookData.author}" to "${enrichedData.author}"`);
          }
        } catch (enrichError) {
          console.error("Error enriching book data before creation:", enrichError);
          // Continue with original data if enrichment fails
        }
      }
      
      // Create book with enriched data
      const newBook = await storage.createBook(enrichedData);
      
      res.status(201).json(newBook);
    } catch (error) {
      res.status(500).json({ message: `Error creating book: ${error.message}` });
    }
  });
  
  // PUT /api/books/:id - Update a book
  app.put("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const bookData: Partial<InsertBook> = req.body;
      
      // If title or author is being updated, try to enrich with Google Books API
      if (bookData.title || bookData.author || bookData.isbn) {
        try {
          // Get current book data first to merge with updates
          const currentBook = await storage.getBook(id);
          
          if (currentBook) {
            // Prepare full book data with updated fields
            const fullBookData = {
              ...currentBook,
              ...bookData,
              isUserEntry: true // Mark as user entry to prioritize Google data
            };
            
            // Enrich with Google Books API
            const enrichedData = await enrichBookMetadata(fullBookData);
            
            // Log what was corrected
            if (enrichedData.title !== fullBookData.title) {
              console.log(`Book update: Title corrected from "${fullBookData.title}" to "${enrichedData.title}"`);
              bookData.title = enrichedData.title;
            }
            
            if (enrichedData.author !== fullBookData.author) {
              console.log(`Book update: Author corrected from "${fullBookData.author}" to "${enrichedData.author}"`);
              bookData.author = enrichedData.author;
            }
            
            // Copy other enriched data if not explicitly set in the update
            if (enrichedData.isbn && !bookData.isbn) {
              bookData.isbn = enrichedData.isbn;
            }
            
            if (enrichedData.publisher && !bookData.publisher) {
              bookData.publisher = enrichedData.publisher;
            }
            
            if (enrichedData.publishedYear && !bookData.publishedYear) {
              bookData.publishedYear = enrichedData.publishedYear;
            }
            
            if (enrichedData.pageCount && !bookData.pageCount) {
              bookData.pageCount = enrichedData.pageCount;
            }
            
            if (enrichedData.coverImageUrl && !bookData.coverImageUrl) {
              bookData.coverImageUrl = enrichedData.coverImageUrl;
            }
          }
        } catch (enrichError) {
          console.error("Error enriching book data during update:", enrichError);
          // Continue with original data if enrichment fails
        }
      }
      
      // Update with possibly enriched data
      const updatedBook = await storage.updateBook(id, bookData);
      
      if (!updatedBook) {
        return res.status(404).json({ message: "Book not found" });
      }
      
      res.status(200).json(updatedBook);
    } catch (error) {
      res.status(500).json({ message: `Error updating book: ${error.message}` });
    }
  });
  
  // DELETE /api/books/:id - Delete a book
  app.delete("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteBook(id);
      
      if (!success) {
        return res.status(404).json({ message: "Book not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: `Error deleting book: ${error.message}` });
    }
  });
  
  // DELETE /api/books - Clear all books
  app.delete("/api/books", async (req: Request, res: Response) => {
    try {
      // This is a destructive operation, so we should check for confirmation
      const { confirm } = req.query;
      
      if (confirm !== 'true') {
        return res.status(400).json({ 
          message: "This operation will delete ALL books. Confirm by adding ?confirm=true to the request."
        });
      }
      
      console.log("Clearing all books from database...");
      
      // First set the response content type
      res.setHeader('Content-Type', 'application/json');
      
      // Execute the database operation
      const deletedCount = await storage.clearAllBooks();
      
      console.log(`Successfully deleted ${deletedCount} books`);
      
      // Return the response
      return res.status(200).json({ 
        success: true,
        message: `Successfully deleted all books`,
        count: deletedCount
      });
    } catch (error) {
      console.error("Error when clearing books:", error);
      
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: `Error clearing books: ${error.message}` 
      });
    }
  });

  // Batch processing endpoint
  app.post("/api/books/batch", upload.array("coverImages", 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files were uploaded" });
      }
      
      // Process each image and apply book analysis
      const results = [];
      const processed = { success: 0, failed: 0 };
      
      // Get language preference from request, default to German
      const language = req.body.language || 'de';
      console.log(`Using language ${language} for batch processing`);
      
      // Process files sequentially for better error handling
      for (const file of files) {
        try {
          console.log(`Processing file: ${file.originalname}`);
          
          // Check if file is an image
          if (!file.mimetype.startsWith('image/')) {
            throw new Error("File is not an image");
          }
          
          // Convert image to base64
          const imageBase64 = file.buffer.toString("base64");
          
          // Get file size in MB for logging
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
          console.log(`Image size: ${fileSizeMB}MB`);
          
          try {
            // Step 1: Analyze cover using OpenAI Vision
            console.log(`Step 1: Analyzing book cover with OpenAI Vision (language: ${language})...`);
            const coverAnalysis = await analyzeBookCover(imageBase64, language);
            console.log("Cover analysis successful:", JSON.stringify(coverAnalysis).substring(0, 200) + "...");
            
            // Step 2: Enrich with Google Books data
            console.log("Step 2: Enriching with Google Books data...");
            const enrichedData = await enrichBookMetadata({
              ...coverAnalysis,
              language, // Add language to enrichment request 
              // Ensure title and author are available for Google Books search
              title: coverAnalysis.title || "Unknown title",
              author: coverAnalysis.author || "Unknown author",
              // This is from cover analysis, not user input
              isUserEntry: true
            });
            
            // Log what got corrected from Google Books data
            if (enrichedData.title !== coverAnalysis.title) {
              console.log(`Title was corrected: "${coverAnalysis.title}" → "${enrichedData.title}"`);
            }
            
            if (enrichedData.author !== coverAnalysis.author) {
              console.log(`Author was corrected: "${coverAnalysis.author}" → "${enrichedData.author}"`);
            }
            
            console.log("Data enrichment successful");
            
            // Step 3: Process full analysis
            console.log(`Step 3: Processing complete book analysis in ${language}...`);
            const analysisResult = await processBookAnalysis({
              ...enrichedData,
              // Use coverImage field as per the schema
              coverImage: `data:${file.mimetype};base64,${imageBase64}`,
              coverImageUrl: null, // We'll store the image data directly
              language, // Include language parameter
              options: {
                summary: true,
                genres: true,
                themes: true,
                readingLevel: true,
                catalogEntry: true,
              }
            });
            console.log("Full analysis completed successfully");
            
            // Step 4: Save to storage
            console.log("Step 4: Saving book to database...");
            const bookData: InsertBook = {
              ...analysisResult as InsertBook,
              // Ensure required fields are not undefined
              title: analysisResult.title || file.originalname.replace(/\.[^/.]+$/, ""), // Remove extension if no title found
              author: analysisResult.author || "Unknown",
              userId: req.user?.id || null
            };
            
            const savedBook = await storage.createBook(bookData);
            console.log(`Book saved with ID: ${savedBook.id}`);
            
            results.push({
              filename: file.originalname,
              status: "success",
              book: savedBook
            });
            processed.success++;
          } catch (analysisError) {
            console.error("Error in analysis process:", analysisError);
            results.push({
              filename: file.originalname,
              status: "error",
              error: analysisError.message
            });
            processed.failed++;
          }
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          results.push({
            filename: file.originalname || "unknown",
            status: "error",
            error: fileError.message
          });
          processed.failed++;
        }
      }
      
      res.status(200).json({
        message: `Processed ${processed.success} books successfully, ${processed.failed} failed`,
        processed,
        results
      });
    } catch (error) {
      console.error("Fatal error in batch processing:", error);
      res.status(500).json({ 
        message: `Error processing batch: ${error.message}`,
        error: error.stack
      });
    }
  });

  // Google Books API integration endpoints
  
  // GET /api/googlebooks/search - Search books via Google Books API
  app.get("/api/googlebooks/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const title = req.query.title as string;
      const author = req.query.author as string;
      const isbn = req.query.isbn as string;
      const maxResults = req.query.maxResults ? parseInt(req.query.maxResults as string) : 10;
      
      if (!query && !title && !author && !isbn) {
        return res.status(400).json({ message: "At least one search parameter is required" });
      }
      
      const searchParams = {
        query: query || "",
        title,
        author,
        isbn,
        maxResults
      };
      
      const results = await searchBooks(searchParams);
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ message: `Error searching Google Books: ${error.message}` });
    }
  });
  
  // GET /api/googlebooks/isbn/:isbn - Get book by ISBN
  app.get("/api/googlebooks/isbn/:isbn", async (req: Request, res: Response) => {
    try {
      const isbn = req.params.isbn;
      
      if (!isbn) {
        return res.status(400).json({ message: "ISBN is required" });
      }
      
      const book = await getBookByISBN(isbn);
      
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }
      
      res.status(200).json(book);
    } catch (error) {
      res.status(500).json({ message: `Error fetching book by ISBN: ${error.message}` });
    }
  });
  
  // POST /api/googlebooks/similar - Get similar books
  app.post("/api/googlebooks/similar", async (req: Request, res: Response) => {
    try {
      const bookInfo = req.body;
      
      if (!bookInfo || (!bookInfo.title && !bookInfo.author && !bookInfo.genres)) {
        return res.status(400).json({ message: "Book information is required (title, author, or genres)" });
      }
      
      const similarBooks = await searchSimilarBooks(bookInfo);
      res.status(200).json(similarBooks);
    } catch (error) {
      res.status(500).json({ message: `Error finding similar books: ${error.message}` });
    }
  });

  return httpServer;
}
