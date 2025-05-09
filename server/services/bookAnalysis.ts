import { Book, BookAnalysisRequest } from "@shared/schema";
import { getCompleteBookByISBN } from "./googleBooks";
import { apiLogger } from "../utils/logger";
import { processBookAnalysis as processBookAnalysisWithOpenAI } from "./openai";

/**
 * Process a book analysis request with clean logic:
 * 1. If ISBN is provided, use only Perplexity with the ISBN
 * 2. Only fall back to OpenAI if Perplexity fails
 * 3. Return null/empty fields if both APIs fail
 */
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest
): Promise<Partial<Book>> {
  // Create a unique ID for this analysis request for logging
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  console.log(`[${analysisId}] Starting book analysis with request:`, {
    hasISBN: !!analysisRequest.isbn,
    hasTitle: !!analysisRequest.title,
    hasAuthor: !!analysisRequest.author,
    hasCoverImage: !!analysisRequest.coverImageData,
    language: analysisRequest.language
  });

  // If ISBN is provided, use that specifically and ignore any other fields
  if (analysisRequest.isbn) {
    const isbn = analysisRequest.isbn;
    console.log(`[${analysisId}] ISBN found: ${isbn} - Using clean ISBN-only lookup`);
    
    try {
      // First attempt: use Google Books API with the ISBN
      console.log(`[${analysisId}] Attempting to process book with Google Books API using ISBN only`);
      const googleBooksResult = await getCompleteBookByISBN(isbn, analysisRequest.language || "de");
      
      // If Google Books API returned valid data, use it
      if (googleBooksResult && googleBooksResult.title && googleBooksResult.author) {
        console.log(`[${analysisId}] Successfully processed book with Google Books API: "${googleBooksResult.title}" by ${googleBooksResult.author}`);
        return googleBooksResult;
      }
      
      // If Google Books API failed or returned incomplete data, fall back to OpenAI
      console.log(`[${analysisId}] Google Books didn't return valid data, falling back to OpenAI with ISBN only`);
      
      // Create a clean request for OpenAI with only the ISBN
      const openAiRequest: BookAnalysisRequest = {
        isbn,
        title: "",
        author: "",
        language: analysisRequest.language || "de"
      };
      
      const openAIResult = await processBookAnalysisWithOpenAI(openAiRequest);
      
      // Validate the OpenAI result
      if (openAIResult && openAIResult.title && openAIResult.author) {
        // Ensure the ISBN matches
        if (openAIResult.isbn) {
          const normalizedRequestISBN = isbn.replace(/[-\s]/g, '');
          const normalizedResultISBN = openAIResult.isbn.replace(/[-\s]/g, '');
          
          if (normalizedRequestISBN !== normalizedResultISBN) {
            console.log(`[${analysisId}] ERROR: OpenAI returned a book with a different ISBN. Requested: ${isbn}, Received: ${openAIResult.isbn}`);
            
            // Return minimal data
            return {
              isbn,
              title: null as unknown as string,
              author: null as unknown as string
            } as Partial<Book>;
          }
        }
        
        console.log(`[${analysisId}] Successfully processed book with OpenAI fallback: "${openAIResult.title}" by ${openAIResult.author}`);
        return openAIResult;
      }
      
      // If both Google Books and OpenAI failed, return minimal data with just the ISBN
      console.log(`[${analysisId}] Both Google Books and OpenAI failed to return valid data for ISBN: ${isbn}`);
      return {
        isbn,
        title: null as unknown as string,
        author: null as unknown as string
      } as Partial<Book>;
      
    } catch (error: any) {
      console.log(`[${analysisId}] Error during book analysis:`, error?.message || String(error));
      apiLogger.logError("BookAnalysis", {
        error: "Book analysis failed",
        message: error?.message || "Unknown error",
        isbn,
        analysisId
      });
      
      // Return minimal data with just the ISBN
      return {
        isbn,
        title: null as unknown as string,
        author: null as unknown as string
      } as Partial<Book>;
    }
  } 
  // Handle non-ISBN cases (title/author)
  else if (analysisRequest.title || analysisRequest.author) {
    console.log(`[${analysisId}] No ISBN provided, using title/author lookup with Perplexity`);
    
    try {
      // Try OpenAI for non-ISBN cases
      console.log(`[${analysisId}] Processing book with OpenAI using title/author`);
      const openAIResult = await processBookAnalysisWithOpenAI(analysisRequest);
      
      if (openAIResult && openAIResult.title) {
        console.log(`[${analysisId}] Successfully processed book with OpenAI: "${openAIResult.title}" by ${openAIResult.author}`);
        return openAIResult;
      }
      
      // If OpenAI failed, return minimal data with just title/author
      console.log(`[${analysisId}] OpenAI failed to return valid data for title/author`);
      return {
        title: analysisRequest.title || null as unknown as string,
        author: analysisRequest.author || null as unknown as string
      } as Partial<Book>;
      
    } catch (error: any) {
      console.log(`[${analysisId}] Error during book analysis:`, error?.message || String(error));
      apiLogger.logError("BookAnalysis", {
        error: "Book analysis failed",
        message: error?.message || "Unknown error",
        title: analysisRequest.title,
        author: analysisRequest.author,
        analysisId
      });
      
      // Return minimal data with just title/author
      return {
        title: analysisRequest.title || null as unknown as string,
        author: analysisRequest.author || null as unknown as string
      } as Partial<Book>;
    }
  }
  
  // Not enough information provided
  console.log(`[${analysisId}] Insufficient information for book analysis`);
  return {} as Partial<Book>;
}

