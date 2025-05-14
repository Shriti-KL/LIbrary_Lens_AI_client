import { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import multer from "multer";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertBookSchema, bookAnalysisSchema } from "@shared/schema";

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
      
      // UNIFIED APPROACH: Direct all analysis through the verificationService
      let bookData;
      const { verifyBookData } = await import("./services/verificationService");
      
      // Prepare verification parameters
      const verificationParams: any = {
        language
      };
      
      // Add image data if provided
      if (req.file) {
        console.log(`[${analysisId}] Processing analysis with cover image`);
        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');
        verificationParams.coverImageData = base64Image;
      }
      
      // Add text fields if provided
      if (formData.isbn) {
        console.log(`[${analysisId}] Analysis includes ISBN: ${formData.isbn}`);
        verificationParams.isbn = formData.isbn;
      }
      
      if (formData.title) {
        console.log(`[${analysisId}] Analysis includes title: ${formData.title}`);
        verificationParams.title = formData.title;
      }
      
      if (formData.author) {
        console.log(`[${analysisId}] Analysis includes author: ${formData.author}`);
        verificationParams.author = formData.author;
      }
      
      // Execute unified verification
      console.log(`[${analysisId}] Starting unified verification with params:`, {
        hasISBN: !!verificationParams.isbn,
        hasTitle: !!verificationParams.title,
        hasAuthor: !!verificationParams.author,
        hasCoverImage: !!verificationParams.coverImageData,
        language: verificationParams.language
      });
      
      bookData = await verifyBookData(verificationParams);
      
      if (!bookData || !bookData.title) {
        return res.status(400).json({ 
          message: "Could not analyze book with provided information" 
        });
      }
      
      // Check for verification data
      const verificationStatus = bookData.verification?.status || "unknown";
      console.log(`[${analysisId}] Successfully processed complete book data: "${bookData.title}" by ${bookData.author || 'Unknown'}`);
      
      // Log bibliographic data for debugging
      console.log(`[${analysisId}] BIBLIOGRAPHIC DATA CHECK from final merged result:`);
      console.log(`- Title: "${bookData.title || 'N/A'}"`);
      console.log(`- Subtitle: "${bookData.subtitle || 'N/A'}"`);
      console.log(`- Main Author: "${bookData.author || 'N/A'}"`);
      console.log(`- Statement of Responsibility: ${bookData.statementOfResponsibility || 'N/A'}`);
      console.log(`- Edition: ${bookData.edition || 'N/A'}`);
      console.log(`- Location: ${bookData.location || 'N/A'}`);
      console.log(`- Publisher: ${bookData.publisher || 'N/A'}`);
      console.log(`- Published Year: ${bookData.publishedYear || 'N/A'}`);
      console.log(`- Page Count: ${bookData.pageCount || 'N/A'}`);
      console.log(`- Dimensions: ${bookData.dimensions || 'N/A'}`);
      console.log(`- ISBN: ${bookData.isbn || 'N/A'}`);
      console.log(`- Binding: ${bookData.binding || 'N/A'}`);
      console.log(`- Price: ${bookData.price || 'N/A'}`);
      console.log(`- Language: ${bookData.language || 'N/A'}`);
      
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
          
          // Process the image using our unified verification service
          const { verifyBookByCover } = await import("./services/verificationService");
          const bookData = await verifyBookByCover(base64Image);
          
          if (bookData && bookData.title) {
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
          } else {
            results.push({ 
              success: false, 
              error: "Could not analyze book cover", 
              originalName: file.originalname
            });
          }
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

  // Book lookup endpoint (by title, author, or ISBN)
  app.get("/api/books/lookup", async (req: Request, res: Response) => {
    try {
      const title = req.query.title as string;
      const author = req.query.author as string;
      const isbn = req.query.isbn as string;
      const language = req.query.language as string || "de";
      
      if (!title && !author && !isbn) {
        return res.status(400).json({ error: "At least one search parameter is required" });
      }
      
      // Use our unified verification service
      const { verifyBookData } = await import("./services/verificationService");
      const bookData = await verifyBookData({ title, author, isbn, language });
      
      if (!bookData || !bookData.title) {
        return res.status(404).json({ error: "Book not found with provided parameters" });
      }
      
      res.json(bookData);
    } catch (error: any) {
      console.error("Error in book lookup:", error);
      res.status(500).json({ error: "Error during book lookup" });
    }
  });

  // ISBN lookup endpoint
  app.get("/api/books/isbn/:isbn", async (req: Request, res: Response) => {
    try {
      const isbn = req.params.isbn;
      
      if (!isbn) {
        return res.status(400).json({ error: "ISBN is required" });
      }
      
      const language = req.query.language as string || "de";
      
      // Use our unified verification service
      const { verifyBookByIsbn } = await import("./services/verificationService");
      const bookData = await verifyBookByIsbn(isbn, language);
      
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
      
      // Import LLM-based recommendation service
      const openai = await import("./services/openai");
      
      // Use title and author to get recommendations
      const similarBooks = await openai.searchSimilarBooks({
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