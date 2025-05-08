import { Book, BookAnalysisRequest } from "@shared/schema";
import { processBookAnalysisWithPerplexity } from "./perplexity";
import { processBookAnalysis as processBookAnalysisWithOpenAI } from "./openai";
import { enrichBookMetadata as enrichBookMetadataWithOpenAI } from "./openai";
import { apiLogger } from "../utils/logger";

// Main function to process book analysis with fallback strategy
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest
): Promise<Partial<Book>> {
  // Create a unique ID for this analysis request for logging
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  console.log(`[${analysisId}] ProcessBookAnalysis input:`, {
    title: analysisRequest.title,
    author: analysisRequest.author,
    hasCoverImage: !!analysisRequest.coverImageData,
    isbn: analysisRequest.isbn,
    language: analysisRequest.language
  });

  // If we have an ISBN, only use that for lookup - discard any potentially incorrect title/author
  const hasISBN = !!analysisRequest.isbn;
  let cleanedRequest: BookAnalysisRequest;
  
  if (hasISBN) {
    // When we have an ISBN, ignore any other identifying information to prevent conflicts
    cleanedRequest = {
      ...analysisRequest,
      title: '',  // Clear title to avoid using incorrect data
      author: '', // Clear author to avoid using incorrect data
    };
    console.log(`[${analysisId}] Using ISBN only for lookup: ${analysisRequest.isbn}`);
  } else {
    // If no ISBN, use provided title and author
    cleanedRequest = analysisRequest;
  }

  try {
    // First, try using Perplexity API with clean request
    console.log(`[${analysisId}] Attempting to process book analysis with Perplexity`);
    const perplexityResult = await processBookAnalysisWithPerplexity(cleanedRequest);
    
    // If Perplexity returned valid data with title and author, use it
    if (perplexityResult && perplexityResult.title && perplexityResult.author) {
      console.log(`[${analysisId}] Successfully processed book analysis with Perplexity`);
      return perplexityResult;
    }
    
    // If Perplexity failed or returned incomplete data, fall back to OpenAI with clean request
    console.log(`[${analysisId}] Perplexity processing failed or returned incomplete data, falling back to OpenAI`);
    const openAIResult = await processBookAnalysisWithOpenAI(cleanedRequest);
    
    // Validate that OpenAI results match ISBN if provided
    if (hasISBN && openAIResult && openAIResult.isbn) {
      const normalizedRequestISBN = analysisRequest.isbn!.replace(/[-\s]/g, '');
      const normalizedResultISBN = openAIResult.isbn.replace(/[-\s]/g, '');
      
      if (normalizedRequestISBN !== normalizedResultISBN) {
        console.log(`[${analysisId}] ERROR: OpenAI returned a book with a different ISBN. Requested: ${analysisRequest.isbn}, Received: ${openAIResult.isbn}`);
        // Return a minimal result with the original ISBN but no potentially incorrect data
        // Cast to unknown first to avoid type issues
        return {
          isbn: analysisRequest.isbn,
          title: null as unknown as string,
          author: null as unknown as string,
          summary: null as unknown as string
        } as Partial<Book>;
      }
    }
    
    console.log(`[${analysisId}] Completed book analysis with OpenAI fallback`);
    return openAIResult;
  } catch (error) {
    // Log the error
    apiLogger.logError("BookAnalysis", {
      error: "Book analysis processing failed",
      message: error.message,
      analysisId
    });
    
    // Try OpenAI as a last resort if not already tried, still with clean request
    try {
      console.log(`[${analysisId}] Error with Perplexity, falling back to OpenAI`);
      const openAIResult = await processBookAnalysisWithOpenAI(cleanedRequest);
      
      // Validate that OpenAI results match ISBN if provided
      if (hasISBN && openAIResult && openAIResult.isbn) {
        const normalizedRequestISBN = analysisRequest.isbn!.replace(/[-\s]/g, '');
        const normalizedResultISBN = openAIResult.isbn.replace(/[-\s]/g, '');
        
        if (normalizedRequestISBN !== normalizedResultISBN) {
          console.log(`[${analysisId}] ERROR: OpenAI returned a book with a different ISBN. Requested: ${analysisRequest.isbn}, Received: ${openAIResult.isbn}`);
          // Return a minimal result with the original ISBN but no potentially incorrect data
          // Cast to unknown first to avoid type issues
          return {
            isbn: analysisRequest.isbn,
            title: null as unknown as string,
            author: null as unknown as string,
            summary: null as unknown as string
          } as Partial<Book>;
        }
      }
      
      console.log(`[${analysisId}] Completed book analysis with OpenAI fallback after error`);
      return openAIResult;
    } catch (fallbackError) {
      apiLogger.logError("BookAnalysis", {
        error: "OpenAI fallback also failed",
        message: fallbackError.message,
        analysisId
      });
      
      // If both services fail with ISBN, return minimal book data rather than throwing
      if (hasISBN) {
        console.log(`[${analysisId}] Both services failed, returning minimal book data with just ISBN`);
        // Cast to unknown first to avoid type issues
        return {
          isbn: analysisRequest.isbn,
          title: null as unknown as string,
          author: null as unknown as string,
          summary: null as unknown as string
        } as Partial<Book>;
      }
      
      // If we don't have an ISBN, there's not much we can do
      throw fallbackError;
    }
  }
}

