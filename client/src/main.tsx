import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Directly render without all the middleware and complex providers
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(React.createElement(App));
}
