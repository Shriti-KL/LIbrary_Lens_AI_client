import { Book, BookAnalysisRequest } from "@shared/schema";
import { getCompleteBookByISBN } from "./googleBooks";
import { apiLogger } from "../utils/logger";
import { processBookAnalysis as processBookAnalysisWithOpenAI } from "./openai";
import { lookupBookByIsbn } from "./pythonIsbnService";

/**
 * Process a book analysis request with enhanced logic:
 * 1. If ISBN is provided, first get metadata from Google Books API
 * 2. Always use OpenAI to generate summary, identify genres/themes, and enhance metadata
 * 3. Return error fields if both APIs fail
 */
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest
): Promise<Partial<Book>> {
  // Create a unique ID for this analysis request for logging
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  console.log(`[${analysisId}] Starting book analysis with request:`, {
    hasISBN: !!analysisRequest.isbn,
    hasTitle: !!analysisRequest.title,
    hasMainAuthor: !!analysisRequest.mainAuthor,
    hasAuthor: !!analysisRequest.author,
    hasCoverImage: !!analysisRequest.coverImageData,
    language: analysisRequest.language
  });

  // Base book data to be enriched - start with an empty object
  let baseBookData: Partial<Book> = {};
  
  // If ISBN is provided, use our improved ISBN lookup service
  if (analysisRequest.isbn) {
    const isbn = analysisRequest.isbn;
    console.log(`[${analysisId}] ISBN found: ${isbn} - Using enhanced ISBN lookup`);
    
    try {
      // Use our improved ISBN lookup service that combines Python and Google Books API
      console.log(`[${analysisId}] Retrieving book metadata using enhanced ISBN lookup`);
      const bookData = await getBookByISBNWithFallback(isbn, analysisRequest.language || "de");
      
      // If we got valid data, use it as base data
      if (bookData && bookData.title && (bookData.mainAuthor || bookData.author)) {
        console.log(`[${analysisId}] Successfully retrieved book metadata: "${bookData.title}" by ${bookData.mainAuthor || bookData.author}`);
        baseBookData = bookData;
      } else {
        console.log(`[${analysisId}] Enhanced lookup didn't return valid data for ISBN: ${isbn}`);
        // Still include the ISBN in base data
        baseBookData = {
          isbn,
          language: analysisRequest.language || "de"
        };
      }
    } catch (error: any) {
      console.log(`[${analysisId}] Error retrieving data from enhanced lookup:`, error?.message || String(error));
      // Continue with just the ISBN
      baseBookData = {
        isbn,
        language: analysisRequest.language || "de"
      };
    }
  } 
  // Handle non-ISBN cases (title/author)
  else if (analysisRequest.title || analysisRequest.mainAuthor || analysisRequest.author) {
    console.log(`[${analysisId}] No ISBN provided, using enhanced title/author lookup`);
    
    try {
      // Use our enhanced title/author lookup service that combines Google Books and OpenAI
      if (analysisRequest.title) {
        console.log(`[${analysisId}] Retrieving book metadata using title/author lookup`);
        const bookData = await getBookByTitleAndAuthor(
          analysisRequest.title,
          analysisRequest.mainAuthor || analysisRequest.author || "",
          analysisRequest.language || "de"
        );
        
        // If we got valid data, use it as base data
        if (bookData && bookData.title) {
          console.log(`[${analysisId}] Successfully retrieved book metadata from title/author: "${bookData.title}" by ${bookData.mainAuthor || bookData.author || 'Unknown'}`);
          baseBookData = bookData;
        } else {
          console.log(`[${analysisId}] Title/author lookup didn't return valid data for: "${analysisRequest.title}"`);
          // Still include the title/author in base data
          baseBookData = {
            title: analysisRequest.title || undefined,
            mainAuthor: analysisRequest.mainAuthor || undefined,
            author: analysisRequest.author || undefined,
            language: analysisRequest.language || "de"
          };
        }
      } else {
        // Just author, not enough for lookup
        baseBookData = {
          title: analysisRequest.title || undefined,
          mainAuthor: analysisRequest.mainAuthor || undefined,
          author: analysisRequest.author || undefined,
          language: analysisRequest.language || "de"
        };
      }
    } catch (error: any) {
      console.log(`[${analysisId}] Error retrieving data from title/author lookup:`, error?.message || String(error));
      // Continue with just the title/author
      baseBookData = {
        title: analysisRequest.title || undefined,
        mainAuthor: analysisRequest.mainAuthor || undefined,
        author: analysisRequest.author || undefined,
        language: analysisRequest.language || "de"
      };
    }
  } else {
    // Not enough information provided
    console.log(`[${analysisId}] Insufficient information for book analysis`);
    return {} as Partial<Book>;
  }
  
  // Second step: Always use OpenAI to generate summary, identify genres/themes, and enhance metadata
  console.log(`[${analysisId}] Sending data to OpenAI for summary, genres, themes, and metadata enhancement`);
  
  // Log which fields are available to send to OpenAI
  const existingFields = Object.keys(baseBookData).filter(key => 
    baseBookData[key as keyof typeof baseBookData] !== undefined && 
    baseBookData[key as keyof typeof baseBookData] !== null
  );
  console.log(`[${analysisId}] Sending following fields to OpenAI:`, existingFields);
  
  try {
    // Prepare OpenAI request with all available fields from Google Books
    // First, create a base request with required fields to satisfy the type system
    const openAiRequest: BookAnalysisRequest = {
      isbn: baseBookData.isbn || null,
      title: baseBookData.title || "",
      author: baseBookData.author || "",
      mainAuthor: baseBookData.mainAuthor || "",
      language: baseBookData.language || "de",
      coverImageData: analysisRequest.coverImageData
    };
    
    // Then add all the available fields from Google Books data for more context
    // Include as much metadata as possible for OpenAI to use
    if (baseBookData.subtitle) openAiRequest.subtitle = baseBookData.subtitle;
    if (baseBookData.publisher) openAiRequest.publisher = baseBookData.publisher;
    if (baseBookData.publicationYear) openAiRequest.publicationYear = baseBookData.publicationYear;
    if (baseBookData.pageCount) openAiRequest.pageCount = baseBookData.pageCount;
    if (baseBookData.binding) openAiRequest.binding = baseBookData.binding;
    if (baseBookData.coverImageUrl) openAiRequest.coverImageUrl = baseBookData.coverImageUrl;
    if (baseBookData.summary) openAiRequest.summary = baseBookData.summary;
    if (baseBookData.genres && Array.isArray(baseBookData.genres)) openAiRequest.genres = baseBookData.genres;
    
    // Log the fields being sent to OpenAI
    console.log(`[${analysisId}] Sending following fields to OpenAI:`, 
      Object.keys(openAiRequest).filter(key => 
        openAiRequest[key as keyof BookAnalysisRequest] !== undefined && 
        openAiRequest[key as keyof BookAnalysisRequest] !== null
      )
    );
    
    // Call OpenAI to enhance the metadata and generate summary, genres, themes
    const openAIResult = await processBookAnalysisWithOpenAI(openAiRequest);
    
    // Merge the results, prioritizing reliable data
    const mergedResult = {
      ...openAIResult,
      // Preserve these fields from Google Books (if they exist) as they're more reliable
      isbn: baseBookData.isbn || openAIResult.isbn,
      title: baseBookData.title || openAIResult.title,
      mainAuthor: baseBookData.mainAuthor || openAIResult.mainAuthor,
      author: baseBookData.author || openAIResult.author,
      publisher: baseBookData.publisher || openAIResult.publisher,
      publicationYear: baseBookData.publicationYear || openAIResult.publicationYear,
      pageCount: baseBookData.pageCount || openAIResult.pageCount,
      language: baseBookData.language || openAIResult.language || "de"
    };
    
    // Validate the result
    if (mergedResult.title && (mergedResult.mainAuthor || mergedResult.author)) {
      console.log(`[${analysisId}] Successfully processed complete book data: "${mergedResult.title}" by ${mergedResult.mainAuthor || mergedResult.author}`);
      
      // If we have an ISBN from both sources, verify they match
      if (baseBookData.isbn && openAIResult.isbn && baseBookData.isbn !== openAIResult.isbn) {
        console.log(`[${analysisId}] WARNING: ISBN mismatch between Google Books (${baseBookData.isbn}) and OpenAI (${openAIResult.isbn}). Using Google Books ISBN.`);
      }
      
      // Log the complete merged results for debugging - using standardized fields
      console.log(`[${analysisId}] BIBLIOGRAPHIC DATA CHECK from final merged result:`);
      console.log(`- Title: "${mergedResult.title || 'N/A'}"`);
      console.log(`- Subtitle: "${mergedResult.subtitle || 'N/A'}"`);
      console.log(`- Main Author: "${mergedResult.mainAuthor || mergedResult.author || 'N/A'}"`);
      console.log(`- Statement of Responsibility: ${mergedResult.statementOfResponsibility || 'N/A'}`);
      console.log(`- Edition: ${mergedResult.edition || 'N/A'}`);
      console.log(`- Publication Place: ${mergedResult.publicationPlace || 'N/A'}`);
      console.log(`- Publisher: ${mergedResult.publisher || 'N/A'}`);
      console.log(`- Publication Year: ${mergedResult.publicationYear || 'N/A'}`);
      console.log(`- Page Count: ${mergedResult.pageCount || 'N/A'}`);
      console.log(`- Dimensions: ${mergedResult.dimensions || 'N/A'}`);
      console.log(`- ISBN: ${mergedResult.isbn || 'N/A'}`);
      console.log(`- Binding: ${mergedResult.binding || 'N/A'}`);
      console.log(`- Price: ${mergedResult.price || 'N/A'}`);
      console.log(`- Language: ${mergedResult.language || 'N/A'}`);
      console.log(`- Genres: ${mergedResult.genres ? JSON.stringify(mergedResult.genres) : 'None'}`);
      console.log(`- Summary: ${mergedResult.summary ? (mergedResult.summary.substring(0, 50) + '...') : 'N/A'}`);
      
      // Log the source of each field (Google Books, OpenAI, or both)
      const fieldSources: Record<string, string> = {};
      for (const key of Object.keys(mergedResult)) {
        if (key in baseBookData && key in openAIResult) {
          fieldSources[key] = 'Both';
        } else if (key in baseBookData) {
          fieldSources[key] = 'Google Books';
        } else if (key in openAIResult) {
          fieldSources[key] = 'OpenAI';
        }
      }
      console.log(`[${analysisId}] Field data sources:`, fieldSources);
      
      return mergedResult;
    }
    
    // If we don't have a complete result, return what we have
    console.log(`[${analysisId}] Partial book data processed, returning available information`);
    return mergedResult;
    
  } catch (error: any) {
    console.log(`[${analysisId}] Error during OpenAI analysis:`, error?.message || String(error));
    apiLogger.logError("BookAnalysis", {
      error: "OpenAI book analysis failed",
      message: error?.message || "Unknown error",
      analysisId
    });
    
    // Return whatever base data we have from Google Books
    console.log(`[${analysisId}] Returning base book data from Google Books due to OpenAI error`);
    return baseBookData;
  }
}