// Function to enrich book metadata (add missing fields)
export async function enrichBookMetadata(bookData: Partial<Book>): Promise<Partial<Book>> {
  try {
    // We'll use the same comprehensive analysis function instead of making separate calls
    // But prioritize user-entered fields
    
    console.log(`Enriching book metadata using consolidated processBookAnalysis function`);
    
    // Convert to BookAnalysisRequest format
    const analysisRequest: BookAnalysisRequest = {
      title: bookData.title || "",
      author: bookData.author || "",
      isbn: bookData.isbn || null,
      language: bookData.language || "de",
      isUserEntry: true
    };
    
    // Use the main processBookAnalysis function which already implements the fallback strategy
    const enrichedData = await processBookAnalysis(analysisRequest);
    
    // If we got a valid result, merge with original data (prioritizing user entries)
    if (enrichedData && enrichedData.title) {
      console.log(`Successfully enriched book metadata`);
      
      // Merge the results, prioritizing original bookData fields that were explicitly set
      return {
        ...enrichedData,
        ...Object.fromEntries(
          Object.entries(bookData).filter(([_, value]) => value !== null && value !== undefined)
        )
      };
    }
    
    // If everything failed, return original data
    return bookData;
  } catch (error) {
    // Log the error
    apiLogger.logError("BookEnrichment", {
      error: "Book metadata enrichment failed",
      message: error.message
    });
    
    // Return original data if everything fails
    return bookData;
  }
}

// Function to search books with fallback strategy
export async function searchBooks(params: any): Promise<{ items: any[] }> {
  try {
    // First, try using Perplexity API
    const { searchBooksWithPerplexity } = await import("./perplexity");
    const perplexityResults = await searchBooksWithPerplexity(params);
    
    // If Perplexity returned valid results, use them
    if (perplexityResults && perplexityResults.length > 0) {
      return { items: perplexityResults };
    }
    
    // If Perplexity failed or returned no results, fall back to OpenAI
    const { searchBooks: searchBooksWithOpenAI } = await import("./openai");
    return await searchBooksWithOpenAI(params);
  } catch (error) {
    // Log the error
    apiLogger.logError("BookSearch", {
      error: "Book search failed",
      message: error.message
    });
    
    // Try OpenAI as a last resort if not already tried
    try {
      const { searchBooks: searchBooksWithOpenAI } = await import("./openai");
      return await searchBooksWithOpenAI(params);
    } catch (fallbackError) {
      apiLogger.logError("BookSearch", {
        error: "OpenAI fallback also failed",
        message: fallbackError.message
      });
      return { items: [] };
    }
  }
}

