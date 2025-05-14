/**
 * Verification Service
 * 
 * This service implements the central verification logic for all book data across multiple sources
 * Based on the Python implementation in libraryLensDeepSeek.py
 */

import { Book } from "@shared/schema";
import { lookupBookByIsbn } from "./pythonIsbnService";
import { getCompleteBookByISBN, searchBooks } from "./googleBooks";
import { searchGoodreads } from "./googleCustomSearch";
import { processBookAnalysis as processWithOpenAI } from "./openai";
import { analyzeBookCover } from "./openai";
import { apiLogger } from "../utils/logger";

/**
 * Core verification function that works with any input type (ISBN, title, author, cover)
 * and returns standardized verified book data following the Python implementation pattern
 */
export async function verifyBookData(params: {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
  coverImageData?: string | null;
  language?: string;
}): Promise<Partial<Book>> {
  // Create a unique request ID for logging
  const requestId = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const language = params.language || "de";
  
  console.log(`[${requestId}] Starting verification with: ${JSON.stringify({
    hasISBN: !!params.isbn,
    hasTitle: !!params.title,
    hasAuthor: !!params.author,
    hasCoverImage: !!params.coverImageData,
    language
  })}`);
  
  // Result object that will be progressively built with verification data
  const result: Partial<Book> = {
    language,
    verification: {
      status: "pending",
      confidence: 0,
      sources: [],
      message: "Verification in progress"
    }
  };
  
  // STEP 1: Initial data collection from primary source based on available inputs
  
  // Cover image analysis (if provided)
  if (params.coverImageData) {
    console.log(`[${requestId}] Analyzing cover image`);
    try {
      const coverData = await analyzeBookCover(params.coverImageData);
      
      // Add cover image data to result
      console.log(`[${requestId}] Cover analysis results:`, {
        title: coverData.title,
        author: coverData.author,
        isbn: coverData.isbn
      });
      
      // If cover data has more information than provided params, use it
      if (coverData.title) result.title = coverData.title;
      if (coverData.author) result.author = coverData.author;
      if (coverData.subtitle) result.subtitle = coverData.subtitle;
      if (coverData.publisher) result.publisher = coverData.publisher;
      if (coverData.publishedYear) result.publishedYear = coverData.publishedYear;
      if (coverData.pageCount) result.pageCount = coverData.pageCount;
      if (coverData.isbn) params.isbn = coverData.isbn; // If ISBN detected in cover, use it for verification
      
      // Store cover image
      result.coverImageData = params.coverImageData;
      
      // Add OpenAI as source
      if (!result.verification?.sources.includes("OpenAI")) {
        result.verification!.sources.push("OpenAI");
      }
    } catch (error: any) {
      console.log(`[${requestId}] Error in cover analysis:`, error?.message || String(error));
    }
  }
  
  // Get data by ISBN (highest priority source)
  let dnbData: Partial<Book> | null = null;
  let googleBooksData: Partial<Book> | null = null;
  
  if (params.isbn) {
    // STEP 2A: Try DNB data first (like in Python implementation)
    console.log(`[${requestId}] Looking up book by ISBN in DNB: ${params.isbn}`);
    try {
      dnbData = await lookupBookByIsbn(params.isbn);
      
      if (dnbData && dnbData.title) {
        console.log(`[${requestId}] Found book in DNB: "${dnbData.title}" by ${dnbData.author || 'Unknown'}`);
        
        // Merge DNB data into result (DNB has highest priority)
        Object.keys(dnbData).forEach(key => {
          if (dnbData && dnbData[key as keyof typeof dnbData] !== undefined && 
              dnbData[key as keyof typeof dnbData] !== null) {
            result[key as keyof typeof result] = dnbData[key as keyof typeof dnbData];
          }
        });
        
        // Add DNB as source
        if (!result.verification?.sources.includes("DNB")) {
          result.verification!.sources.push("DNB");
        }
      } else {
        console.log(`[${requestId}] DNB lookup didn't return valid data for ISBN: ${params.isbn}`);
      }
    } catch (error: any) {
      console.log(`[${requestId}] Error in DNB lookup:`, error?.message || String(error));
    }
    
    // STEP 2B: Get Google Books data (like in Python implementation)
    console.log(`[${requestId}] Looking up book by ISBN in Google Books: ${params.isbn}`);
    try {
      googleBooksData = await getCompleteBookByISBN(params.isbn, language);
      
      if (googleBooksData && googleBooksData.title) {
        console.log(`[${requestId}] Found book in Google Books: "${googleBooksData.title}" by ${googleBooksData.author || 'Unknown'}`);
        
        // Merge Google Books data but only for fields not present in DNB
        Object.keys(googleBooksData).forEach(key => {
          if (googleBooksData && 
              googleBooksData[key as keyof typeof googleBooksData] !== undefined && 
              googleBooksData[key as keyof typeof googleBooksData] !== null &&
              (result[key as keyof typeof result] === undefined || 
              result[key as keyof typeof result] === null)) {
            result[key as keyof typeof result] = googleBooksData[key as keyof typeof googleBooksData];
          }
        });
        
        // Add Google Books as source
        if (!result.verification?.sources.includes("Google Books")) {
          result.verification!.sources.push("Google Books");
        }
      } else {
        console.log(`[${requestId}] Google Books lookup didn't return valid data for ISBN: ${params.isbn}`);
      }
    } catch (error: any) {
      console.log(`[${requestId}] Error in Google Books lookup:`, error?.message || String(error));
    }
  }
  // If no ISBN but title provided, search by title/author
  else if (params.title) {
    // STEP 2C: Search by title/author in Google Books
    console.log(`[${requestId}] Searching for book by title: "${params.title}" and author: "${params.author || 'Unknown'}"`);
    try {
      const searchParams = {
        title: params.title,
        author: params.author || undefined,
        maxResults: 5
      };
      
      const searchResults = await searchBooks(searchParams);
      
      if (searchResults && searchResults.length > 0) {
        // Get the first result (most relevant)
        const firstResult = searchResults[0];
        console.log(`[${requestId}] Found book in Google Books search: "${firstResult.title}" by ${firstResult.author || 'Unknown'}`);
        
        // Merge search results into result
        Object.keys(firstResult).forEach(key => {
          if (firstResult[key as keyof typeof firstResult] !== undefined && 
              firstResult[key as keyof typeof firstResult] !== null &&
              (result[key as keyof typeof result] === undefined || 
              result[key as keyof typeof result] === null)) {
            result[key as keyof typeof result] = firstResult[key as keyof typeof firstResult];
          }
        });
        
        // Add Google Books as source
        if (!result.verification?.sources.includes("Google Books")) {
          result.verification!.sources.push("Google Books");
        }
        
        // If ISBN was found in search, look it up for more complete data
        if (firstResult.isbn && !params.isbn) {
          console.log(`[${requestId}] ISBN found in search results: ${firstResult.isbn}, initiating verification`);
          // Recursive call with the discovered ISBN for more complete verification
          const verifiedData = await verifyBookData({
            isbn: firstResult.isbn,
            language: params.language
          });
          
          // Merge verified data but preserve original title/author
          const originalTitle = result.title;
          const originalAuthor = result.author;
          Object.keys(verifiedData).forEach(key => {
            if (verifiedData[key as keyof typeof verifiedData] !== undefined && 
                verifiedData[key as keyof typeof verifiedData] !== null &&
                (result[key as keyof typeof result] === undefined || 
                result[key as keyof typeof result] === null)) {
              result[key as keyof typeof result] = verifiedData[key as keyof typeof verifiedData];
            }
          });
          
          // Restore original title/author if they were present
          if (originalTitle) result.title = originalTitle;
          if (originalAuthor) result.author = originalAuthor;
          
          // Merge verification sources
          if (verifiedData.verification?.sources) {
            verifiedData.verification.sources.forEach(source => {
              if (!result.verification?.sources.includes(source)) {
                result.verification!.sources.push(source);
              }
            });
          }
        }
      } else {
        console.log(`[${requestId}] No results found in Google Books for title: "${params.title}" and author: "${params.author || 'Unknown'}"`);
      }
    } catch (error: any) {
      console.log(`[${requestId}] Error in Google Books search:`, error?.message || String(error));
    }
  }

  // STEP 3: Additional verification with Goodreads (like in Python implementation)
  if (result.title) {
    console.log(`[${requestId}] Performing Goodreads verification for: "${result.title}" by ${result.author || 'Unknown'}`);
    try {
      const goodreadsData = await searchGoodreads(result.title, result.author || "");
      
      if (!goodreadsData.error) {
        console.log(`[${requestId}] Found book in Goodreads: "${goodreadsData.title}" by ${goodreadsData.author || 'Unknown'}`);
        
        // Check for match
        const titleMatch = result.title.toLowerCase().includes(goodreadsData.title.toLowerCase()) || 
                         goodreadsData.title.toLowerCase().includes(result.title.toLowerCase());
        const authorMatch = !result.author || !goodreadsData.author || 
                          result.author.toLowerCase().includes(goodreadsData.author.toLowerCase()) || 
                          goodreadsData.author.toLowerCase().includes(result.author.toLowerCase());
        
        // Add verification data
        if (titleMatch && authorMatch) {
          console.log(`[${requestId}] Goodreads data matches - verification confirmed`);
          result.verification = {
            status: "verified",
            confidence: 0.9,
            sources: result.verification?.sources || [],
            message: "Book information verified across multiple sources"
          };
          
          // Add Goodreads as source
          if (!result.verification.sources.includes("Goodreads")) {
            result.verification.sources.push("Goodreads");
          }
        } else {
          console.log(`[${requestId}] Goodreads data doesn't match - Titles: ${titleMatch}, Authors: ${authorMatch}`);
          result.verification = {
            status: "unverified",
            confidence: 0.5,
            sources: result.verification?.sources || [],
            message: "Book information could not be fully verified across sources"
          };
        }
      } else {
        console.log(`[${requestId}] Goodreads data not available: ${goodreadsData.error}`);
        // Handle API quota exceeded case gracefully
        if (goodreadsData.error.includes("403") || goodreadsData.error.includes("quota")) {
          result.verification = {
            status: "quota_exceeded",
            confidence: result.verification?.sources.includes("DNB") ? 0.8 : 0.6,
            sources: result.verification?.sources || [],
            message: "Cross-source verification temporarily unavailable - API quota exceeded"
          };
        }
      }
    } catch (error: any) {
      console.log(`[${requestId}] Error in Goodreads verification:`, error?.message || String(error));
    }
  }

  // STEP 4: Fill missing fields with OpenAI
  if (result.title || result.author || params.isbn) {
    console.log(`[${requestId}] Using OpenAI to enhance book metadata and fill missing fields`);
    try {
      const openAiRequest = {
        isbn: result.isbn || params.isbn || null,
        title: result.title || params.title || "",
        author: result.author || params.author || "",
        language: result.language || language,
        coverImageData: result.coverImageData || params.coverImageData
      };
      
      // Add available fields for context
      if (result.subtitle) openAiRequest.subtitle = result.subtitle;
      if (result.publisher) openAiRequest.publisher = result.publisher;
      if (result.publishedYear) openAiRequest.publishedYear = result.publishedYear;
      if (result.pageCount) openAiRequest.pageCount = result.pageCount;
      
      // Process with OpenAI
      const openAiResult = await processWithOpenAI(openAiRequest);
      
      // Merge OpenAI data for fields not present from other sources
      Object.keys(openAiResult).forEach(key => {
        if (openAiResult[key as keyof typeof openAiResult] !== undefined && 
            openAiResult[key as keyof typeof openAiResult] !== null &&
            (result[key as keyof typeof result] === undefined || 
            result[key as keyof typeof result] === null)) {
          result[key as keyof typeof result] = openAiResult[key as keyof typeof openAiResult];
        }
      });
      
      // Always use OpenAI for these fields even if present from other sources
      if (openAiResult.summary) result.summary = openAiResult.summary;
      if (openAiResult.themes) result.themes = openAiResult.themes;
      if (openAiResult.genres && (!result.genres || result.genres.length === 0)) {
        result.genres = openAiResult.genres;
      }
      if (openAiResult.ASB) result.ASB = openAiResult.ASB;
      if (openAiResult.readingLevel) result.readingLevel = openAiResult.readingLevel;
      if (openAiResult.interestCategory) result.interestCategory = openAiResult.interestCategory;
      
      // Add OpenAI as source
      if (!result.verification?.sources.includes("OpenAI")) {
        result.verification!.sources.push("OpenAI");
      }
    } catch (error: any) {
      console.log(`[${requestId}] Error in OpenAI enhancement:`, error?.message || String(error));
    }
  }

  // If no verification status was set, set one based on available sources
  if (result.verification?.status === "pending") {
    if (result.verification.sources.includes("DNB") && result.verification.sources.includes("Google Books")) {
      result.verification.status = "verified";
      result.verification.confidence = 0.8;
      result.verification.message = "Book information verified with DNB and Google Books";
    } else if (result.verification.sources.includes("DNB")) {
      result.verification.status = "partially_verified";
      result.verification.confidence = 0.7;
      result.verification.message = "Book information from DNB (primary source)";
    } else if (result.verification.sources.includes("Google Books")) {
      result.verification.status = "partially_verified";
      result.verification.confidence = 0.6;
      result.verification.message = "Book information from Google Books (secondary source)";
    } else if (result.verification.sources.includes("OpenAI") && (result.title || result.author)) {
      result.verification.status = "ai_generated";
      result.verification.confidence = 0.3;
      result.verification.message = "Book information generated by AI, not verified with authoritative sources";
    } else {
      result.verification.status = "unknown";
      result.verification.confidence = 0;
      result.verification.message = "Book information could not be verified";
    }
  }

  // Log the field sources for debugging
  console.log(`[${requestId}] BIBLIOGRAPHIC DATA CHECK from final verification result:`);
  console.log(`- Title: "${result.title || 'N/A'}"`);
  console.log(`- Subtitle: "${result.subtitle || 'N/A'}"`);
  console.log(`- Main Author: "${result.author || 'N/A'}"`);
  console.log(`- Statement of Responsibility: ${result.statementOfResponsibility || 'N/A'}`);
  console.log(`- Edition: ${result.edition || 'N/A'}`);
  console.log(`- Location: ${result.location || 'N/A'}`);
  console.log(`- Publisher: ${result.publisher || 'N/A'}`);
  console.log(`- Published Year: ${result.publishedYear || 'N/A'}`);
  console.log(`- Page Count: ${result.pageCount || 'N/A'}`);
  console.log(`- Dimensions: ${result.dimensions || 'N/A'}`);
  console.log(`- ISBN: ${result.isbn || 'N/A'}`);
  console.log(`- Binding: ${result.binding || 'N/A'}`);
  console.log(`- Price: ${result.price || 'N/A'}`);
  console.log(`- Language: ${result.language || 'N/A'}`);
  console.log(`- Genres: ${result.genres ? JSON.stringify(result.genres) : 'None'}`);
  console.log(`- Summary: ${result.summary ? (result.summary.substring(0, 50) + '...') : 'N/A'}`);
  
  const fieldSources: Record<string, string> = {};
  if (dnbData && googleBooksData) {
    for (const key of Object.keys(result)) {
      if (key === "verification" || key === "coverImageData") continue;
      
      if (dnbData[key as keyof typeof dnbData] !== undefined && 
          dnbData[key as keyof typeof dnbData] !== null &&
          googleBooksData[key as keyof typeof googleBooksData] !== undefined && 
          googleBooksData[key as keyof typeof googleBooksData] !== null) {
        fieldSources[key] = 'Both';
      } else if (dnbData[key as keyof typeof dnbData] !== undefined && 
                 dnbData[key as keyof typeof dnbData] !== null) {
        fieldSources[key] = 'DNB';
      } else if (googleBooksData[key as keyof typeof googleBooksData] !== undefined && 
                 googleBooksData[key as keyof typeof googleBooksData] !== null) {
        fieldSources[key] = 'Google Books';
      } else {
        fieldSources[key] = 'OpenAI';
      }
    }
  } else {
    // Simplified source tracking if we don't have both DNB and Google Books
    for (const key of Object.keys(result)) {
      if (key === "verification" || key === "coverImageData") continue;
      
      if (result.verification?.sources.includes("DNB") && 
          dnbData && 
          dnbData[key as keyof typeof dnbData] !== undefined && 
          dnbData[key as keyof typeof dnbData] !== null) {
        fieldSources[key] = 'DNB';
      } else if (result.verification?.sources.includes("Google Books") && 
                googleBooksData && 
                googleBooksData[key as keyof typeof googleBooksData] !== undefined && 
                googleBooksData[key as keyof typeof googleBooksData] !== null) {
        fieldSources[key] = 'Google Books';
      } else {
        fieldSources[key] = 'OpenAI';
      }
    }
  }
  
  console.log(`[${requestId}] Field data sources:`, fieldSources);
  console.log(`[${requestId}] Successfully processed complete book data with verification status: ${result.verification.status}`);
  
  return result;
}

/**
 * Verify a book using ISBN as the primary identifier (most reliable method)
 */
export async function verifyBookByIsbn(isbn: string, language: string = "de"): Promise<Partial<Book>> {
  return verifyBookData({ isbn, language });
}

/**
 * Verify a book using title and author
 */
export async function verifyBookByTitleAuthor(
  title: string, 
  author: string = "", 
  language: string = "de"
): Promise<Partial<Book>> {
  return verifyBookData({ title, author, language });
}

/**
 * Verify a book using cover image
 */
export async function verifyBookByCover(
  imageBase64: string, 
  language: string = "de"
): Promise<Partial<Book>> {
  return verifyBookData({ coverImageData: imageBase64, language });
}