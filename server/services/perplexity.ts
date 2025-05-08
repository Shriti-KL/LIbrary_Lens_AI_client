import { BookAnalysisRequest, Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";

// Define the structure of a Perplexity API request
interface PerplexityRequest {
  model: string;
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  search_domain_filter?: string[];
  return_images?: boolean;
  return_related_questions?: boolean;
  search_recency_filter?: string;
  top_k?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

// Define the structure of a Perplexity API response
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
    delta?: {
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

// Make a request to the Perplexity API
async function makePerplexityRequest(
  messages: PerplexityRequest["messages"],
  options: Partial<PerplexityRequest> = {}
): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY environment variable is required");
  }

  // Default options with sensible values
  const defaultOptions: Partial<PerplexityRequest> = {
    model: "llama-3.1-sonar-small-128k-online",
    temperature: 0.2,
    top_p: 0.9,
    return_images: false,
    return_related_questions: false,
    search_recency_filter: "month",
    stream: false,
    presence_penalty: 0,
    frequency_penalty: 1,
  };

  // Combine default options with provided options
  const requestOptions: PerplexityRequest = {
    ...defaultOptions,
    ...options,
    messages,
  };

  // Log the request details (redacted for security)
  apiLogger.logRequest("Perplexity", {
    operation: "chat/completions",
    model: requestOptions.model,
    messageCount: requestOptions.messages.length,
    promptPreview: requestOptions.messages[requestOptions.messages.length - 1].content.substring(0, 100) + "...",
  });

  try {
    // Make the request to the Perplexity API
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestOptions),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Log the successful response
    apiLogger.logResponse("Perplexity", {
      status: response.status,
      id: data.id,
      model: data.model,
      usage: data.usage,
      citationCount: data.citations?.length || 0,
    });

    return data;
  } catch (error) {
    // Log the error
    apiLogger.logError("Perplexity", error);
    throw error;
  }
}

// Process a book analysis request using Perplexity
export async function processBookAnalysisWithPerplexity(
  analysisRequest: BookAnalysisRequest
): Promise<Partial<Book>> {
  const { title, author, isbn, language } = analysisRequest;

  // Create the identifier string based on available information
  const identifiers = [];
  if (isbn) identifiers.push(`ISBN: ${isbn}`);
  if (title) identifiers.push(`Title: ${title}`);
  if (author) identifiers.push(`Author: ${author}`);
  const bookIdentifiers = identifiers.join(", ");

  // Use English for the query to get the most accurate information
  const queryLanguage = "English";
  // But request the response in the user's preferred language
  const responseLanguage = language || "en";

  // Create the system message (instructions to Perplexity)
  const systemMessage = `You are a professional librarian and book researcher with expertise in cataloging books and creating comprehensive metadata records. 
Your task is to analyze a book and provide detailed information about it.

Output Format:
Provide a valid JSON response with the following structure:
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
  "price": "Price with currency (e.g., '24,99')",
  "isbn": "ISBN number with proper formatting",
  "language": "Original language of the book",
  "summary": "Detailed summary of approximately 1000 characters (150 words)",
  "genres": ["Genre1", "Genre2", "Genre3"],
  "themes": ["Theme1", "Theme2", "Theme3"],
  "readingLevel": "Reading level description",
  "catalogNumber": "Library catalog classification number (if available)",
  "secondaryClassification": "Secondary classification code (if available)",
  "interestCategory": "Interest category (e.g., 'IK: Geschichte; ab 10')",
  "idBNumber": "ID-B reference number (if available)"
}

Important Guidelines:
1. Provide real, factual information only. Do not invent or fabricate details.
2. If information is not available, use null for that field.
3. For summary: Focus on the book's content, approximately 1000 characters (150 words).
4. For genres: Provide 2-5 specific genres that accurately describe the book.
5. For themes: Identify 2-5 main themes or subjects covered in the book.
6. For readingLevel: Include target age group and reading difficulty when applicable.
7. For catalogNumber and secondaryClassification: Provide standard library classification codes if known.
8. Use German library standards for catalog formatting when appropriate.
9. Respond in ${responseLanguage} language, but maintain proper names in their original form.

Do not show your reasoning process, just provide the JSON response.`;

  // Create the user message (the actual query)
  const userMessage = `Find detailed information about the following book: ${bookIdentifiers}. 
Provide real, factual information only. If information is not available, use null for that field.`;

  // Log the analysis request
  apiLogger.logRequest("Perplexity", {
    operation: "processBookAnalysis",
    model: "llama-3.1-sonar-small-128k-online",
    bookIdentifiers,
    queryLanguage,
    responseLanguage,
  });

  try {
    // Make the request to Perplexity
    const response = await makePerplexityRequest(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.2
      }
    );

    // Extract the content from the response
    const content = response.choices[0].message.content;

    // Parse the JSON response
    let bookData: Partial<Book>;
    try {
      bookData = JSON.parse(content);

      // Validate the essential fields
      if (!bookData.title || !bookData.author) {
        apiLogger.logError("Perplexity", {
          error: "Missing essential fields in Perplexity response",
          content: content.substring(0, 100) + "...",
        });
        return null;
      }

      // Log successful processing
      apiLogger.logResponse("Perplexity", {
        operation: "processBookAnalysis",
        status: "success",
        bookTitle: bookData.title,
        responseLength: content.length,
      });

      // Log the bibliographic data for debugging
      console.log("[analysis] BIBLIOGRAPHIC DATA CHECK from Perplexity:");
      console.log(`- Title: "${bookData.title}"`);
      console.log(`- Author: "${bookData.author}"`);
      console.log(`- Page Count: ${bookData.pageCount} (type: ${typeof bookData.pageCount})`);
      console.log(`- Dimensions: ${bookData.dimensions}`);
      console.log(`- Binding: ${bookData.binding}`);
      console.log(`- Edition: ${bookData.edition}`);
      console.log(`- Location: ${bookData.location}`);
      console.log(`- Publisher: ${bookData.publisher}`);

      return bookData;
    } catch (error) {
      apiLogger.logError("Perplexity", {
        error: "Failed to parse Perplexity response JSON",
        content: content.substring(0, 100) + "...",
        errorMessage: error.message,
      });
      return null;
    }
  } catch (error) {
    apiLogger.logError("Perplexity", {
      error: "Perplexity API request failed",
      message: error.message,
    });
    return null;
  }
}

