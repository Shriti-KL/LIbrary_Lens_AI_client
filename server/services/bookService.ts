/**
 * Book Service 
 * 
 * This service handles all book operations for the LibraryLens application
 * It integrates with Google Books API, OpenLibrary, and DNB
 */

import { Book } from "@shared/schema";
import { lookupBookByIsbn } from "./pythonIsbnService";
import { getCompleteBookByISBN } from "./googleBooks";
import { verifyBookByIsbn } from "./verificationService";
import { apiLogger } from "../utils/logger";

/**
 * Get book information by ISBN from multiple sources
 * and merge the results prioritizing reliable data
 */
export async function getBookByIsbn(isbn: string, language: string = "de"): Promise<Partial<Book>> {
  const requestId = `get_book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${requestId}] Looking up book by ISBN: ${isbn}`);
  
  // Use the unified verification service
  return await verifyBookByIsbn(isbn, language);
}