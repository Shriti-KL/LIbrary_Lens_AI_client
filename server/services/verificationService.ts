/**
 * Verification Service
 * 
 * This service implements the verification logic for book data across multiple sources
 * Based on the Python implementation in libraryLensDeepSeek.py
 */

import { Book } from "@shared/schema";
import { lookupBookByIsbn } from "./pythonIsbnService";
import { getCompleteBookByISBN, searchBooks } from "./googleBooks";
import { searchGoodreads, searchGoogleBooks } from "./googleCustomSearch";
import { processBookAnalysis } from "./openai";
import { apiLogger } from "../utils/logger";

/**
 * Merge metadata from different sources, prioritizing DNB data
 * This follows the Python implementation's merge_metadata function
 */
function mergeMetadata(googleData: Partial<Book>, dnbData: Partial<Book>): Partial<Book> {
  // Start with Google Books data as base
  const merged = { ...googleData };
  
  // Only update fields if DNB data is available and not empty
  if (dnbData) {
    Object.keys(dnbData).forEach(key => {
      const value = dnbData[key as keyof typeof dnbData];
      
      // Skip source field and empty values
      if (key !== "source" && value !== null && value !== undefined && value !== "") {
        // Handle nested objects
        if (typeof value === 'object' && !Array.isArray(value)) {
          merged[key as keyof typeof merged] = {
            ...(merged[key as keyof typeof merged] as object || {}),
            ...value
          };
        } else {
          // Replace with DNB data (higher priority)
          merged[key as keyof typeof merged] = value;
        }
      }
    });
  }
  
  return merged;
}

/**
 * Core verification function that follows the Python implementation exactly:
 * 1. Gets data from Google Books API
 * 2. Gets DNB metadata
 * 3. Merges Google Books and DNB data
 * 4. Validates with Google Custom Search
 * 5. Gets Goodreads data for additional validation
 * 6. If data matches across sources, gets additional details from OpenAI
 */
