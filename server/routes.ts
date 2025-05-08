import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { z } from "zod";
import { bookAnalysisSchema, Book, InsertBook } from "@shared/schema";
import { 
  processBookAnalysis, 
  analyzeBookCover,
  searchBooks,
  getBookByISBN,
  searchSimilarBooks,
  enrichBookMetadata
} from "./services/openai";
import * as googleBooks from "./services/googleBooks";

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
        
        // Get language from body (default to German)
        // Handle case where language might come as an array from form data
        let language = bodyData.language || "de";
        if (Array.isArray(language)) {
          language = language[0]; // Take first element if it's an array
        }
        console.log(`[${requestId}] Analysis requested in language: ${language}`);
        
        bookInfo = {
          ...bodyData,
          language: language, // Ensure language is a string
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
          
          const coverAnalysisResult = await analyzeBookCover(imageBase64);
          
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
      
      // First get basic metadata from Google Books (without OpenAI)
      console.log(`[${requestId}] Getting basic metadata from Google Books`);
      let googleBooksData = validatedData;
      
      try {
        if (validatedData.isbn) {
          const googleBook = await googleBooks.getBookByISBN(validatedData.isbn);
          
          if (googleBook && googleBook.volumeInfo) {
            const volumeInfo = googleBook.volumeInfo;
            
            // Extract subtitle if available
            let mainTitle = volumeInfo.title || "";
            let subtitle = null;
            if (mainTitle && mainTitle.includes(" - ")) {
              const parts = mainTitle.split(" - ");
              mainTitle = parts[0];
              subtitle = parts.slice(1).join(" - ");
            } else if (volumeInfo.subtitle) {
              subtitle = volumeInfo.subtitle;
            }
            
            // Extract other fields
            let edition = volumeInfo.contentVersion || null;
            let dimensions = null;
            if (volumeInfo.dimensions) {
              dimensions = `${volumeInfo.dimensions.height} x ${volumeInfo.dimensions.width} x ${volumeInfo.dimensions.thickness}`;
            }
            
            let binding = null;
            if (volumeInfo.printType) {
              binding = volumeInfo.printType === "BOOK" ? "Hardcover" : volumeInfo.printType;
            }
            
            // Extract location from publisher if available
            let location = null;
            
            // Extract price information from saleInfo
            let price = null;
            if (googleBook.saleInfo && googleBook.saleInfo.listPrice) {
              price = `${googleBook.saleInfo.listPrice.amount} ${googleBook.saleInfo.listPrice.currencyCode}`;
            }
            
            // Update our book info with Google Books data
            // Ensure that title and author are never undefined
            const updatedData = {
              ...validatedData,
              title: validatedData.title || mainTitle || "",
              subtitle: validatedData.subtitle || subtitle, 
              author: validatedData.author || (volumeInfo.authors && volumeInfo.authors.length > 0 ? volumeInfo.authors[0] : "") || "",
              publisher: validatedData.publisher || volumeInfo.publisher,
              publishedYear: validatedData.publishedYear || (volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null),
              pageCount: validatedData.pageCount || volumeInfo.pageCount,
              language: validatedData.language || volumeInfo.language || "de",
              coverImageUrl: validatedData.coverImageUrl || (volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : null),
              edition: validatedData.edition || edition,
              location: validatedData.location || location,
              dimensions: validatedData.dimensions || dimensions,
              binding: validatedData.binding || binding,
              price: validatedData.price || price,
              metadata: {
                ...(validatedData.metadata || {}),
                source: "google_books",
                googleBookId: googleBook.id,
                ...(volumeInfo.categories ? { categories: volumeInfo.categories } : {}),
                coverImage: !!validatedData.coverImageData
              }
            };
            
            googleBooksData = updatedData;
            
            // Log what got corrected from Google Books data
            if (googleBooksData.title !== validatedData.title && validatedData.title) {
              console.log(`[${requestId}] Title was corrected: "${validatedData.title}" → "${googleBooksData.title}"`);
            }
            
            if (googleBooksData.author !== validatedData.author && validatedData.author) {
              console.log(`[${requestId}] Author was corrected: "${validatedData.author}" → "${googleBooksData.author}"`);
            }
          }
        }
      } catch (error: unknown) {
        console.error(`[${requestId}] Error fetching from Google Books API:`, error instanceof Error ? error.message : String(error));
        // Continue with original data if Google Books fails
      }
      
      // For manual entries without a cover image, fetch from Google Books URL if available
      if (!req.file && googleBooksData.coverImageUrl) {
        console.log(`[${requestId}] Using cover image from provided URL: ${googleBooksData.coverImageUrl}`);
        
        try {
          // Fetch the cover image from the URL
          const imageResponse = await fetch(googleBooksData.coverImageUrl);
          
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            
            // Determine image type from URL
            const imageType = googleBooksData.coverImageUrl.endsWith('.jpg') || 
                             googleBooksData.coverImageUrl.endsWith('.jpeg') 
                             ? 'image/jpeg' : 'image/png';
            
            // Add the image to the book info
            googleBooksData.coverImageData = `data:${imageType};base64,${base64Image}`;
            console.log(`[${requestId}] Successfully fetched cover image from URL`);
          }
        } catch (error) {
          console.error(`[${requestId}] Error fetching cover image:`, error);
        }
      }
      
      // Process book analysis with a single OpenAI call (will handle missing metadata, summary, genres, and themes)
      console.log(`[${requestId}] Processing full book analysis with OpenAI`);
      const analysisResult = await processBookAnalysis(googleBooksData);
      
      // Log bibliographic data in detail before sending response
      console.log(`[${requestId}] BIBLIOGRAPHIC DATA CHECK:`);
      console.log(`- Title: "${analysisResult.title}"`);
      console.log(`- Author: "${analysisResult.author}"`);
      console.log(`- Page Count: ${analysisResult.pageCount} (type: ${typeof analysisResult.pageCount})`);
      console.log(`- Dimensions: ${analysisResult.dimensions}`);
      console.log(`- Binding: ${analysisResult.binding}`);
      console.log(`- Edition: ${analysisResult.edition}`);
      console.log(`- Location: ${analysisResult.location}`);
      console.log(`- Publisher: ${analysisResult.publisher}`);
      
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
      // Get the raw book data from the request
      let bookData: InsertBook = req.body;
      
      // Validate required fields, as the database has NOT NULL constraints
      if (!bookData.title || !bookData.author) {
        return res.status(400).json({ 
          message: "Title and author are required fields",
          missingFields: {
            title: !bookData.title,
            author: !bookData.author
          }
        });
      }
      
      // Always enrich with OpenAI to ensure proper spelling and capitalization
      let enrichedData = bookData;
      
      // Only attempt to enrich if we have at least a title or ISBN
      if (bookData.title || bookData.isbn) {
        try {
          // Mark as a user entry to prioritize OpenAI data
          const tempData = { ...bookData, isUserEntry: true };
          enrichedData = await enrichBookMetadata(tempData);
          
          // Log what was corrected
          if (enrichedData.title && bookData.title && enrichedData.title !== bookData.title) {
            console.log(`Book creation: Title corrected from "${bookData.title}" to "${enrichedData.title}"`);
          }
          
          if (enrichedData.author && bookData.author && enrichedData.author !== bookData.author) {
            console.log(`Book creation: Author corrected from "${bookData.author}" to "${enrichedData.author}"`);
          }
        } catch (enrichError) {
          console.error("Error enriching book data before creation:", enrichError);
          // Continue with original data if enrichment fails
        }
      }
      
      // Ensure required fields are still present after enrichment
      if (!enrichedData.title) {
        enrichedData.title = bookData.title;
      }
      
      if (!enrichedData.author) {
        enrichedData.author = bookData.author;
      }
      
      // Handle arrays that might be null
      if (!enrichedData.genres) {
        enrichedData.genres = [];
      }
      
      if (!enrichedData.themes) {
        enrichedData.themes = [];
      }
      
      if (!enrichedData.similarBooks) {
        enrichedData.similarBooks = [];
      }
      
      // Create book with enriched data
      const newBook = await storage.createBook(enrichedData);
      
      res.status(201).json(newBook);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: `Error creating book: ${errorMessage}` });
    }
  });
  
  // PUT /api/books/:id - Update a book
  app.put("/api/books/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const bookData: Partial<InsertBook> = req.body;
      
      // If title or author is being updated, try to enrich with OpenAI
      if (bookData.title || bookData.author || bookData.isbn) {
        try {
          // Get current book data first to merge with updates
          const currentBook = await storage.getBook(id);
          
          if (currentBook) {
            // Prepare full book data with updated fields
            const fullBookData = {
              ...currentBook,
              ...bookData,
              isUserEntry: true // Mark as user entry to prioritize OpenAI data
            };
            
            // Enrich with OpenAI
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
            
            // Step 2: Process full analysis with GoogleBooks + OpenAI in one step
            console.log("Step 2: Processing complete book analysis...");
            const analysisResult = await processBookAnalysis({
              ...coverAnalysis,
              // Ensure title and author are available
              title: coverAnalysis.title || "Unknown title",
              author: coverAnalysis.author || "Unknown author",
              // Use coverImage field as per the schema
              coverImage: `data:${file.mimetype};base64,${imageBase64}`,
              coverImageUrl: null, // We'll store the image data directly
              // This is from cover analysis, not user input
              isUserEntry: true,
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

  // Book information lookup endpoints (powered by OpenAI)
  
  // GET /api/books/lookup - Search books via OpenAI
  app.get("/api/books/lookup", async (req: Request, res: Response) => {
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
      res.status(500).json({ message: `Error searching books: ${error.message}` });
    }
  });
  
  // GET /api/books/isbn/:isbn - Get book by ISBN via OpenAI
  app.get("/api/books/isbn/:isbn", async (req: Request, res: Response) => {
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
  
  // POST /api/books/similar - Get similar books via OpenAI
  app.post("/api/books/similar", async (req: Request, res: Response) => {
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
  
  // Legacy endpoints for backward compatibility - redirect to new API endpoints
  app.get("/api/googlebooks/search", (req, res) => {
    const url = `/api/books/lookup${req.url.substring(req.url.indexOf('?'))}`;
    res.redirect(url);
  });
  
  app.get("/api/googlebooks/isbn/:isbn", (req, res) => {
    res.redirect(`/api/books/isbn/${req.params.isbn}`);
  });
  
  app.post("/api/googlebooks/similar", (req, res) => {
    res.redirect(307, "/api/books/similar");
  });

  return httpServer;
}