// Function to get book by ISBN with fallback strategy
export async function getBookByISBN(isbn: string): Promise<any | null> {
  // Create a unique ID for this lookup request for logging
  const lookupId = `isbn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  console.log(`[${lookupId}] Looking up book by ISBN: ${isbn}`);
  
  try {
    // First, try using Perplexity API
    console.log(`[${lookupId}] Attempting to look up book with Perplexity`);
    const { getBookByISBNWithPerplexity } = await import("./perplexity");
    const perplexityResult = await getBookByISBNWithPerplexity(isbn);
    
    // If Perplexity returned valid data, validate ISBN and use it
    if (perplexityResult && perplexityResult.title) {
      // Validate that the returned ISBN matches the requested ISBN
      if (perplexityResult.isbn) {
        const normalizedRequestISBN = isbn.replace(/[-\s]/g, '');
        const normalizedResultISBN = perplexityResult.isbn.replace(/[-\s]/g, '');
        
        if (normalizedRequestISBN !== normalizedResultISBN) {
          console.log(`[${lookupId}] ERROR: Perplexity returned a book with a different ISBN. Requested: ${isbn}, Received: ${perplexityResult.isbn}`);
          // Continue to OpenAI as fallback
        } else {
          console.log(`[${lookupId}] Successfully retrieved book info from Perplexity`);
          return perplexityResult;
        }
      } else {
        console.log(`[${lookupId}] Successfully retrieved book info from Perplexity`);
        return perplexityResult;
      }
    }
    
    // If Perplexity failed or returned no data or wrong ISBN, fall back to OpenAI
    console.log(`[${lookupId}] Perplexity lookup failed or returned incorrect data, falling back to OpenAI`);
    const { getBookByISBN: getBookByISBNWithOpenAI } = await import("./openai");
    const openAIResult = await getBookByISBNWithOpenAI(isbn);
    
    // Validate that OpenAI result has a matching ISBN
    if (openAIResult && openAIResult.isbn) {
      const normalizedRequestISBN = isbn.replace(/[-\s]/g, '');
      const normalizedResultISBN = openAIResult.isbn.replace(/[-\s]/g, '');
      
      if (normalizedRequestISBN !== normalizedResultISBN) {
        console.log(`[${lookupId}] ERROR: OpenAI returned a book with a different ISBN. Requested: ${isbn}, Received: ${openAIResult.isbn}`);
        // Cast to unknown first to avoid type issues
        return {
          isbn: isbn,
          title: null as unknown as string,
          author: null as unknown as string
        };
      }
    }
    
    console.log(`[${lookupId}] Successfully retrieved book info from OpenAI`);
    return openAIResult;
  } catch (error) {
    // Log the error
    apiLogger.logError("GetBookByISBN", {
      error: "Book ISBN lookup failed",
      message: error.message,
      lookupId
    });
    
    // Try OpenAI as a last resort if not already tried
    try {
      console.log(`[${lookupId}] Error with Perplexity, falling back to OpenAI`);
      const { getBookByISBN: getBookByISBNWithOpenAI } = await import("./openai");
      const openAIResult = await getBookByISBNWithOpenAI(isbn);
      
      // Validate that OpenAI result has a matching ISBN
      if (openAIResult && openAIResult.isbn) {
        const normalizedRequestISBN = isbn.replace(/[-\s]/g, '');
        const normalizedResultISBN = openAIResult.isbn.replace(/[-\s]/g, '');
        
        if (normalizedRequestISBN !== normalizedResultISBN) {
          console.log(`[${lookupId}] ERROR: OpenAI returned a book with a different ISBN. Requested: ${isbn}, Received: ${openAIResult.isbn}`);
          // Cast to unknown first to avoid type issues
          return {
            isbn: isbn,
            title: null as unknown as string,
            author: null as unknown as string
          };
        }
      }
      
      console.log(`[${lookupId}] Successfully retrieved book info from OpenAI after error`);
      return openAIResult;
    } catch (fallbackError) {
      apiLogger.logError("GetBookByISBN", {
        error: "OpenAI fallback also failed",
        message: fallbackError.message,
        lookupId
      });
      
      // Return minimal data with just the ISBN when both services fail
      console.log(`[${lookupId}] Both services failed, returning minimal book data with just ISBN`);
      // Cast to unknown first to avoid type issues
      return {
        isbn: isbn,
        title: null as unknown as string,
        author: null as unknown as string
      };
    }
  }
}

// Function to search similar books with fallback strategy
export async function searchSimilarBooks(book: Partial<Book>): Promise<any[]> {
  try {
    // First, try using Perplexity API
    const { findSimilarBooksWithPerplexity } = await import("./perplexity");
    const perplexityResults = await findSimilarBooksWithPerplexity(book);
    
    // If Perplexity returned valid results, use them
    if (perplexityResults && perplexityResults.length > 0) {
      return perplexityResults;
    }
    
    // If Perplexity failed or returned no results, fall back to OpenAI
    const { searchSimilarBooks: searchSimilarBooksWithOpenAI } = await import("./openai");
    return await searchSimilarBooksWithOpenAI(book);
  } catch (error) {
    // Log the error
    apiLogger.logError("SimilarBooks", {
      error: "Similar books search failed",
      message: error.message
    });
    
    // Try OpenAI as a last resort if not already tried
    try {
      const { searchSimilarBooks: searchSimilarBooksWithOpenAI } = await import("./openai");
      return await searchSimilarBooksWithOpenAI(book);
    } catch (fallbackError) {
      apiLogger.logError("SimilarBooks", {
        error: "OpenAI fallback also failed",
        message: fallbackError.message
      });
      return [];
    }
  }
}