/**
 * Function to get book information by ISBN with clean fallback logic
 */
export async function getBookByISBNWithFallback(isbn: string, language: string = "de"): Promise<Partial<Book> | null> {
  const lookupId = `isbn_lookup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book by ISBN: ${isbn}`);
  
  try {
    // First attempt: use Google Books API with the ISBN
    console.log(`[${lookupId}] Attempting to get book with Google Books API using ISBN`);
    const googleBooksResult = await getCompleteBookByISBN(isbn, language);
    
    // If Google Books API returned valid data, use it
    if (googleBooksResult && googleBooksResult.title && googleBooksResult.author) {
      console.log(`[${lookupId}] Successfully retrieved book with Google Books API: "${googleBooksResult.title}" by ${googleBooksResult.author}`);
      return googleBooksResult;
    }
    
    // If Google Books API failed or returned incomplete data, fall back to OpenAI
    console.log(`[${lookupId}] Google Books didn't return valid data, falling back to OpenAI with ISBN only`);
    
    // Create a clean request for OpenAI with only the ISBN
    const request: BookAnalysisRequest = {
      isbn,
      title: "",
      author: "",
      language
    };
    
    const openAIResult = await processBookAnalysisWithOpenAI(request);
    
    // Validate the OpenAI result
    if (openAIResult && openAIResult.title && openAIResult.author) {
      // Ensure the ISBN matches
      if (openAIResult.isbn) {
        const normalizedRequestISBN = isbn.replace(/[-\s]/g, '');
        const normalizedResultISBN = openAIResult.isbn.replace(/[-\s]/g, '');
        
        if (normalizedRequestISBN !== normalizedResultISBN) {
          console.log(`[${lookupId}] ERROR: OpenAI returned a book with a different ISBN. Requested: ${isbn}, Received: ${openAIResult.isbn}`);
          
          // Return minimal data
          return {
            isbn,
            title: null as unknown as string,
            author: null as unknown as string
          } as Partial<Book>;
        }
      }
      
      console.log(`[${lookupId}] Successfully retrieved book with OpenAI fallback: "${openAIResult.title}" by ${openAIResult.author}`);
      return openAIResult;
    }
    
    // If both Google Books and OpenAI failed, return minimal data with just the ISBN
    console.log(`[${lookupId}] Both Google Books and OpenAI failed to return valid data for ISBN: ${isbn}`);
    return {
      isbn,
      title: null as unknown as string,
      author: null as unknown as string
    } as Partial<Book>;
    
  } catch (error: any) {
    console.log(`[${lookupId}] Error during book lookup:`, error?.message || String(error));
    
    // Return minimal data with just the ISBN
    return {
      isbn,
      title: null as unknown as string,
      author: null as unknown as string
    } as Partial<Book>;
  }
}

