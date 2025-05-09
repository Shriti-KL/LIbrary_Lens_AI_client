import { Book, BookAnalysisRequest } from "@shared/schema";
import { apiLogger } from "../utils/logger";

interface PerplexityRequest {
  model: string;
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations: string[];
  choices: {
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Helper function to make a single request to the Perplexity API
async function makePerplexityRequest(
  messages: PerplexityRequest["messages"],
  options: Partial<PerplexityRequest> = {}
): Promise<PerplexityResponse> {
  const baseUrl = "https://api.perplexity.ai/chat/completions";
  
  // Default model for Perplexity API
  const model = "llama-3.1-sonar-small-128k-online";
  
  // Check if API key is available
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY environment variable is not set");
  }

  const requestBody: PerplexityRequest = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    top_p: options.top_p ?? 0.9,
    stream: false,
    presence_penalty: options.presence_penalty ?? 0,
    frequency_penalty: options.frequency_penalty ?? 0,
  };

  // Log the request for debugging
  apiLogger.logRequest("Perplexity", {
    operation: 'chat/completions',
    model,
    messageCount: messages.length,
    promptPreview: messages[messages.length - 1].content.substring(0, 100) + '...'
  });

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    // Check if the response is okay
    if (!response.ok) {
      const errorResponse = await response.text();
      
      apiLogger.logError("Perplexity", {
        status: response.status,
        message: errorResponse
      });
      
      throw new Error(`Perplexity API request failed with status ${response.status}: ${errorResponse}`);
    }

    // Parse the response
    const responseData = await response.json();
    
    // Log the response for debugging
    apiLogger.logResponse("Perplexity", {
      status: response.status,
      id: responseData.id,
      model: responseData.model,
      usage: responseData.usage,
      citationCount: responseData.citations?.length || 0
    });
    
    return responseData;
  } catch (error: any) {
    console.error(`[ERROR] Perplexity API request failed: ${error?.message || String(error)}`);
    throw error;
  }
}