/**
 * Function to get book information by ISBN with clean fallback logic
 */
export async function getBookByISBNWithFallback(isbn: string, language: string = "de", apiKeys?: any): Promise<Partial<Book> | null> {
  const lookupId = `isbn_lookup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book by ISBN: ${isbn}`);
  
  // Base book data to be enriched - start with just the ISBN
  let baseBookData: Partial<Book> = {
    isbn,
    language
  };
  
  try {
    // Get book metadata from our TypeScript implementation
    console.log(`[${lookupId}] Using TypeScript ISBN service for book metadata lookup`);
    
    try {
      // First try our DNB service
      const bookResult = await lookupBookByIsbn(isbn);
      
      if (bookResult && bookResult.title && bookResult.mainAuthor) {
        console.log(`[${lookupId}] Successfully retrieved book metadata from DNB service: "${bookResult.title}" by ${bookResult.mainAuthor}`);
        baseBookData = bookResult;
      } else {
        console.log(`[${lookupId}] DNB service didn't return valid data, falling back to Google Books API`);
        // Fallback to Google Books API
        const googleBooksResult = await getCompleteBookByISBN(isbn, language);
        
        if (googleBooksResult && googleBooksResult.title && (googleBooksResult.mainAuthor || googleBooksResult.author)) {
          console.log(`[${lookupId}] Successfully retrieved book metadata from Google Books API: "${googleBooksResult.title}" by ${googleBooksResult.mainAuthor || googleBooksResult.author}`);
          baseBookData = googleBooksResult;
        } else {
          console.log(`[${lookupId}] Google Books didn't return valid data for ISBN: ${isbn}`);
        }
      }
    } catch (error: any) {
      console.log(`[${lookupId}] Error in ISBN service: ${error.message}, falling back to Google Books API`);
      // Fallback to Google Books API
      const googleBooksResult = await getCompleteBookByISBN(isbn, language);
      
      if (googleBooksResult && googleBooksResult.title && (googleBooksResult.mainAuthor || googleBooksResult.author)) {
        console.log(`[${lookupId}] Successfully retrieved book metadata from Google Books API: "${googleBooksResult.title}" by ${googleBooksResult.mainAuthor || googleBooksResult.author}`);
        baseBookData = googleBooksResult;
      } else {
        console.log(`[${lookupId}] Google Books didn't return valid data for ISBN: ${isbn}`);
      }
    }
    
    // Second step: Always use OpenAI to enhance the data
    console.log(`[${lookupId}] Sending data to OpenAI for summary, genres, themes, and metadata enhancement`);
    
    // Create a request for OpenAI with all available fields from previous steps
    const request: BookAnalysisRequest = {
      isbn: baseBookData.isbn || null,
      title: baseBookData.title || "",
      mainAuthor: baseBookData.mainAuthor || "",
      author: baseBookData.author || "",
      language: baseBookData.language || language
    };
    
    // Add all the available fields for more context
    if (baseBookData.subtitle) request.subtitle = baseBookData.subtitle;
    if (baseBookData.publisher) request.publisher = baseBookData.publisher;
    if (baseBookData.publicationYear) request.publicationYear = baseBookData.publicationYear;
    if (baseBookData.pageCount) request.pageCount = baseBookData.pageCount;
    if (baseBookData.binding) request.binding = baseBookData.binding;
    if (baseBookData.coverImageUrl) request.coverImageUrl = baseBookData.coverImageUrl;
    if (baseBookData.summary) request.summary = baseBookData.summary;
    if (baseBookData.genres && Array.isArray(baseBookData.genres)) request.genres = baseBookData.genres;
    
    // Log the fields being sent to OpenAI
    console.log(`[${lookupId}] Sending following fields to OpenAI:`, 
      Object.keys(request).filter(key => 
        request[key as keyof BookAnalysisRequest] !== undefined && 
        request[key as keyof BookAnalysisRequest] !== null
      )
    );
    
    const openAIResult = await processBookAnalysisWithOpenAI(request);
    
    // Merge the results, prioritizing reliable data
    const mergedResult = {
      ...openAIResult,
      // Preserve these fields from previous data (if they exist) as they're more reliable
      isbn: baseBookData.isbn || openAIResult.isbn,
      title: baseBookData.title || openAIResult.title,
      mainAuthor: baseBookData.mainAuthor || openAIResult.mainAuthor,
      author: baseBookData.author || openAIResult.author,
      publisher: baseBookData.publisher || openAIResult.publisher,
      publicationYear: baseBookData.publicationYear || openAIResult.publicationYear,
      pageCount: baseBookData.pageCount || openAIResult.pageCount,
      language: baseBookData.language || openAIResult.language || language
    };
    
    // Validate the result
    if (mergedResult.title && (mergedResult.mainAuthor || mergedResult.author)) {
      console.log(`[${lookupId}] Successfully processed complete book data: "${mergedResult.title}" by ${mergedResult.mainAuthor || mergedResult.author}`);
      
      // If we have an ISBN from both sources, verify they match
      if (openAIResult.isbn && openAIResult.isbn !== isbn) {
        console.log(`[${lookupId}] WARNING: ISBN mismatch between request (${isbn}) and OpenAI (${openAIResult.isbn}). Using requested ISBN.`);
      }
      
      // Log the complete merged results for debugging - using standardized fields
      console.log(`[${lookupId}] BIBLIOGRAPHIC DATA CHECK from final merged result:`);
      console.log(`- Title: "${mergedResult.title || 'N/A'}"`);
      console.log(`- Subtitle: "${mergedResult.subtitle || 'N/A'}"`);
      console.log(`- Main Author: "${mergedResult.mainAuthor || mergedResult.author || 'N/A'}"`);
      console.log(`- Statement of Responsibility: ${mergedResult.statementOfResponsibility || 'N/A'}`);
      console.log(`- Edition: ${mergedResult.edition || 'N/A'}`);
      console.log(`- Publication Place: ${mergedResult.publicationPlace || 'N/A'}`);
      console.log(`- Publisher: ${mergedResult.publisher || 'N/A'}`);
      console.log(`- Publication Year: ${mergedResult.publicationYear || 'N/A'}`);
      console.log(`- Page Count: ${mergedResult.pageCount || 'N/A'}`);
      console.log(`- Dimensions: ${mergedResult.dimensions || 'N/A'}`);
      console.log(`- ISBN: ${mergedResult.isbn || 'N/A'}`);
      console.log(`- Binding: ${mergedResult.binding || 'N/A'}`);
      console.log(`- Price: ${mergedResult.price || 'N/A'}`);
      console.log(`- Language: ${mergedResult.language || 'N/A'}`);
      console.log(`- Genres: ${mergedResult.genres ? JSON.stringify(mergedResult.genres) : 'None'}`);
      console.log(`- Summary: ${mergedResult.summary ? (mergedResult.summary.substring(0, 50) + '...') : 'N/A'}`);
      
      return mergedResult;
    }
    
    // If we still don't have a complete result, return what we have
    console.log(`[${lookupId}] Partial book data processed, returning available information`);
    return mergedResult;
    
  } catch (error: any) {
    console.log(`[${lookupId}] Error during book lookup:`, error?.message || String(error));
    return baseBookData;
  }
}

