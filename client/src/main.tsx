import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Create a simple wrapper for error handling
try {
  console.log("Initializing application...");
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  createRoot(rootElement).render(<App />);
  console.log("Application mounted");
} catch (error) {
  console.error("Failed to initialize the application:", error);
  // Display a fallback error UI
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; padding: 20px; text-align: center;">
        <h1 style="color: #1e3a8a; margin-bottom: 10px;">LibraryLens AI</h1>
        <p style="color: #666; margin-bottom: 20px;">There was a problem loading the application. Please try again.</p>
        <button style="padding: 10px 20px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.location.reload()">
          Refresh Page
        </button>
      </div>
    `;
  }
}
