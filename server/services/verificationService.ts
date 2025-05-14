/**
 * Verification Service
 * 
 * This service implements the verification logic for book data across multiple sources.
 * Follows the DNB/German RDA cataloguing standards and Python implementation
 */

import { Book } from "@shared/schema";
import { getCompleteBookByISBN } from "./googleBooks";
import { lookupBookByIsbn } from "./pythonIsbnService";
import { searchGoodreads, searchGoogleBooks } from "./googleCustomSearch";
import { processBookAnalysis } from "./openai";

/**
 * Merge metadata from different sources, prioritizing DNB data
 * This follows the Python implementation's merge_metadata function
 */
function mergeMetadata(googleData: Partial<Book>, dnbData: Partial<Book>): Partial<Book> {
  console.log("=== GOOGLE BOOKS DATA ===");
  console.log(JSON.stringify(googleData, null, 2));
  
  // Create a new object to avoid modifying the original
  const merged = { ...googleData };
  
  if (googleData.author && !googleData.mainAuthor) {
    merged.mainAuthor = googleData.author;
  }
  
  if (googleData.location && !googleData.publicationPlace) {
    merged.publicationPlace = googleData.location;
  }
  
  if (googleData.publishedYear && !googleData.publicationYear) {
    merged.publicationYear = googleData.publishedYear;
  }
  
  // Only update fields if DNB data is available
  if (dnbData && Object.keys(dnbData).length > 0) {
    console.log("=== DNB DATA ===");
    console.log(JSON.stringify(dnbData, null, 2));
    
    for (const key in dnbData) {
      // Skip special fields and empty values
      if (key === "source" || dnbData[key as keyof typeof dnbData] === null || 
          dnbData[key as keyof typeof dnbData] === undefined || 
          dnbData[key as keyof typeof dnbData] === "") {
        continue;
      }
      
      // Handle nested objects (like statement of responsibility)
      if (typeof dnbData[key as keyof typeof dnbData] === 'object' && 
          !Array.isArray(dnbData[key as keyof typeof dnbData])) {
        merged[key as keyof typeof merged] = {
          ...(merged[key as keyof typeof merged] as object || {}),
          ...(dnbData[key as keyof typeof dnbData] as object)
        };
      } else {
        // Replace with DNB data (DNB has priority)
        merged[key as keyof typeof merged] = dnbData[key as keyof typeof dnbData];
      }
    }
  } else {
    console.log("=== NO DNB DATA AVAILABLE ===");
  }
  
  return merged;
}

/**
 * Verify book data across multiple sources following Python implementation
 * and DNB/German RDA cataloguing standards
 */