/**
 * Function to get book information by title and author with same verification approach as ISBN
 */
export async function getBookByTitleAndAuthor(title: string, author: string = "", language: string = "de"): Promise<Partial<Book> | null> {
  const lookupId = `title_lookup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book by title/author: "${title}" by ${author || 'Unknown'}`);
  
  // Base book data to be enriched
  let baseBookData: Partial<Book> = {
    title,
    mainAuthor: author,
    language
  };
  
  try {
    // First, try to get data from Google Books API
    try {
      const query = `${title} ${author}`.trim();
      console.log(`[${lookupId}] Searching Google Books with query: "${query}"`);
      
      const googleBooksResult = await getCompleteBookByISBN(query, language);
      
      if (googleBooksResult && googleBooksResult.title) {
        console.log(`[${lookupId}] Successfully retrieved book metadata from Google Books API: "${googleBooksResult.title}" by ${googleBooksResult.mainAuthor || googleBooksResult.author || 'Unknown'}`);
        baseBookData = googleBooksResult;
      } else {
        console.log(`[${lookupId}] Google Books didn't return valid data for title: "${title}"`);
      }
    } catch (error: any) {
      console.log(`[${lookupId}] Error in Google Books title lookup:`, error?.message || String(error));
    }
    
    // Second step: Always use OpenAI to enhance the data
    console.log(`[${lookupId}] Sending data to OpenAI for summary, genres, themes, and metadata enhancement`);
    
    // Create a request for OpenAI
    const request: BookAnalysisRequest = {
      title: baseBookData.title || "",
      mainAuthor: baseBookData.mainAuthor || "",
      author: baseBookData.author || "",
      language: baseBookData.language || language
    };
    
    // Add any additional data we have
    if (baseBookData.isbn) request.isbn = baseBookData.isbn;
    if (baseBookData.subtitle) request.subtitle = baseBookData.subtitle;
    if (baseBookData.publisher) request.publisher = baseBookData.publisher;
    if (baseBookData.publicationYear) request.publicationYear = baseBookData.publicationYear;
    if (baseBookData.pageCount) request.pageCount = baseBookData.pageCount;
    if (baseBookData.binding) request.binding = baseBookData.binding;
    if (baseBookData.coverImageUrl) request.coverImageUrl = baseBookData.coverImageUrl;
    
    // Log the fields being sent to OpenAI
    console.log(`[${lookupId}] Sending following fields to OpenAI:`, 
      Object.keys(request).filter(key => 
        request[key as keyof BookAnalysisRequest] !== undefined && 
        request[key as keyof BookAnalysisRequest] !== null
      )
    );
    
    const openAIResult = await processBookAnalysisWithOpenAI(request);
    
    // Merge the results, prioritizing Google Books data for factual fields
    const mergedResult = {
      ...openAIResult,
      // Preserve these fields from Google Books (if they exist) as they're more reliable
      isbn: baseBookData.isbn || openAIResult.isbn,
      title: baseBookData.title || openAIResult.title,
      mainAuthor: baseBookData.mainAuthor || openAIResult.mainAuthor,
      author: baseBookData.author || openAIResult.author,
      publisher: baseBookData.publisher || openAIResult.publisher,
      publicationYear: baseBookData.publicationYear || openAIResult.publicationYear,
      pageCount: baseBookData.pageCount || openAIResult.pageCount,
      language: baseBookData.language || openAIResult.language || language
    };
    
    return mergedResult;
    
  } catch (error: any) {
    console.log(`[${lookupId}] Error during title/author lookup:`, error?.message || String(error));
    return baseBookData;
  }
}

