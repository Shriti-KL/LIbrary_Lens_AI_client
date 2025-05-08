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

  try {
    // First, try using Perplexity API
    console.log(`[${analysisId}] Attempting to process book analysis with Perplexity`);
    const perplexityResult = await processBookAnalysisWithPerplexity(analysisRequest);
    
    // If Perplexity returned valid data with title and author, use it
    if (perplexityResult && perplexityResult.title && perplexityResult.author) {
      console.log(`[${analysisId}] Successfully processed book analysis with Perplexity`);
      return perplexityResult;
    }
    
    // If Perplexity failed or returned incomplete data, fall back to OpenAI
    console.log(`[${analysisId}] Perplexity processing failed or returned incomplete data, falling back to OpenAI`);
    const openAIResult = await processBookAnalysisWithOpenAI(analysisRequest);
    
    console.log(`[${analysisId}] Completed book analysis with OpenAI fallback`);
    return openAIResult;
  } catch (error) {
    // Log the error
    apiLogger.logError("BookAnalysis", {
      error: "Book analysis processing failed",
      message: error.message,
      analysisId
    });
    
    // Try OpenAI as a last resort if not already tried
    try {
      console.log(`[${analysisId}] Error with Perplexity, falling back to OpenAI`);
      const openAIResult = await processBookAnalysisWithOpenAI(analysisRequest);
      
      console.log(`[${analysisId}] Completed book analysis with OpenAI fallback after error`);
      return openAIResult;
    } catch (fallbackError) {
      apiLogger.logError("BookAnalysis", {
        error: "OpenAI fallback also failed",
        message: fallbackError.message,
        analysisId
      });
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
  try {
    // First, try using Perplexity API
    const { getBookByISBNWithPerplexity } = await import("./perplexity");
    const perplexityResult = await getBookByISBNWithPerplexity(isbn);
    
    // If Perplexity returned valid data, use it
    if (perplexityResult && perplexityResult.title) {
      return perplexityResult;
    }
    
    // If Perplexity failed or returned no data, fall back to OpenAI
    const { getBookByISBN: getBookByISBNWithOpenAI } = await import("./openai");
    return await getBookByISBNWithOpenAI(isbn);
  } catch (error) {
    // Log the error
    apiLogger.logError("GetBookByISBN", {
      error: "Book ISBN lookup failed",
      message: error.message
    });
    
    // Try OpenAI as a last resort if not already tried
    try {
      const { getBookByISBN: getBookByISBNWithOpenAI } = await import("./openai");
      return await getBookByISBNWithOpenAI(isbn);
    } catch (fallbackError) {
      apiLogger.logError("GetBookByISBN", {
        error: "OpenAI fallback also failed",
        message: fallbackError.message
      });
      return null;
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