export async function verifyBookData(isbn: string): Promise<Partial<Book>> {
  const requestId = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${requestId}] Starting verification for ISBN: ${isbn}`);
  
  try {
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
    
    // Add sources information
    const sources = [];
    if (googleBooksData) sources.push("Google Books");
    if (dnbData) sources.push("DNB");
    
    // Format the data to match DNB/German RDA cataloguing standards
    // Map old fields to new ones if they exist
    if (mergedData.location && !mergedData.publicationPlace) {
      mergedData.publicationPlace = mergedData.location;
      delete mergedData.location;
    }
    
    if (mergedData.publishedYear && !mergedData.publicationYear) {
      mergedData.publicationYear = mergedData.publishedYear;
      delete mergedData.publishedYear;
    }
    
    if (mergedData.author && !mergedData.mainAuthor) {
      mergedData.mainAuthor = mergedData.author;
    }
    
    // Step 4: Validate with Google Custom Search
    console.log(`[${requestId}] Step 4: Validating with Google Custom Search`);
    const searchQuery = `${mergedData.title} ${mergedData.mainAuthor || mergedData.author || ""}`;
    let googleSearchResults;
    
    try {
      googleSearchResults = await searchGoogleBooks(searchQuery);
      console.log(`[${requestId}] Google Search found ${googleSearchResults.length} results`);
      console.log("=== GOOGLE CUSTOM SEARCH RESULTS ===");
      console.log(JSON.stringify(googleSearchResults, null, 2));
    } catch (error) {
      console.log(`[${requestId}] Error in Google Search:`, error);
      // Continue even if this step fails
    }
    
    // Step 5: Get Goodreads data for additional validation
    console.log(`[${requestId}] Step 5: Getting Goodreads data for validation`);
    let goodreadsData;
    let dataMatches = true;
    
    try {
      goodreadsData = await searchGoodreads(
        mergedData.title || "", 
        mergedData.mainAuthor || mergedData.author || ""
      );
      
      if (!goodreadsData.error) {
        console.log(`[${requestId}] Goodreads data retrieved successfully`);
        console.log("=== GOODREADS DATA ===");
        console.log(JSON.stringify(goodreadsData, null, 2));
        
        sources.push("Goodreads");
        
        // Check if key information matches
        if (mergedData.title && goodreadsData.title) {
          const title1 = (mergedData.title || "").toLowerCase();
          const title2 = (goodreadsData.title || "").toLowerCase();
          const titleMatch = title1.includes(title2) || title2.includes(title1);
          
          const author1 = (mergedData.mainAuthor || mergedData.author || "").toLowerCase();
          const author2 = (goodreadsData.author || "").toLowerCase();
          const authorMatch = !author1 || !author2 || author1.includes(author2) || author2.includes(author1);
          
          dataMatches = titleMatch && authorMatch;
          
          if (!dataMatches) {
            console.log(`[${requestId}] Data verification failed: titles or authors don't match`);
            console.log(`Title match: ${titleMatch}, Author match: ${authorMatch}`);
            console.log(`Merged title: "${mergedData.title}", Goodreads title: "${goodreadsData.title}"`);
            console.log(`Merged author: "${mergedData.mainAuthor || mergedData.author}", Goodreads author: "${goodreadsData.author}"`);
          }
        }
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
          mainAuthor: mergedData.mainAuthor || mergedData.author || "",
          language: mergedData.language || "de"
        };
        
        // Only generate summary, themes, and genres with OpenAI
        const additionalDetails = await processBookAnalysis(openAiRequest);
        
        console.log("=== OPENAI ADDITIONAL DETAILS ===");
        console.log(JSON.stringify(additionalDetails, null, 2));
        
        // Only use OpenAI for these specific fields
        if (additionalDetails.summary) mergedData.summary = additionalDetails.summary;
        if (additionalDetails.themes) mergedData.themes = additionalDetails.themes;
        if (additionalDetails.genres && 
            (!mergedData.genres || !Array.isArray(mergedData.genres) || 
             (Array.isArray(mergedData.genres) && mergedData.genres.length === 0))) {
          mergedData.genres = additionalDetails.genres;
        }
        
        // Add OpenAI as source
        sources.push("OpenAI");
        
        // Add verification data
        mergedData.verification = {
          status: "verified",
          confidence: 0.9,
          message: "Book information verified across multiple sources",
          sources
        };
      } catch (error) {
        console.log(`[${requestId}] Error getting additional details from OpenAI:`, error);
        
        // Still mark as verified even if OpenAI fails
        mergedData.verification = {
          status: "verified",
          confidence: 0.8,
          message: "Book information verified across data sources, but AI enhancement failed",
          sources
        };
      }
    } else {
      // If data doesn't match, return unverified status
      mergedData.verification = {
        status: "unverified",
        confidence: 0.5,
        message: "Unable to verify book information across sources",
        sources
      };
    }
    
    // Log final data
    console.log("=== FINAL MERGED DATA ===");
    console.log(JSON.stringify(mergedData, null, 2));
    
    // Log final verification status
    console.log(`[${requestId}] Final verification status: ${mergedData.verification.status}`);
    console.log(`[${requestId}] Verification confidence: ${mergedData.verification.confidence}`);
    console.log(`[${requestId}] Verification sources: ${mergedData.verification.sources.join(", ")}`);
    
    return mergedData;
  } catch (error) {
    console.error(`[${requestId}] Error in verification process:`, error);
    return {
      verification: {
        status: "error",
        confidence: 0,
        message: `Error in verification process: ${error}`,
        sources: []
      }
    };
  }
}

/**
 * Verify a book using ISBN
 */
export async function verifyBookByIsbn(isbn: string): Promise<Partial<Book>> {
  // Clean and normalize ISBN
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
  return verifyBookData(cleanIsbn);
}