/**
 * Enrich book metadata with additional fields from OpenAI
 */
export async function enrichBookMetadata(bookData: Partial<Book>): Promise<Partial<Book>> {
  const enrichId = `enrich_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${enrichId}] Enriching book metadata for: "${bookData.title}" by ${bookData.mainAuthor || bookData.author || 'Unknown'}`);
  
  try {
    if (!bookData.title) {
      console.log(`[${enrichId}] Cannot enrich book metadata without a title`);
      return bookData;
    }
    
    // Create a request for OpenAI with all available fields
    const request: BookAnalysisRequest = {
      isbn: bookData.isbn || null,
      title: bookData.title || "",
      mainAuthor: bookData.mainAuthor || "",
      author: bookData.author || "",
      language: bookData.language || "de"
    };
    
    // Add all other fields for context
    if (bookData.subtitle) request.subtitle = bookData.subtitle;
    if (bookData.publisher) request.publisher = bookData.publisher;
    if (bookData.publicationYear) request.publicationYear = bookData.publicationYear;
    if (bookData.pageCount) request.pageCount = bookData.pageCount;
    if (bookData.binding) request.binding = bookData.binding;
    if (bookData.coverImageUrl) request.coverImageUrl = bookData.coverImageUrl;
    if (bookData.summary) request.summary = bookData.summary;
    if (bookData.genres && Array.isArray(bookData.genres)) request.genres = bookData.genres;
    
    // Log the fields being sent to OpenAI
    console.log(`[${enrichId}] Sending following fields to OpenAI:`, 
      Object.keys(request).filter(key => 
        request[key as keyof BookAnalysisRequest] !== undefined && 
        request[key as keyof BookAnalysisRequest] !== null
      )
    );
    
    // Call OpenAI to enhance the metadata
    const openAIResult = await processBookAnalysisWithOpenAI(request);
    
    // Merge the results, prioritizing existing data for factual fields
    const mergedResult = {
      ...bookData,
      // Use OpenAI for these subjective fields
      summary: openAIResult.summary || bookData.summary,
      themes: openAIResult.themes || bookData.themes,
      genres: bookData.genres && Array.isArray(bookData.genres) && bookData.genres.length > 0 ? bookData.genres : openAIResult.genres,
      ASB: openAIResult.ASB || bookData.ASB,
      readingLevel: openAIResult.readingLevel || bookData.readingLevel,
      interestCategory: openAIResult.interestCategory || bookData.interestCategory
    };
    
    console.log(`[${enrichId}] Successfully enriched book metadata`);
    return mergedResult;
    
  } catch (error: any) {
    console.log(`[${enrichId}] Error enriching book metadata:`, error?.message || String(error));
    return bookData;
  }
}

/**
 * Function to analyze book cover and retrieve enhanced metadata from multiple sources
 */
export async function getBookFromCoverImage(imageBase64: string, language: string = "de"): Promise<Partial<Book> | null> {
  // Implementation to come later
  return null;
}

/**
 * Get similar books recommendations
 */
export async function getSimilarBooks(book: Partial<Book>): Promise<any[]> {
  const similarId = `similar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${similarId}] Finding similar books for: "${book.title}" by ${book.mainAuthor || book.author || 'Unknown'}`);
  
  if (!book.title) {
    console.log(`[${similarId}] Cannot find similar books without a title`);
    return [];
  }
  
  try {
    // Call OpenAI to get similar books
    const openAIResult = await searchSimilarBooks(book);
    
    // Ensure we have valid book objects
    const validBooks = openAIResult.filter(book => book && book.title && (book.mainAuthor || book.author));
    
    console.log(`[${similarId}] Found ${validBooks.length} similar books`);
    return validBooks;
    
  } catch (error: any) {
    console.log(`[${similarId}] Error finding similar books:`, error?.message || String(error));
    return [];
  }
}

// Import to avoid circular dependencies
import { searchSimilarBooks } from "./openai";