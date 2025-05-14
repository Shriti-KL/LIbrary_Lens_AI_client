/**
 * This module provides access to the ISBN lookup service
 * It now uses the native TypeScript implementation instead of the Python bridge
 */

import { Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";
import { getBookByIsbn } from "./bookService";

/**
 * Call the ISBN lookup service to get book data
 * @param isbn The ISBN to look up
 * @returns A promise that resolves to the book data
 */
export async function lookupBookByIsbn(isbn: string): Promise<Partial<Book>> {
  const lookupId = `isbn_lookup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book with ISBN: ${isbn} using native TypeScript service`);
  
  try {
    // Log the request
    apiLogger.logRequest("ISBN Lookup Service", {
      operation: "lookupBookByIsbn",
      isbn
    });
    
    // Get book data using our native TypeScript implementation
    const bookData = await getBookByIsbn(isbn);
    
    console.log(`[${lookupId}] Successfully processed book data from TypeScript service`);
    
    apiLogger.logResponse("ISBN Lookup Service", {
      operation: "lookupBookByIsbn",
      isbn,
      status: "success",
      dataReceived: true
    });
    
    return bookData;
  } catch (error: any) {
    console.error(`[${lookupId}] Error in ISBN lookup:`, error?.message);
    
    apiLogger.logError("ISBN Lookup Service", {
      error: "Service error",
      message: error?.message || "Unknown error",
      isbn,
      lookupId
    });
    
    throw new Error(`ISBN lookup error: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Check if the ISBN lookup service is available
 * Always returns true since the service is now built into the application
 * @returns A promise that resolves to true
 */
export async function isPythonIsbnServiceAvailable(): Promise<boolean> {
  return true; // Service is always available since it's now built into the application
}