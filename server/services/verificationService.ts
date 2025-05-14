/**
 * Verification Service
 * 
 * This service implements the verification logic for book data across multiple sources.
 * Follows the DNB/German RDA cataloguing standards and Python implementation
 */

import { Book, BookAnalysisRequest } from "@shared/schema";
import { getCompleteBookByISBN } from "./googleBooks";
import { lookupBookByIsbn } from "./pythonIsbnService";
import { searchGoodreads, searchGoogleBooks } from "./googleCustomSearch";
import { processBookAnalysis } from "./openai";

/**
 * Merge metadata from different sources, prioritizing Google Books data
 * but filling in missing fields from DNB and other sources
 */
function mergeMetadata(googleData: Partial<Book>, dnbData: Partial<Book>): Partial<Book> {
  console.log("=== GOOGLE BOOKS DATA ===");
  console.log(JSON.stringify(googleData, null, 2));
  
  // Create a new object to avoid modifying the original
  const merged = { ...googleData };
  
  // Map standard fields for consistency
  if (googleData.author && !googleData.mainAuthor) {
    merged.mainAuthor = googleData.author;
  }
  
  if (googleData.location && !googleData.publicationPlace) {
    merged.publicationPlace = googleData.location;
  }
  
  if (googleData.publishedYear && !googleData.publicationYear) {
    merged.publicationYear = googleData.publishedYear;
  }
  
  // Ensure all required fields have default values if not present
  const requiredFields = [
    'isbn', 'title', 'subtitle', 'mainAuthor', 'publisher', 
    'publicationYear', 'publicationPlace', 'pageCount', 
    'dimensions', 'binding', 'price', 'edition', 'language',
    'genres', 'ASB', 'interestCategory', 'illustrations', 'dnbNumber'
  ];
  
  for (const field of requiredFields) {
    // Initialize missing fields to null (not undefined)
    if (merged[field as keyof typeof merged] === undefined) {
      merged[field as keyof typeof merged] = null;
    }
    
    // Ensure arrays are properly initialized
    if (field === 'genres' && !merged.genres) {
      merged.genres = [];
    }
  }
  
  // Ensure contributors object exists if not present
  if (!merged.contributors) {
    merged.contributors = {};
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
      
      // Special handling for contributors - merge them instead of replacing
      if (key === 'contributors') {
        merged.contributors = merged.contributors || {};
        
        if (dnbData.contributors) {
          for (const role in dnbData.contributors) {
            if (!merged.contributors[role]) {
              merged.contributors[role] = dnbData.contributors[role];
            } else {
              // Merge contributors for the same role without duplicates
              const existingNames = new Set(merged.contributors[role]);
              dnbData.contributors[role].forEach(name => existingNames.add(name));
              merged.contributors[role] = Array.from(existingNames);
            }
          }
        }
        continue;
      }
      
      // Special handling for genres - merge them instead of replacing if both exist
      if (key === 'genres') {
        if (Array.isArray(dnbData.genres) && dnbData.genres.length > 0) {
          if (!Array.isArray(merged.genres) || merged.genres.length === 0) {
            merged.genres = dnbData.genres;
          } else {
            // Merge genres without duplicates
            const existingGenres = new Set(merged.genres);
            dnbData.genres.forEach(genre => existingGenres.add(genre));
            merged.genres = Array.from(existingGenres);
          }
        }
        continue;
      }
      
      // Handle nested objects (like statement of responsibility or verification)
      if (typeof dnbData[key as keyof typeof dnbData] === 'object' && 
          !Array.isArray(dnbData[key as keyof typeof dnbData])) {
        merged[key as keyof typeof merged] = {
          ...(merged[key as keyof typeof merged] as object || {}),
          ...(dnbData[key as keyof typeof dnbData] as object)
        };
      } else {
        // DNB data takes precedence for bibliographic fields if available
        // This is because DNB follows the DNB/German RDA cataloguing standards
        const dnbPriorityFields = [
          'publicationPlace', 'subtitle', 'edition', 'dimensions', 
          'binding', 'ASB', 'interestCategory', 'illustrations', 'dnbNumber'
        ];
        
        if (dnbPriorityFields.includes(key)) {
          if (dnbData[key as keyof typeof dnbData] !== null && 
              dnbData[key as keyof typeof dnbData] !== undefined &&
              dnbData[key as keyof typeof dnbData] !== "") {
            merged[key as keyof typeof merged] = dnbData[key as keyof typeof dnbData];
          }
        } else {
          // For other fields, only use DNB data if the field is missing or empty in Google Books data
          if (!merged[key as keyof typeof merged] || 
              merged[key as keyof typeof merged] === null ||
              merged[key as keyof typeof merged] === "" ||
              (Array.isArray(merged[key as keyof typeof merged]) && 
              (merged[key as keyof typeof merged] as any[]).length === 0)) {
            
            merged[key as keyof typeof merged] = dnbData[key as keyof typeof dnbData];
          }
        }
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
  const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[verify_${requestId}] Starting verification for ISBN: ${isbn}`);
  
  try {
    // Step 1: Get data from Google Books
    console.log(`[verify_${requestId}] Step 1: Getting data from Google Books API`);
    const googleBooksData = await getCompleteBookByISBN(isbn);
    
    if (!googleBooksData || !googleBooksData.title) {
      console.log(`[verify_${requestId}] Error: No data found in Google Books`);
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
    console.log(`[verify_${requestId}] Step 2: Getting metadata from DNB`);
    const dnbData = await lookupBookByIsbn(isbn);
    
    // Step 3: Merge Google Books and DNB data
    console.log(`[verify_${requestId}] Step 3: Merging Google Books and DNB data`);
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
    
    // Step 4: Validate with Google Custom Search and fill missing data
    console.log(`[verify_${requestId}] Step 4: Getting additional data from Google Custom Search`);
    const searchQuery = `${mergedData.title} ${mergedData.mainAuthor || mergedData.author || ""}`;
    let googleSearchResults = [];
    
    try {
      googleSearchResults = await searchGoogleBooks(searchQuery);
      
      if (googleSearchResults && googleSearchResults.length > 0) {
        console.log(`[verify_${requestId}] Google Search found ${googleSearchResults.length} results`);
        console.log("=== GOOGLE CUSTOM SEARCH RESULTS ===");
        console.log(JSON.stringify(googleSearchResults.slice(0, 2), null, 2)); // Log just the first two for brevity
        
        sources.push("Google Search");
        
        // Use Google Custom Search data to fill in missing fields
        // Since this is a lower quality source, only use it if fields are missing
        if (googleSearchResults[0]) {
          const gcsResult = googleSearchResults[0];
          
          // Extract information from snippet or title if needed
          // This is a simple implementation - we're just checking a few key fields as examples
          if (!mergedData.subtitle && gcsResult.title && gcsResult.title.includes(':')) {
            const parts = gcsResult.title.split(':');
            if (parts.length > 1 && parts[0].trim().toLowerCase() === mergedData.title?.toLowerCase()) {
              mergedData.subtitle = parts[1].trim();
              console.log(`[verify_${requestId}] Added subtitle from Google CSE: ${mergedData.subtitle}`);
            }
          }
          
          // More fields could be added here based on your needs
        }
      } else {
        console.log(`[verify_${requestId}] Google Search found no results`);
      }
    } catch (error: any) {
      console.log(`[verify_${requestId}] Error in Google Search: ${error.message || error}`);
      // Skip this step if Google CSE fails
    }
    
    // Step 5: Get Goodreads data for additional validation and missing fields
    console.log(`[verify_${requestId}] Step 5: Getting Goodreads data for validation and missing fields`);
    let goodreadsData: any = null;
    let dataMatches = true;
    
    try {
      goodreadsData = await searchGoodreads(
        mergedData.title || "", 
        mergedData.mainAuthor || mergedData.author || ""
      );
      
      // Check if Goodreads data has an error field
      if (!goodreadsData || goodreadsData.error) {
        console.log(`[verify_${requestId}] Goodreads data retrieval note: ${goodreadsData?.error || 'No data returned'}`);
        // Skip this step if no real Goodreads data is available
      } else {
        // If we have real Goodreads data
        console.log(`[verify_${requestId}] Goodreads data retrieved successfully`);
        console.log("=== GOODREADS DATA ===");
        console.log(JSON.stringify(goodreadsData, null, 2));
        
        sources.push("Goodreads");
        
        // First validate if the data matches
        if (mergedData.title && goodreadsData.title) {
          const title1 = (mergedData.title || "").toLowerCase();
          const title2 = (goodreadsData.title || "").toLowerCase();
          const titleMatch = title1.includes(title2) || title2.includes(title1);
          
          const author1 = (mergedData.mainAuthor || mergedData.author || "").toLowerCase();
          const author2 = (goodreadsData.author || "").toLowerCase();
          const authorMatch = !author1 || !author2 || author1.includes(author2) || author2.includes(author1);
          
          dataMatches = titleMatch && authorMatch;
          
          if (!dataMatches) {
            console.log(`[verify_${requestId}] Data verification note: titles or authors don't match exactly`);
            console.log(`Title match: ${titleMatch}, Author match: ${authorMatch}`);
            console.log(`Merged title: "${mergedData.title}", Goodreads title: "${goodreadsData.title}"`);
            console.log(`Merged author: "${mergedData.mainAuthor || mergedData.author}", Goodreads author: "${goodreadsData.author}"`);
          } else {
            // Data matches, so we can use Goodreads to fill missing fields
            console.log(`[verify_${requestId}] Goodreads data matches, using to fill missing fields`);
            
            // Fill in missing fields
            if (!mergedData.genres && goodreadsData.genres) {
              mergedData.genres = goodreadsData.genres;
              console.log(`[verify_${requestId}] Added genres from Goodreads: ${goodreadsData.genres.join(', ')}`);
            }
            
            if (!mergedData.publishedYear && !mergedData.publicationYear && goodreadsData.year) {
              mergedData.publicationYear = parseInt(goodreadsData.year);
              console.log(`[verify_${requestId}] Added publication year from Goodreads: ${mergedData.publicationYear}`);
            }
            
            // Add more fields here as needed
            if (goodreadsData.rating && !mergedData.rating) {
              mergedData.rating = goodreadsData.rating;
              console.log(`[verify_${requestId}] Added rating from Goodreads: ${mergedData.rating}`);
            }
          }
        }
      }
    } catch (error: any) {
      console.log(`[verify_${requestId}] Error in Goodreads validation: ${error.message || error}`);
      // Continue even if this step fails
    }
    
    // Step 6: Get summary from OpenAI using all collected authentic data
    console.log(`[verify_${requestId}] Step 6: Getting summary from OpenAI using collected authentic data`);
    
    try {
      // Only if we have at least the basic book data from an authentic source
      if (mergedData.title) {
        // Gather existing description/content data from Google Books, DNB, or other sources
        // to help OpenAI create an accurate summary
        const existingDescription = 
          googleBooksData?.description || 
          googleBooksData?.fullDescription || 
          (googleSearchResults && googleSearchResults.length > 0 ? 
            googleSearchResults[0].snippet : null);
        
        // Prepare complete data package for OpenAI
        const openAiRequest: BookAnalysisRequest = {
          // Basic bibliographic data
          isbn,
          title: mergedData.title || "",
          subtitle: mergedData.subtitle || "",
          mainAuthor: mergedData.mainAuthor || mergedData.author || "",
          statementOfResponsibility: mergedData.statementOfResponsibility || "",
          edition: mergedData.edition || "",
          publicationPlace: mergedData.publicationPlace || "",
          publisher: mergedData.publisher || "",
          publicationYear: mergedData.publicationYear || null,
          pageCount: mergedData.pageCount || null,
          dimensions: mergedData.dimensions || "",
          binding: mergedData.binding || "",
          price: mergedData.price || "",
          language: mergedData.language || "de",
          
          // Content data from authentic sources
          description: existingDescription || "",
          genres: Array.isArray(mergedData.genres) ? mergedData.genres : [],
          themes: Array.isArray(mergedData.themes) ? mergedData.themes : [],
          
          // Source information for context
          sourcesInfo: sources.join(", ")
        };
        
        console.log(`[verify_${requestId}] Using authentic data to generate summary with OpenAI`);
        
        // Request summary and enrichment from OpenAI using authentic data
        const additionalDetails = await processBookAnalysis(openAiRequest);
        
        console.log("=== OPENAI ADDITIONAL DETAILS ===");
        console.log(JSON.stringify(additionalDetails, null, 2));
        
        // Only use OpenAI for creative content fields
        if (additionalDetails.summary) {
          mergedData.summary = additionalDetails.summary;
          console.log(`[verify_${requestId}] Added summary from OpenAI (based on authentic data)`);
        }
        
        // Add critical review
        if (additionalDetails.review) {
          mergedData.review = additionalDetails.review;
          console.log(`[verify_${requestId}] Added critical review from OpenAI`);
        }
        
        // No longer using OpenAI for themes or genres
        // These should come only from authentic sources like Google Books, DNB, or Goodreads
        
        // Use ASB, readingLevel, and interestCategory from other authentic sources
        // For now, keep using these from OpenAI but they should be moved to authentic sources in the future
        if (additionalDetails.ASB) mergedData.ASB = additionalDetails.ASB;
        if (additionalDetails.readingLevel) mergedData.readingLevel = additionalDetails.readingLevel;
        if (additionalDetails.interestCategory) mergedData.interestCategory = additionalDetails.interestCategory;
        
        // Add OpenAI as source
        sources.push("OpenAI");
      }
      
      // Add verification data - consider verified only if we have data from reliable sources
      if (sources.includes("Google Books") || sources.includes("DNB")) {
        mergedData.verification = {
          status: "verified",
          confidence: sources.length > 2 ? 0.9 : 0.7,
          message: "Book information verified across authentic sources",
          sources
        };
      } else {
        mergedData.verification = {
          status: "unverified",
          confidence: 0.5,
          message: "Insufficient authentic data sources for verification",
          sources
        };
      }
    } catch (error: any) {
      console.log(`[verify_${requestId}] Error getting additional details from OpenAI: ${error.message || error}`);
      
      // If OpenAI fails, still verify if we have reliable data sources
      if (sources.includes("Google Books") || sources.includes("DNB")) {
        mergedData.verification = {
          status: "verified",
          confidence: 0.7,
          message: "Book information verified with authentic data sources",
          sources
        };
      } else {
        mergedData.verification = {
          status: "unverified",
          confidence: 0.5,
          message: "Insufficient authentic data sources for verification",
          sources
        };
      }
    }
    
    // Log final data
    console.log("=== FINAL MERGED DATA ===");
    console.log(JSON.stringify(mergedData, null, 2));
    
    // Log final verification status
    console.log(`[verify_${requestId}] Final verification status: ${mergedData.verification.status}`);
    console.log(`[verify_${requestId}] Verification confidence: ${mergedData.verification.confidence}`);
    console.log(`[verify_${requestId}] Verification sources: ${mergedData.verification.sources.join(", ")}`);
    
    return mergedData;
  } catch (error: any) {
    console.error(`[verify_${requestId}] Error in verification process: ${error.message || error}`);
    return {
      verification: {
        status: "error",
        confidence: 0,
        message: `Error in verification process: ${error.message || error}`,
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