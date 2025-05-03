import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { z } from "zod";
import { bookAnalysisSchema, Book, InsertBook } from "@shared/schema";
import { processBookAnalysis, analyzeBookCover } from "./services/openai";
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
        
        // Check for ISBN-only search flag - this is a special case
        const isISBNOnlySearch = bodyData.isISBNOnlySearch === 'true';
        if (isISBNOnlySearch && bodyData.isbn && bodyData.isbn.trim() !== "") {
          isUserEntry = true;
          console.log(`[${requestId}] ISBN-only search detected: ${bodyData.isbn}`);
          
          // For ISBN-only search, we'll prioritize Google Books API lookup
          bookInfo.isbnPriority = true;
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
        
        // Only analyze the cover image if title and author are not provided
        // This ensures manual input takes priority
        if (!isUserEntry) {
          console.log(`[${requestId}] No manual entry, analyzing book cover to extract information`);
          const coverAnalysisResult = await analyzeBookCover(imageBase64);
          
          // Only use the analysis results for fields that weren't provided
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
      
      // Enrich book metadata from Google Books API if possible
      console.log(`[${requestId}] Enriching book metadata with Google Books API`);
      let enrichedBookInfo = await enrichBookMetadata(validatedData);
      
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
  
  // POST /api/books - Create a new book
  app.post("/api/books", async (req: Request, res: Response) => {
    try {
      // Create book with validated data
      const bookData: InsertBook = req.body;
      const newBook = await storage.createBook(bookData);
      
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
            console.log("Step 1: Analyzing book cover with OpenAI Vision...");
            const coverAnalysis = await analyzeBookCover(imageBase64);
            console.log("Cover analysis successful:", JSON.stringify(coverAnalysis).substring(0, 200) + "...");
            
            // Step 2: Enrich with Google Books data
            console.log("Step 2: Enriching with Google Books data...");
            const enrichedData = await enrichBookMetadata({
              ...coverAnalysis, 
              // Ensure title and author are available for Google Books search
              title: coverAnalysis.title || "Unknown title",
              author: coverAnalysis.author || "Unknown author"
            });
            console.log("Data enrichment successful");
            
            // Step 3: Process full analysis
            console.log("Step 3: Processing complete book analysis...");
            const analysisResult = await processBookAnalysis({
              ...enrichedData,
              // Use coverImage field as per the schema
              coverImage: `data:${file.mimetype};base64,${imageBase64}`,
              coverImageUrl: null, // We'll store the image data directly
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