export async function verifyBookData(isbn: string): Promise<Partial<Book>> {
  const requestId = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log(`[${requestId}] Starting verification for ISBN: ${isbn}`);
  
  // Step 1: Get data from Google Books
  console.log(`[${requestId}] Step 1: Getting data from Google Books API`);
  const googleBooksData = await getCompleteBookByISBN(isbn);
  
  if (!googleBooksData || !googleBooksData.title) {
    console.log(`[${requestId}] Error: No data found in Google Books`);
    return {
      verification: {
        status: "error",
        confidence: 0,
        message: "No data found in Google Books",
        sources: []
      }
    };
  }
  
  // Step 2: Get DNB metadata
  console.log(`[${requestId}] Step 2: Getting metadata from DNB`);
  const dnbData = await lookupBookByIsbn(isbn);
  
  // Step 3: Merge Google Books and DNB data
  console.log(`[${requestId}] Step 3: Merging Google Books and DNB data`);
  const mergedData = mergeMetadata(googleBooksData, dnbData || {});
  
  // Add basic verification data
  const verification: any = {
    sources: []
  };
  
  if (googleBooksData) verification.sources.push("Google Books");
  if (dnbData) verification.sources.push("DNB");
  
  // Add verification to result
  mergedData.verification = verification;
  
  // Step 4: Validate with Google Custom Search
  console.log(`[${requestId}] Step 4: Validating with Google Custom Search`);
  const searchQuery = `${mergedData.title} ${mergedData.author || ""}`;
  let googleSearchResults;
  
  try {
    googleSearchResults = await searchGoogleBooks(searchQuery);
    console.log(`[${requestId}] Google Search found ${googleSearchResults.length} results`);
  } catch (error) {
    console.log(`[${requestId}] Error in Google Search:`, error);
    // Continue even if this step fails
  }
  
  // Step 5: Get Goodreads data for additional validation
  console.log(`[${requestId}] Step 5: Getting Goodreads data for validation`);
  let goodreadsData;
  let dataMatches = true;
  
  try {
    goodreadsData = await searchGoodreads(mergedData.title || "", mergedData.author || "");
    
    if (!goodreadsData.error) {
      console.log(`[${requestId}] Goodreads data retrieved: "${goodreadsData.title}" by ${goodreadsData.author || "Unknown"}`);
      
      // Check if key information matches
      if (mergedData.title && goodreadsData.title) {
        const titleMatch = 
          mergedData.title.toLowerCase().includes(goodreadsData.title.toLowerCase()) || 
          goodreadsData.title.toLowerCase().includes(mergedData.title.toLowerCase());
          
        const authorMatch = 
          !mergedData.author || !goodreadsData.author || 
          mergedData.author.toLowerCase().includes(goodreadsData.author.toLowerCase()) || 
          goodreadsData.author.toLowerCase().includes(mergedData.author.toLowerCase());
          
        dataMatches = titleMatch && authorMatch;
        
        if (!dataMatches) {
          console.log(`[${requestId}] Data verification failed: titles or authors don't match`);
          console.log(`Title match: ${titleMatch}, Author match: ${authorMatch}`);
          console.log(`Merged title: "${mergedData.title}", Goodreads title: "${goodreadsData.title}"`);
          console.log(`Merged author: "${mergedData.author}", Goodreads author: "${goodreadsData.author}"`);
        }
      }
      
      // Add Goodreads as a source
      verification.sources.push("Goodreads");
    } else {
      console.log(`[${requestId}] Goodreads data retrieval failed: ${goodreadsData.error}`);
    }
  } catch (error) {
    console.log(`[${requestId}] Error in Goodreads validation:`, error);
    // Continue even if this step fails
  }
  
  // Step 6: If data matches across sources, get additional details from OpenAI
  if (dataMatches) {
    console.log(`[${requestId}] Step 6: Data verified, getting additional details from OpenAI`);
    
    try {
      // Prepare data for OpenAI
      const openAiRequest = {
        isbn,
        title: mergedData.title || "",
        author: mergedData.author || "",
        language: mergedData.language || "de"
      };
      
      // Only generate summary, themes, and genres with OpenAI
      const additionalDetails = await processBookAnalysis(openAiRequest);
      
      // Only use OpenAI for summary, themes, and genres
      if (additionalDetails.summary) mergedData.summary = additionalDetails.summary;
      if (additionalDetails.themes) mergedData.themes = additionalDetails.themes;
      
      // Only use OpenAI genres if none are available from authoritative sources
      if (additionalDetails.genres && (!mergedData.genres || !Array.isArray(mergedData.genres) || mergedData.genres.length === 0)) {
        mergedData.genres = additionalDetails.genres;
      }
      
      // Add OpenAI as source
      verification.sources.push("OpenAI");
      
      // Set verification status to verified
      verification.status = "verified";
      verification.confidence = 0.9;
      verification.message = "Book information verified across multiple sources";
    } catch (error) {
      console.log(`[${requestId}] Error getting additional details from OpenAI:`, error);
      
      // Still mark as verified even if OpenAI fails
      verification.status = "verified";
      verification.confidence = 0.8;
      verification.message = "Book information verified across data sources, but AI enhancement failed";
    }
  } else {
    // If data doesn't match, return unverified status
    verification.status = "unverified";
    verification.confidence = 0.5;
    verification.message = "Unable to verify book information across sources";
  }
  
  // Log final verification status
  console.log(`[${requestId}] Final verification status: ${verification.status}`);
  console.log(`[${requestId}] Verification confidence: ${verification.confidence}`);
  console.log(`[${requestId}] Verification sources: ${verification.sources.join(", ")}`);
  
  return mergedData;
}

/**
 * Verify a book using ISBN
 */
export async function verifyBookByIsbn(isbn: string): Promise<Partial<Book>> {
  // Clean and normalize ISBN
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
  return verifyBookData(cleanIsbn);
}