// Search for books using Perplexity
export async function searchBooksWithPerplexity(
  params: { query?: string; title?: string; author?: string; isbn?: string }
): Promise<any[]> {
  const { query, title, author, isbn } = params;
  
  // Create the search query based on available parameters
  let searchQuery = "";
  if (query) searchQuery += `Query: ${query} `;
  if (title) searchQuery += `Title: ${title} `;
  if (author) searchQuery += `Author: ${author} `;
  if (isbn) searchQuery += `ISBN: ${isbn} `;
  searchQuery = searchQuery.trim();
  
  // If no search parameters are provided, return an empty array
  if (!searchQuery) {
    return [];
  }

  // Create the system message (instructions to Perplexity)
  const systemMessage = `You are a professional book search engine. 
Your task is to find books matching the given search parameters and return a list of results.

Provide your answer in JSON format as an array of book objects with the following structure:
[
  {
    "title": "Book title",
    "subtitle": "Subtitle if available, otherwise null",
    "author": "Author name",
    "publisher": "Publisher name",
    "publishedYear": year (as number),
    "isbn": "ISBN (if available)",
    "description": "Brief description of the book",
    "categories": ["Category1", "Category2"],
    "imageLinks": {
      "thumbnail": "URL to thumbnail image if available"
    }
  },
  ... additional books ...
]

Important Guidelines:
1. Return only real books that match the search parameters.
2. Limit the results to 5 books maximum.
3. If no books match the search parameters, return an empty array [].
4. If a field is not available, use null for that field.
5. Be precise and accurate with book information.
6. Do not invent or fabricate details about the books.

Return only the JSON array with no additional text or explanations.`;

  // Create the user message (the actual query)
  const userMessage = `Search for books with the following parameters: ${searchQuery}`;

  // Log the search request
  apiLogger.logRequest("Perplexity", {
    operation: "searchBooks",
    searchQuery,
  });

  try {
    // Make the request to Perplexity
    const response = await makePerplexityRequest(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.1,
        
      }
    );

    // Extract the content from the response
    const content = response.choices[0].message.content;

    // Parse the JSON response
    try {
      const books = JSON.parse(content);
      
      // Log successful search
      apiLogger.logResponse("Perplexity", {
        operation: "searchBooks",
        status: "success",
        resultsCount: books.length,
      });
      
      return books;
    } catch (error) {
      apiLogger.logError("Perplexity", {
        error: "Failed to parse Perplexity search response JSON",
        content: content.substring(0, 100) + "...",
        errorMessage: error.message,
      });
      return [];
    }
  } catch (error) {
    apiLogger.logError("Perplexity", {
      error: "Perplexity API search request failed",
      message: error.message,
    });
    return [];
  }
}