// Get complete book information by ISBN using Perplexity
export async function getBookByISBN(isbn: string, language: string = "de"): Promise<Partial<Book> | null> {
  // Create a unique ID for this lookup for logging
  const lookupId = `perplexity_isbn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book with ISBN: ${isbn} using Perplexity`);
  
  // Create a clear system message focused on accurate ISBN lookup
  const systemMessage = `You are a professional librarian specializing in book metadata with access to global bibliographic databases. Your task is to provide accurate information about a book with a specific ISBN.

CRITICALLY IMPORTANT: 
- You must ONLY return information about the EXACT ISBN provided: ${isbn}.
- If you cannot find this exact ISBN or are uncertain about any data, return null for all fields except the ISBN itself.
- NEVER invent or fabricate book data - accuracy is essential.
- It is BETTER to return null values than to provide incorrect information.

Provide your response in this JSON format:
{
  "title": "Full book title",
  "subtitle": "Subtitle if available, otherwise null",
  "author": "Author name",
  "publisher": "Publisher name",
  "publishedYear": year (as number),
  "location": "Publication location/city",
  "edition": "Edition information",
  "pageCount": number of pages (as number),
  "dimensions": "Physical dimensions (e.g., '21 x 14 cm')",
  "binding": "Binding type (e.g., 'Hardcover', 'Paperback')",
  "price": "Price with currency (e.g., '24,99 €')",
  "isbn": "${isbn}",
  "language": "Original language of the book",
  "translator": "Translator name if applicable, otherwise null",
  "illustrator": "Illustrator name if applicable, otherwise null",
  "summary": "Detailed summary of approximately 1000 characters (150 words)",
  "genres": ["Genre1", "Genre2", "Genre3"],
  "themes": ["Theme1", "Theme2", "Theme3"],
  "readingLevel": "Reading level description",
  "catalogNumber": "Library catalog classification number",
  "secondaryClassification": "Secondary classification code",
  "interestCategory": "Interest category (e.g., 'IK: Geschichte; ab 10')",
  "idBNumber": "ID-B reference number if available"
}

Critical Guidelines:
1. ONLY provide information for the EXACT ISBN: ${isbn}
2. If you cannot find adequate information about this specific ISBN, simply return:
   {
     "isbn": "${isbn}",
     "title": null,
     "author": null
   }
3. Never fabricate or guess at data - use null for any fields where verifiable information is unavailable
4. Ensure the summary contains specific details from the actual book, approximately 1000 characters (150 words)
5. Provide the response in ${language} language
6. Include 2-5 accurate genres and themes that reflect the book's actual content
7. Include standard library classification information when available
8. The ISBN must be included verbatim in your response
9. Be especially careful that the author and title match the exact ISBN

Return ONLY the JSON object, no introduction or explanation.`;

  // Simple user message that focuses solely on the ISBN
  const userMessage = `Find complete information for book with ISBN: ${isbn}`;

  // Log the request
  apiLogger.logRequest("Perplexity", {
    operation: "getBookByISBN",
    isbn,
    language,
    lookupId
  });

  try {
    // Make a single clean request to Perplexity
    const response = await makePerplexityRequest(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.1 } // Low temperature for factual accuracy
    );

    // Get the raw response content
    const content = response.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const bookData = JSON.parse(content);
      
      // Verify that we have the essential data (title and author)
      if (!bookData.title || !bookData.author) {
        console.log(`[${lookupId}] Perplexity returned incomplete data (missing title or author) for ISBN: ${isbn}`);
        apiLogger.logError("Perplexity", {
          error: "Missing essential fields in Perplexity response",
          isbn,
          lookupId,
        });
        return null;
      }
      
      // Verify that the ISBN matches what we requested
      if (bookData.isbn) {
        const normalizedRequestedISBN = isbn.replace(/[-\s]/g, '');
        const normalizedReturnedISBN = bookData.isbn.replace(/[-\s]/g, '');
        
        if (normalizedRequestedISBN !== normalizedReturnedISBN) {
          console.log(`[${lookupId}] ISBN mismatch: Requested ${isbn}, but Perplexity returned ${bookData.isbn}`);
          apiLogger.logError("Perplexity", {
            error: "ISBN mismatch in Perplexity response",
            requestedISBN: isbn,
            returnedISBN: bookData.isbn,
            lookupId,
          });
          return null;
        }
      }
      
      // Additional validation checks to detect incorrect responses
      const dataIntegrityChecks = [
        // Check 1: ISBN at least appears in the summary or any metadata field
        { 
          check: () => {
            // First verify the ISBN appears in any key metadata fields
            const isbnNoHyphens = isbn.replace(/[-\s]/g, '');
            const summaryText = bookData.summary || '';
            const publisherText = bookData.publisher || '';
            const authorText = bookData.author || '';
            const titleText = bookData.title || '';
            
            // Look for ISBN digits in the key metadata
            const textToCheck = `${summaryText} ${publisherText} ${authorText} ${titleText}`;
            const containsISBNPattern = isbnNoHyphens.replace(/(.{3})/g, '$1[\\s-]*').replace(/^(97[89])/, '(?:$1)?');
            const hasISBNMentioned = new RegExp(containsISBNPattern).test(textToCheck.replace(/[-\s]/g, ''));
            
            return hasISBNMentioned;
          },
          errorMessage: "ISBN is not mentioned or present in any of the book's metadata fields"
        },
        
        // Check 2: Require minimum book metadata to be populated
        {
          check: () => {
            // Ensure we have at least 3 of these key fields
            const requiredFields = [
              bookData.publisher,
              bookData.publishedYear,
              bookData.pageCount,
              bookData.binding,
              bookData.genres && Array.isArray(bookData.genres) && bookData.genres.length > 0,
              bookData.location,
              bookData.language
            ];
            
            const validFieldCount = requiredFields.filter(field => field).length;
            return validFieldCount >= 3;
          },
          errorMessage: "Insufficient metadata provided - book data appears to be fabricated"
        },
        
        // Check 3: Genres and themes should be consistent with book content and specific 
        {
          check: () => {
            // Check for overly generic themes/genres which indicate a made-up response
            const genericTerms = ['fiction', 'non-fiction', 'literature', 'book', 'novel', 'story'];
            const genres = Array.isArray(bookData.genres) ? bookData.genres : [];
            const themes = Array.isArray(bookData.themes) ? bookData.themes : [];
            
            // If we have genres/themes, they shouldn't all be generic terms
            if (genres.length > 0 || themes.length > 0) {
              const allItems = [...genres, ...themes].map(item => item?.toLowerCase?.() || '');
              const specificItems = allItems.filter(item => 
                !genericTerms.some(term => item === term || item.includes(`${term}`))
              );
              
              // At least 50% of genres/themes should be specific
              return specificItems.length >= Math.ceil(allItems.length * 0.5);
            }
            
            return true; // Skip this check if no genres/themes provided
          },
          errorMessage: "Genres and themes appear to be generic and not specific to this book"
        },
        
        // Check 4: Summary should be substantial and specific
        {
          check: () => {
            const summary = bookData.summary || '';
            
            // Summary should be of reasonable length (at least 300 chars)
            if (summary.length < 300) {
              return false;
            }
            
            // Check for specific content - the summary should mention the title or characters
            // or specific plot elements
            const titleWords = bookData.title.split(/\s+/).filter((w: string) => w.length > 3);
            const titleMentioned = titleWords.some((word: string) => 
              summary.toLowerCase().includes(word.toLowerCase())
            );
            
            // The summary should include some specific details that give confidence
            // it's actually about this book
            return titleMentioned || summary.includes(bookData.author);
          },
          errorMessage: "Summary appears generic, too short, or unrelated to the book"
        }
      ];
      
      // Run all integrity checks
      const failedChecks = dataIntegrityChecks
        .filter(check => !check.check())
        .map(check => check.errorMessage);
      
      if (failedChecks.length > 0) {
        console.log(`[${lookupId}] Perplexity response failed integrity checks for ISBN ${isbn}:`);
        failedChecks.forEach(error => console.log(`[${lookupId}] - ${error}`));
        
        apiLogger.logError("Perplexity", {
          error: "Data integrity check failed",
          isbn,
          lookupId,
          reasons: failedChecks
        });
        
        return null;
      }
      
      // Log successful result
      console.log(`[${lookupId}] Successfully retrieved book data from Perplexity: "${bookData.title}" by ${bookData.author}`);
      apiLogger.logResponse("Perplexity", {
        operation: "getBookByISBN",
        status: "success",
        title: bookData.title,
        author: bookData.author,
        isbn,
        lookupId,
      });
      
      // Log the bibliographic data for debugging
      console.log(`[${lookupId}] BIBLIOGRAPHIC DATA CHECK from Perplexity:`);
      console.log(`- Title: "${bookData.title}"`);
      console.log(`- Author: "${bookData.author}"`);
      console.log(`- ISBN: ${bookData.isbn}`);
      console.log(`- Page Count: ${bookData.pageCount} (type: ${typeof bookData.pageCount})`);
      console.log(`- Dimensions: ${bookData.dimensions}`);
      console.log(`- Binding: ${bookData.binding}`);
      console.log(`- Edition: ${bookData.edition}`);
      console.log(`- Location: ${bookData.location}`);
      console.log(`- Publisher: ${bookData.publisher}`);
      
      return bookData;
    } catch (error: any) {
      // Handle JSON parsing errors
      console.log(`[${lookupId}] Failed to parse Perplexity response for ISBN: ${isbn}`);
      apiLogger.logError("Perplexity", {
        error: "Failed to parse Perplexity response JSON",
        content: content.substring(0, 100) + "...",
        errorMessage: error?.message || String(error),
        lookupId,
      });
      return null;
    }
  } catch (error: any) {
    // Handle API request errors
    console.log(`[${lookupId}] Perplexity API request failed for ISBN: ${isbn}`);
    apiLogger.logError("Perplexity", {
      error: "Perplexity API request failed",
      message: error?.message || String(error),
      lookupId,
    });
    return null;
  }
}