/**
 * Function to enrich existing book metadata
 */
export async function enrichBookMetadata(bookData: Partial<Book>): Promise<Partial<Book>> {
  // If we have an ISBN, use it for enrichment
  if (bookData.isbn) {
    console.log(`Enriching book metadata using ISBN: ${bookData.isbn}`);
    
    // Get complete data using the ISBN
    const enrichedData = await getBookByISBNWithFallback(bookData.isbn, bookData.language || "de");
    
    // If we got valid enriched data, merge it with original data (preserving original fields)
    if (enrichedData && enrichedData.title) {
      console.log(`Successfully enriched book metadata for "${enrichedData.title}"`);
      
      // Merge the data, prioritizing original explicit values
      return {
        ...enrichedData,
        ...Object.fromEntries(
          Object.entries(bookData).filter(([_, value]) => value !== null && value !== undefined)
        )
      };
    }
  }
  
  // If we couldn't enrich with ISBN, try using title and author
  if (bookData.title && bookData.author) {
    console.log(`Enriching book metadata using title/author: "${bookData.title}" by ${bookData.author}`);
    
    try {
      // Create a request for analysis
      const request: BookAnalysisRequest = {
        title: bookData.title,
        author: bookData.author,
        isbn: null,
        language: bookData.language || "de"
      };
      
      // Use OpenAI for enrichment with title/author
      const enrichedData = await processBookAnalysisWithOpenAI(request);
      
      // If we got valid enriched data, merge it with original data (preserving original fields)
      if (enrichedData && enrichedData.title) {
        console.log(`Successfully enriched book metadata for "${enrichedData.title}"`);
        
        // Merge the data, prioritizing original explicit values
        return {
          ...enrichedData,
          ...Object.fromEntries(
            Object.entries(bookData).filter(([_, value]) => value !== null && value !== undefined)
          )
        };
      }
    } catch (error: any) {
      console.log(`Error enriching book metadata:`, error?.message || String(error));
    }
  }
  
  // If enrichment failed, return the original data
  console.log(`Could not enrich book metadata, returning original data`);
  return bookData;
}

/**
 * Get similar books recommendations
 */
export async function getSimilarBooks(book: Partial<Book>): Promise<any[]> {
  // Import on demand to prevent circular dependencies
  const { findSimilarBooks } = await import("./perplexity");
  
  if (!book.title || !book.author) {
    console.log(`Cannot find similar books without title and author`);
    return [];
  }
  
  try {
    console.log(`Finding similar books for "${book.title}" by ${book.author}`);
    const similarBooks = await findSimilarBooks(book, book.language || "de");
    
    if (similarBooks && similarBooks.length > 0) {
      console.log(`Found ${similarBooks.length} similar books`);
      return similarBooks;
    }
    
    // Fall back to OpenAI
    console.log(`No similar books found with Perplexity, falling back to OpenAI`);
    const { searchSimilarBooks } = await import("./openai");
    return await searchSimilarBooks(book);
  } catch (error: any) {
    console.log(`Error finding similar books:`, error?.message || String(error));
    
    // Try OpenAI as fallback
    try {
      const { searchSimilarBooks } = await import("./openai");
      return await searchSimilarBooks(book);
    } catch (fallbackError: any) {
      console.log(`OpenAI fallback also failed:`, fallbackError?.message || String(fallbackError));
      return [];
    }
  }
}