// Find similar books using Perplexity
export async function findSimilarBooksWithPerplexity(book: Partial<Book>): Promise<any[]> {
  const { title, author, genres, themes } = book;
  
  // Create a description of the book to find similar books
  let bookDescription = "";
  if (title) bookDescription += `Title: ${title} `;
  if (author) bookDescription += `Author: ${author} `;
  if (genres && genres.length > 0) bookDescription += `Genres: ${genres.join(", ")} `;
  if (themes && themes.length > 0) bookDescription += `Themes: ${themes.join(", ")} `;
  bookDescription = bookDescription.trim();
  
  // If insufficient information is provided, return an empty array
  if (!title || !author) {
    return [];
  }

  // Create the system message (instructions to Perplexity)
  const systemMessage = `You are a professional book recommendation system.
Your task is to find books that are similar to the provided book and return a list of recommendations.

Provide your answer in JSON format as an array of book objects with the following structure:
[
  {
    "title": "Book title",
    "subtitle": "Subtitle if available, otherwise null",
    "author": "Author name",
    "publisher": "Publisher name",
    "publishedYear": year (as number),
    "isbn": "ISBN (if available)",
    "description": "Brief description of the book",
    "categories": ["Category1", "Category2"],
    "imageLinks": {
      "thumbnail": "URL to thumbnail image if available"
    },
    "similarityReason": "Brief explanation of why this book is similar to the original"
  },
  ... additional books ...
]

Important Guidelines:
1. Find books that are genuinely similar in theme, style, content, or genre to the provided book.
2. Do not include the original book in the recommendations.
3. Limit the results to 5 books maximum.
4. Be precise and accurate with book information.
5. Include a brief explanation of why each book is similar to the original.
6. Do not invent or fabricate details about the books.

Return only the JSON array with no additional text or explanations.`;

  // Create the user message (the actual query)
  const userMessage = `Find books similar to the following: ${bookDescription}`;

  // Log the similar books request
  apiLogger.logRequest("Perplexity", {
    operation: "findSimilarBooks",
    bookDescription,
  });

  try {
    // Make the request to Perplexity
    const response = await makePerplexityRequest(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.3,
        
      }
    );

    // Extract the content from the response
    const content = response.choices[0].message.content;

    // Parse the JSON response
    try {
      const similarBooks = JSON.parse(content);
      
      // Log successful search
      apiLogger.logResponse("Perplexity", {
        operation: "findSimilarBooks",
        status: "success",
        resultsCount: similarBooks.length,
      });
      
      return similarBooks;
    } catch (error) {
      apiLogger.logError("Perplexity", {
        error: "Failed to parse Perplexity similar books response JSON",
        content: content.substring(0, 100) + "...",
        errorMessage: error.message,
      });
      return [];
    }
  } catch (error) {
    apiLogger.logError("Perplexity", {
      error: "Perplexity API similar books request failed",
      message: error.message,
    });
    return [];
  }
}

// Get book by ISBN using Perplexity
export async function getBookByISBNWithPerplexity(isbn: string): Promise<any | null> {
  // Create the system message (instructions to Perplexity)
  const systemMessage = `You are a professional book researcher specializing in ISBN lookups.
Your task is to find detailed information about a book with the given ISBN.

Provide your answer in JSON format with the following structure:
{
  "title": "Book title",
  "subtitle": "Subtitle if available, otherwise null",
  "author": "Author name",
  "publisher": "Publisher name",
  "publishedYear": year (as number),
  "isbn": "${isbn}",
  "description": "Brief description of the book",
  "pageCount": number of pages (as number),
  "categories": ["Category1", "Category2"],
  "language": "Book language code (e.g., 'en', 'de')",
  "imageLinks": {
    "thumbnail": "URL to thumbnail image if available"
  }
}

Important Guidelines:
1. If you cannot find a book with this ISBN, return null.
2. Be precise and accurate with book information.
3. If a field is not available, use null for that field.
4. Do not invent or fabricate details about the book.

Return only the JSON object with no additional text or explanations.`;

  // Create the user message (the actual query)
  const userMessage = `Find detailed information about the book with ISBN: ${isbn}`;

  // Log the ISBN lookup request
  apiLogger.logRequest("Perplexity", {
    operation: "getBookByISBN",
    isbn,
  });

  try {
    // Make the request to Perplexity
    const response = await makePerplexityRequest(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.1,
        
      }
    );

    // Extract the content from the response
    const content = response.choices[0].message.content;

    // Parse the JSON response
    try {
      const bookData = JSON.parse(content);
      
      // If the bookData is null or doesn't have a title, consider it not found
      if (!bookData || !bookData.title) {
        apiLogger.logResponse("Perplexity", {
          operation: "getBookByISBN",
          isbn,
          found: false,
        });
        return null;
      }
      
      // Log successful lookup
      apiLogger.logResponse("Perplexity", {
        operation: "getBookByISBN",
        isbn,
        found: true,
        title: bookData.title,
        author: bookData.author,
      });
      
      return bookData;
    } catch (error) {
      apiLogger.logError("Perplexity", {
        error: "Failed to parse Perplexity ISBN lookup response JSON",
        content: content.substring(0, 100) + "...",
        errorMessage: error.message,
      });
      return null;
    }
  } catch (error) {
    apiLogger.logError("Perplexity", {
      error: "Perplexity API ISBN lookup request failed",
      message: error.message,
    });
    return null;
  }
}