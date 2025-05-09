import { Book, BookAnalysisRequest } from "@shared/schema";
import { getCompleteBookByISBN } from "./googleBooks";
import { apiLogger } from "../utils/logger";
import { processBookAnalysis as processBookAnalysisWithOpenAI } from "./openai";

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
    hasAuthor: !!analysisRequest.author,
    hasCoverImage: !!analysisRequest.coverImageData,
    language: analysisRequest.language
  });

  // Base book data to be enriched - start with an empty object
  let baseBookData: Partial<Book> = {};
  
  // If ISBN is provided, use that specifically to get metadata from Google Books
  if (analysisRequest.isbn) {
    const isbn = analysisRequest.isbn;
    console.log(`[${analysisId}] ISBN found: ${isbn} - Using clean ISBN-only lookup`);
    
    try {
      // First step: get metadata from Google Books API with the ISBN
      console.log(`[${analysisId}] Retrieving book metadata from Google Books API using ISBN`);
      const googleBooksResult = await getCompleteBookByISBN(isbn, analysisRequest.language || "de");
      
      // If Google Books API returned valid data, use it as base data
      if (googleBooksResult && googleBooksResult.title && googleBooksResult.author) {
        console.log(`[${analysisId}] Successfully retrieved book metadata from Google Books API: "${googleBooksResult.title}" by ${googleBooksResult.author}`);
        baseBookData = googleBooksResult;
      } else {
        console.log(`[${analysisId}] Google Books didn't return valid data for ISBN: ${isbn}`);
        // Still include the ISBN in base data
        baseBookData = {
          isbn,
          language: analysisRequest.language || "de"
        };
      }
    } catch (error: any) {
      console.log(`[${analysisId}] Error retrieving data from Google Books:`, error?.message || String(error));
      // Continue with just the ISBN
      baseBookData = {
        isbn,
        language: analysisRequest.language || "de"
      };
    }
  } 
  // Handle non-ISBN cases (title/author)
  else if (analysisRequest.title || analysisRequest.author) {
    console.log(`[${analysisId}] No ISBN provided, using title/author as base data`);
    baseBookData = {
      title: analysisRequest.title || undefined,
      author: analysisRequest.author || undefined,
      language: analysisRequest.language || "de"
    };
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
      language: baseBookData.language || "de",
      coverImageData: analysisRequest.coverImageData
    };
    
    // Then add all the available fields from Google Books data for more context
    // Include as much metadata as possible for OpenAI to use
    if (baseBookData.subtitle) openAiRequest.subtitle = baseBookData.subtitle;
    if (baseBookData.publisher) openAiRequest.publisher = baseBookData.publisher;
    if (baseBookData.publishedYear) openAiRequest.publishedYear = baseBookData.publishedYear;
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
    
    // Validate and sanitize data before merging
    // Create a cleaned copy of the raw data that's been validated
    const validatedBaseData = { ...baseBookData };
    const validatedOpenAIData = { ...openAIResult };
    
    // Check for future publication dates (which are likely incorrect)
    const currentYear = new Date().getFullYear();
    if (validatedBaseData.publishedYear && validatedBaseData.publishedYear > currentYear) {
      console.log(`[${analysisId}] Warning: Future publication year detected from Google Books: ${validatedBaseData.publishedYear}. Setting to null.`);
      validatedBaseData.publishedYear = null;
    }
    if (validatedOpenAIData.publishedYear && validatedOpenAIData.publishedYear > currentYear) {
      console.log(`[${analysisId}] Warning: Future publication year detected from OpenAI: ${validatedOpenAIData.publishedYear}. Setting to null.`);
      validatedOpenAIData.publishedYear = null;
    }
    
    // Check for unreasonably large page counts
    if (validatedBaseData.pageCount && validatedBaseData.pageCount > 2000) {
      console.log(`[${analysisId}] Warning: Unusually high page count from Google Books: ${validatedBaseData.pageCount}. Setting to null.`);
      validatedBaseData.pageCount = null;
    }
    if (validatedOpenAIData.pageCount && validatedOpenAIData.pageCount > 2000) {
      console.log(`[${analysisId}] Warning: Unusually high page count from OpenAI: ${validatedOpenAIData.pageCount}. Setting to null.`);
      validatedOpenAIData.pageCount = null;
    }
    
    // Mark suspicious data values for debugging - flag fields where Google Books and OpenAI disagree significantly
    const suspiciousFields: string[] = [];
    
    // Check for publisher mismatch
    if (validatedBaseData.publisher && validatedOpenAIData.publisher && 
        validatedBaseData.publisher !== validatedOpenAIData.publisher) {
      console.log(`[${analysisId}] Publisher mismatch detected: GB="${validatedBaseData.publisher}" vs OpenAI="${validatedOpenAIData.publisher}"`);
      suspiciousFields.push('publisher');
    }
    
    // Check for page count mismatch (only if both sources provide data)
    if (validatedBaseData.pageCount && validatedOpenAIData.pageCount && 
        Math.abs(validatedBaseData.pageCount - validatedOpenAIData.pageCount) > 50) {
      console.log(`[${analysisId}] Page count mismatch detected: GB=${validatedBaseData.pageCount} vs OpenAI=${validatedOpenAIData.pageCount}`);
      suspiciousFields.push('pageCount');
    }
    
    // Merge the results, prioritizing reliable data and handling null/undefined values properly
    const mergedResult = {
      ...validatedOpenAIData,
      // Preserve these fields from Google Books (if they exist) as they're more reliable
      isbn: validatedBaseData.isbn || validatedOpenAIData.isbn,
      title: validatedBaseData.title || validatedOpenAIData.title,
      author: validatedBaseData.author || validatedOpenAIData.author,
      language: validatedBaseData.language || validatedOpenAIData.language || "de",
      
      // For potentially suspect fields, prefer Google Books when available but mark suspicious data
      publisher: suspiciousFields.includes('publisher') ? null : (validatedBaseData.publisher || validatedOpenAIData.publisher),
      publishedYear: suspiciousFields.includes('publishedYear') ? null : (validatedBaseData.publishedYear || validatedOpenAIData.publishedYear),
      pageCount: suspiciousFields.includes('pageCount') ? null : (validatedBaseData.pageCount || validatedOpenAIData.pageCount),
    };
    
    // Validate the result
    if (mergedResult.title && mergedResult.author) {
      console.log(`[${analysisId}] Successfully processed complete book data: "${mergedResult.title}" by ${mergedResult.author}`);
      
      // If we have an ISBN from both sources, verify they match
      if (baseBookData.isbn && openAIResult.isbn && baseBookData.isbn !== openAIResult.isbn) {
        console.log(`[${analysisId}] WARNING: ISBN mismatch between Google Books (${baseBookData.isbn}) and OpenAI (${openAIResult.isbn}). Using Google Books ISBN.`);
      }
      
      // Log the complete merged results for debugging
      console.log(`[${analysisId}] BIBLIOGRAPHIC DATA CHECK from final merged result:`);
      console.log(`- Title: "${mergedResult.title || 'N/A'}"`);
      console.log(`- Subtitle: "${mergedResult.subtitle || 'N/A'}"`);
      console.log(`- Main Author: "${mergedResult.author || 'N/A'}"`);
      console.log(`- Statement of Responsibility: ${mergedResult.statementOfResponsibility || 'N/A'}`);
      console.log(`- Illustrator: ${mergedResult.illustrator || 'N/A'}`);
      console.log(`- Translator: ${mergedResult.translator || 'N/A'}`);
      console.log(`- Edition: ${mergedResult.edition || 'N/A'}`);
      console.log(`- Location: ${mergedResult.location || 'N/A'}`);
      console.log(`- Publisher: ${mergedResult.publisher || 'N/A'}`);
      console.log(`- Published Year: ${mergedResult.publishedYear || 'N/A'}`);
      console.log(`- Page Count: ${mergedResult.pageCount || 'N/A'}`);
      console.log(`- Dimensions: ${mergedResult.dimensions || 'N/A'}`);
      console.log(`- ISBN: ${mergedResult.isbn || 'N/A'}`);
      console.log(`- Binding: ${mergedResult.binding || 'N/A'}`);
      console.log(`- Price: ${mergedResult.price || 'N/A'}`);
      console.log(`- Language: ${mergedResult.language || 'N/A'}`);
      console.log(`- Genres: ${mergedResult.genres ? JSON.stringify(mergedResult.genres) : 'None'}`);
      console.log(`- Themes: ${mergedResult.themes ? JSON.stringify(mergedResult.themes) : 'None'}`);
      console.log(`- Catalog Number: ${mergedResult.catalogNumber || 'N/A'}`);
      console.log(`- Interest Category: ${mergedResult.interestCategory || 'N/A'}`);
      console.log(`- Reading Level: ${mergedResult.readingLevel || 'N/A'}`);
      
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
export async function getBookByISBNWithFallback(isbn: string, language: string = "de"): Promise<Partial<Book> | null> {
  const lookupId = `isbn_lookup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book by ISBN: ${isbn}`);
  
  // Base book data to be enriched - start with just the ISBN
  let baseBookData: Partial<Book> = {
    isbn,
    language
  };
  
  try {
    // First step: get metadata from Google Books API
    console.log(`[${lookupId}] Retrieving book metadata from Google Books API using ISBN`);
    const googleBooksResult = await getCompleteBookByISBN(isbn, language);
    
    // If Google Books API returned valid data, use it as base data
    if (googleBooksResult && googleBooksResult.title && googleBooksResult.author) {
      console.log(`[${lookupId}] Successfully retrieved book metadata from Google Books API: "${googleBooksResult.title}" by ${googleBooksResult.author}`);
      baseBookData = googleBooksResult;
    } else {
      console.log(`[${lookupId}] Google Books didn't return valid data for ISBN: ${isbn}`);
    }
    
    // Second step: Always use OpenAI to enhance the data
    console.log(`[${lookupId}] Sending data to OpenAI for summary, genres, themes, and metadata enhancement`);
    
    // Create a request for OpenAI with all available fields from Google Books
    // First, create a base request with required fields to satisfy the type system
    const request: BookAnalysisRequest = {
      isbn: baseBookData.isbn || null,
      title: baseBookData.title || "",
      author: baseBookData.author || "",
      language: baseBookData.language || language
    };
    
    // Then add all the available fields from Google Books data for more context
    // Include as much metadata as possible for OpenAI to use
    if (baseBookData.subtitle) request.subtitle = baseBookData.subtitle;
    if (baseBookData.publisher) request.publisher = baseBookData.publisher;
    if (baseBookData.publishedYear) request.publishedYear = baseBookData.publishedYear;
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
    
    // Validate and sanitize data before merging
    // Create a cleaned copy of the raw data that's been validated
    const validatedBaseData = { ...baseBookData };
    const validatedOpenAIData = { ...openAIResult };
    
    // Check for future publication dates (which are likely incorrect)
    const currentYear = new Date().getFullYear();
    if (validatedBaseData.publishedYear && validatedBaseData.publishedYear > currentYear) {
      console.log(`[${lookupId}] Warning: Future publication year detected from Google Books: ${validatedBaseData.publishedYear}. Setting to null.`);
      validatedBaseData.publishedYear = null;
    }
    if (validatedOpenAIData.publishedYear && validatedOpenAIData.publishedYear > currentYear) {
      console.log(`[${lookupId}] Warning: Future publication year detected from OpenAI: ${validatedOpenAIData.publishedYear}. Setting to null.`);
      validatedOpenAIData.publishedYear = null;
    }
    
    // Check for unreasonably large page counts
    if (validatedBaseData.pageCount && validatedBaseData.pageCount > 2000) {
      console.log(`[${lookupId}] Warning: Unusually high page count from Google Books: ${validatedBaseData.pageCount}. Setting to null.`);
      validatedBaseData.pageCount = null;
    }
    if (validatedOpenAIData.pageCount && validatedOpenAIData.pageCount > 2000) {
      console.log(`[${lookupId}] Warning: Unusually high page count from OpenAI: ${validatedOpenAIData.pageCount}. Setting to null.`);
      validatedOpenAIData.pageCount = null;
    }
    
    // Mark suspicious data values for debugging - flag fields where Google Books and OpenAI disagree significantly
    const suspiciousFields: string[] = [];
    
    // Check for publisher mismatch
    if (validatedBaseData.publisher && validatedOpenAIData.publisher && 
        validatedBaseData.publisher !== validatedOpenAIData.publisher) {
      console.log(`[${lookupId}] Publisher mismatch detected: GB="${validatedBaseData.publisher}" vs OpenAI="${validatedOpenAIData.publisher}"`);
      suspiciousFields.push('publisher');
    }
    
    // Check for page count mismatch (only if both sources provide data)
    if (validatedBaseData.pageCount && validatedOpenAIData.pageCount && 
        Math.abs(validatedBaseData.pageCount - validatedOpenAIData.pageCount) > 50) {
      console.log(`[${lookupId}] Page count mismatch detected: GB=${validatedBaseData.pageCount} vs OpenAI=${validatedOpenAIData.pageCount}`);
      suspiciousFields.push('pageCount');
    }
    
    // Merge the results, prioritizing reliable data and handling null/undefined values properly
    const mergedResult = {
      ...validatedOpenAIData,
      // Preserve these fields from Google Books (if they exist) as they're more reliable
      isbn: validatedBaseData.isbn || validatedOpenAIData.isbn,
      title: validatedBaseData.title || validatedOpenAIData.title,
      author: validatedBaseData.author || validatedOpenAIData.author,
      language: validatedBaseData.language || validatedOpenAIData.language || language,
      
      // For potentially suspect fields, prefer Google Books when available but mark suspicious data
      publisher: suspiciousFields.includes('publisher') ? null : (validatedBaseData.publisher || validatedOpenAIData.publisher),
      publishedYear: suspiciousFields.includes('publishedYear') ? null : (validatedBaseData.publishedYear || validatedOpenAIData.publishedYear),
      pageCount: suspiciousFields.includes('pageCount') ? null : (validatedBaseData.pageCount || validatedOpenAIData.pageCount),
    };
    
    // Validate the result
    if (mergedResult.title && mergedResult.author) {
      console.log(`[${lookupId}] Successfully processed complete book data: "${mergedResult.title}" by ${mergedResult.author}`);
      
      // If we have an ISBN from both sources, verify they match
      if (openAIResult.isbn && openAIResult.isbn !== isbn) {
        console.log(`[${lookupId}] WARNING: ISBN mismatch between request (${isbn}) and OpenAI (${openAIResult.isbn}). Using requested ISBN.`);
      }
      
      // Log the complete merged results for debugging
      console.log(`[${lookupId}] BIBLIOGRAPHIC DATA CHECK from final ISBN lookup result:`);
      console.log(`- Title: "${mergedResult.title || 'N/A'}"`);
      console.log(`- Subtitle: "${mergedResult.subtitle || 'N/A'}"`);
      console.log(`- Main Author: "${mergedResult.author || 'N/A'}"`);
      console.log(`- Statement of Responsibility: ${mergedResult.statementOfResponsibility || 'N/A'}`);
      console.log(`- Illustrator: ${mergedResult.illustrator || 'N/A'}`);
      console.log(`- Translator: ${mergedResult.translator || 'N/A'}`);
      console.log(`- Edition: ${mergedResult.edition || 'N/A'}`);
      console.log(`- Location: ${mergedResult.location || 'N/A'}`);
      console.log(`- Publisher: ${mergedResult.publisher || 'N/A'}`);
      console.log(`- Published Year: ${mergedResult.publishedYear || 'N/A'}`);
      console.log(`- Page Count: ${mergedResult.pageCount || 'N/A'}`);
      console.log(`- Dimensions: ${mergedResult.dimensions || 'N/A'}`);
      console.log(`- ISBN: ${mergedResult.isbn || 'N/A'}`);
      console.log(`- Binding: ${mergedResult.binding || 'N/A'}`);
      console.log(`- Price: ${mergedResult.price || 'N/A'}`);
      console.log(`- Language: ${mergedResult.language || 'N/A'}`);
      console.log(`- Genres: ${mergedResult.genres ? JSON.stringify(mergedResult.genres) : 'None'}`);
      console.log(`- Themes: ${mergedResult.themes ? JSON.stringify(mergedResult.themes) : 'None'}`);
      console.log(`- Catalog Number: ${mergedResult.catalogNumber || 'N/A'}`);
      console.log(`- Interest Category: ${mergedResult.interestCategory || 'N/A'}`);
      console.log(`- Reading Level: ${mergedResult.readingLevel || 'N/A'}`);
      
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
      console.log(`[${lookupId}] Field data sources:`, fieldSources);
      
      return mergedResult;
    }
    
    // If we don't have a complete result but have something, return what we have
    if (baseBookData.title || openAIResult.title) {
      console.log(`[${lookupId}] Partial book data processed, returning available information`);
      return mergedResult;
    }
    
    // If both services failed, return minimal data with just the ISBN
    console.log(`[${lookupId}] Both Google Books and OpenAI failed to return valid data for ISBN: ${isbn}`);
    return baseBookData;
    
  } catch (error: any) {
    console.log(`[${lookupId}] Error during book lookup:`, error?.message || String(error));
    apiLogger.logError("BookLookup", {
      error: "Book lookup failed",
      message: error?.message || "Unknown error",
      isbn,
      lookupId
    });
    
    // Return minimal data with just the ISBN
    return baseBookData;
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
      // Create a request for analysis with all available fields
      // First, create a base request with required fields
      const request: BookAnalysisRequest = {
        title: bookData.title,
        author: bookData.author,
        isbn: null,
        language: bookData.language || "de"
      };
      
      // Then add any other available fields for better context
      if (bookData.subtitle) request.subtitle = bookData.subtitle;
      if (bookData.publisher) request.publisher = bookData.publisher;
      if (bookData.publishedYear) request.publishedYear = bookData.publishedYear;
      if (bookData.pageCount) request.pageCount = bookData.pageCount;
      if (bookData.binding) request.binding = bookData.binding;
      if (bookData.coverImageUrl) request.coverImageUrl = bookData.coverImageUrl;
      if (bookData.summary) request.summary = bookData.summary;
      if (bookData.genres && Array.isArray(bookData.genres)) request.genres = bookData.genres;
      
      console.log(`Sending following fields to OpenAI for title/author enrichment:`, 
        Object.keys(request).filter(key => 
          request[key as keyof BookAnalysisRequest] !== undefined && 
          request[key as keyof BookAnalysisRequest] !== null
        )
      );
      
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
  const { searchSimilarBooks: getSimilarBooksFromGoogleBooks } = await import("./googleBooks");
  
  if (!book.title || !book.author) {
    console.log(`Cannot find similar books without title and author`);
    return [];
  }
  
  try {
    console.log(`Finding similar books for "${book.title}" by ${book.author}`);
    const similarBooks = await getSimilarBooksFromGoogleBooks(book);
    
    if (similarBooks && similarBooks.length > 0) {
      console.log(`Found ${similarBooks.length} similar books from Google Books API`);
      
      // Transform the Google Books API results to match our expected format
      const formattedBooks = similarBooks.map(book => {
        const volumeInfo = book.volumeInfo || {};
        
        return {
          title: volumeInfo.title || "Unknown Title",
          subtitle: volumeInfo.subtitle || null,
          author: volumeInfo.authors?.join(", ") || "Unknown Author",
          publisher: volumeInfo.publisher || null,
          publishedYear: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null,
          isbn: volumeInfo.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || 
                volumeInfo.industryIdentifiers?.find((id: any) => id.type === "ISBN_10")?.identifier || null,
          summary: volumeInfo.description || null,
          genres: volumeInfo.categories || null,
          similarityReason: `Similar to "${book.title}" based on ${book.author}'s works and genre recommendations`,
          language: volumeInfo.language || "de",
          coverImageUrl: volumeInfo.imageLinks?.thumbnail || null
        };
      });
      
      return formattedBooks;
    }
    
    // Fall back to OpenAI
    console.log(`No similar books found with Google Books API, falling back to OpenAI`);
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