// Find similar books using Perplexity
export async function findSimilarBooks(book: Partial<Book>, language: string = "de"): Promise<any[]> {
  const { title, author, genres, themes } = book;
  
  // Ensure we have minimum required information
  if (!title || !author) {
    return [];
  }
  
  // Create a unique ID for this request
  const requestId = `perplexity_similar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${requestId}] Finding similar books to "${title}" by ${author}`);
  
  // Create a clean system message
  const systemMessage = `You are a professional librarian with expertise in book recommendations. Your task is to find books similar to the provided book information.

Book information:
- Title: ${title}
- Author: ${author}
${genres && Array.isArray(genres) && genres.length > 0 ? `- Genres: ${genres.join(", ")}` : ""}
${themes && Array.isArray(themes) && themes.length > 0 ? `- Themes: ${themes.join(", ")}` : ""}

Provide your recommendations as a JSON array of book objects with this structure:
[
  {
    "title": "Book title",
    "subtitle": "Subtitle if available, otherwise null",
    "author": "Author name",
    "publisher": "Publisher name if available",
    "publishedYear": year (as number),
    "isbn": "ISBN if available",
    "summary": "Brief description of the book",
    "genres": ["Genre1", "Genre2"],
    "similarityReason": "Brief explanation of why this book is similar"
  },
  ... additional books ...
]

Guidelines:
1. Recommend 3-5 books that are genuinely similar in theme, style, or content
2. DO NOT include the original book in your recommendations
3. Provide accurate information - do not fabricate details
4. Provide the response in ${language} language
5. Include a brief reason for each recommendation
6. Focus on high-quality literary recommendations

Return ONLY the JSON array, no introduction or explanation.`;

  // Simple user message
  const userMessage = `Find books similar to "${title}" by ${author}`;

  try {
    // Make a single clean request to Perplexity
    const response = await makePerplexityRequest(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.3 } // Slightly higher temperature for creative recommendations
    );

    // Get the raw response content
    const content = response.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const similarBooks = JSON.parse(content);
      
      if (!Array.isArray(similarBooks) || similarBooks.length === 0) {
        console.log(`[${requestId}] Perplexity returned no valid similar books`);
        return [];
      }
      
      // Log success
      console.log(`[${requestId}] Successfully found ${similarBooks.length} similar books`);
      return similarBooks;
    } catch (error: any) {
      // Handle JSON parsing errors
      console.log(`[${requestId}] Failed to parse Perplexity similar books response: ${error?.message || String(error)}`);
      return [];
    }
  } catch (error: any) {
    // Handle API request errors
    console.log(`[${requestId}] Perplexity API request failed for similar books: ${error?.message || String(error)}`);
    return [];
  }
}