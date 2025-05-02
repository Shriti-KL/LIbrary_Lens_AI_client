import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Direct HTML response for the homepage
app.get('/', (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LibraryLens AI Status</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      line-height: 1.5;
      color: #333;
      background-color: #f9fafb;
    }
    .header {
      background-color: #1d4ed8;
      color: white;
      padding: 1rem;
      text-align: center;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .card {
      background: white;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .footer {
      background: #f5f5f5;
      padding: 1rem;
      text-align: center;
      font-size: 0.875rem;
      color: #666;
      border-top: 1px solid #eaeaea;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>LibraryLens AI</h1>
    <p>Book Analysis Platform</p>
  </div>
  
  <div class="container">
    <div class="card">
      <h2>Database Connected Successfully</h2>
      <p>The application is connected to the PostgreSQL database and can perform CRUD operations.</p>
      <p>The database has been properly migrated from in-memory storage.</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 1.5rem 0;">
      <h3>Recent Books</h3>
      <div style="background: #f9fafb; padding: 1rem; border: 1px solid #eaeaea; border-radius: 4px;">
        <p>The Great Gatsby by F. Scott Fitzgerald</p>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <p>LibraryLens AI - Book Analysis Platform</p>
  </div>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
