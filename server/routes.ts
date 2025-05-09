import { Express, Request, Response } from "express";
import { createServer, Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { InsertBook } from "@shared/schema";

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Book analysis endpoint
  app.post("/api/books/analyze", upload.single("coverImage"), async (req: Request, res: Response) => {
    try {
      const requestId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      console.log(`[${requestId}] Received book analysis request`);
      
      // This is a simplified placeholder
      res.status(200).json({ message: "Analysis endpoint is being rebuilt" });
    } catch (error: any) {
      console.error("Book analysis error:", error);
      res.status(500).json({ message: `Error analyzing book: ${error?.message || 'Unknown error'}` });
    }
  });

  // Basic CRUD operations
  app.get("/api/books", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const books = await storage.getBooks(userId);
      res.status(200).json(books);
    } catch (error: any) {
      res.status(500).json({ message: `Error fetching books: ${error?.message || 'Unknown error'}` });
    }
  });

  app.get("/api/books/recent", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const books = await storage.getRecentBooks(limit);
      res.status(200).json(books);
    } catch (error: any) {
      res.status(500).json({ message: `Error fetching recent books: ${error?.message || 'Unknown error'}` });
    }
  });

  // Create the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}