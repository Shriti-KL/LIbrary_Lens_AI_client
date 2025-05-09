import OpenAI from "openai";
import { Book, BookAnalysisRequest } from "@shared/schema";
import { apiLogger } from "../utils/logger";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Map language codes to full language names for prompt clarity
const languageNames: Record<string, string> = {
  en: "English",
  de: "German (Deutsch)",
  fr: "French (Français)",
  es: "Spanish (Español)",
  zh: "Chinese (中文)",
};

/**
 * Handle book cover analysis - Extract metadata from a book cover image
 */
export async function analyzeBookCover(image: string): Promise<any> {
  try {
    // Log the request
    apiLogger.logRequest("OpenAI API", {
      operation: "analyzeBookCover",
      model: MODEL,
      imageProvided: Boolean(image),
      imageSize: image ? `${Math.round(image.length / 1024)} KB` : "0 KB",
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a book cataloging expert. Analyze this book cover image and extract all relevant metadata for library cataloging. Be comprehensive and accurate. Respond in German language.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this book cover image and extract the following information with high accuracy:\n1. Book title (exact as shown)\n2. Author name (full name as shown)\n3. Publisher (if visible)\n4. ISBN (if visible)\n5. Publication year (if visible)\n6. Brief description of cover design\n\nRespond with a JSON object with keys: title, author, publisher, isbn, publishedYear, coverDescription. Use null for any fields not visible or unclear. Be as accurate as possible with the visible text on the cover.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Lower temperature for more accurate extraction
    });

    // Process response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from book cover analysis");
    }

    const result = JSON.parse(content);
    return result;
  } catch (error: any) {
    console.error("Error analyzing book cover:", error);
    apiLogger.logError("OpenAI API", {
      operation: "analyzeBookCover",
      error: error.message || String(error),
    });
    throw error;
  }
}

/**
 * Process a book analysis request with a clean approach:
 * 1. Accept book metadata from Google Books as input
 * 2. Generate only missing metadata using a single OpenAI request
 * 3. Return well-structured JSON response
 */
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest
): Promise<Partial<Book>> {
  try {
    // Create a unique ID for this analysis request
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Determine language for content generation (default to German if not specified)
    const language = analysisRequest.language || "de";
    const languageName = languageNames[language] || languageNames.de;
    
    console.log(`[${analysisId}] Processing book analysis with request`, {
      title: analysisRequest.title,
      author: analysisRequest.author,
      isbn: analysisRequest.isbn,
      language: language,
      hasCoverImage: !!analysisRequest.coverImageData,
    });
    
    // Log the API request
    apiLogger.logRequest("OpenAI API", {
      operation: "processBookAnalysis",
      model: MODEL,
      language: language,
      isbn: analysisRequest.isbn,
      title: analysisRequest.title,
      author: analysisRequest.author,
    });

    // Prepare context with all available information as a comprehensive JSON object
    const bookContext = {
      // Basic book metadata
      isbn: analysisRequest.isbn || null,
      title: analysisRequest.title || null,
      subtitle: analysisRequest.subtitle || null,
      author: analysisRequest.author || null,
      
      // Publishing information
      publisher: analysisRequest.publisher || null,
      publishedYear: analysisRequest.publishedYear || null,
      pageCount: analysisRequest.pageCount || null,
      language: language,
      edition: analysisRequest.edition || null,
      location: analysisRequest.location || null, // Place of publication
      
      // Content-related information
      originalDescription: analysisRequest.summary || null,
      existingGenres: analysisRequest.genres || null,
      existingThemes: analysisRequest.themes || null,
      
      // Physical attributes
      binding: analysisRequest.binding || null,
      dimensions: analysisRequest.dimensions || null,
      coverImageUrl: analysisRequest.coverImageUrl || null,
      
      // Additional metadata
      translator: analysisRequest.translator || null,
      illustrator: analysisRequest.illustrator || null,
      statementOfResponsibility: analysisRequest.statementOfResponsibility || null,
      price: analysisRequest.price || null,
      
      // German-specific library fields
      deweyDecimal: analysisRequest.deweyDecimal || null,
      catalogNumber: analysisRequest.catalogNumber || null,
      secondaryClassification: analysisRequest.secondaryClassification || null,
      interestCategory: analysisRequest.interestCategory || null,
      
      // Raw metadata from Google Books if available
      metadata: analysisRequest.metadata || null
    };
    
    // Send request to OpenAI with structured JSON context and request structured JSON response
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a book metadata expert specializing in library cataloging according to German library standards. You will ONLY provide missing metadata fields, never overwrite existing data. Always respond in ${languageName} with a properly structured JSON object.`,
        },
        {
          role: "user",
          content: `I need you to analyze this book metadata and ONLY return the missing or incomplete fields from the list below, following German library standards. 

COMPLETE BOOK METADATA FROM GOOGLE BOOKS:
${JSON.stringify(bookContext, null, 2)}

IMPORTANT: ONLY return the following fields if they are MISSING or INCOMPLETE from the Google Books data. DO NOT overwrite any values already present:

1. ASB (Sachgruppenkennzeichen / Subject Category Code)
2. Main Author
3. Title and Subtitle (only if missing)
4. Statement of Responsibility (author, illustrator, etc.)
5. Edition Statement
6. Place of Publication
7. Publisher
8. Year of Publication
9. Physical Description (page numbers, dimension – only height in cm)
10. ISBN (hyphenated format)
11. Binding and Price Information
12. Descriptive Summary (approximately 150 words / 1000 characters)
13. Interest Category (IK – genre/topic and recommended age group)

Return ONLY a JSON object with this exact structure, including ONLY the fields that need to be added or completed:
{
  "catalogNumber": "ASB code if missing", // 1. ASB Subject Category Code
  "author": "Main author if missing", // 2. Main Author
  "title": "Title if missing",  // 3. Title
  "subtitle": "Subtitle if missing", // 3. Subtitle
  "statementOfResponsibility": "Full responsibility statement if missing", // 4. Statement of Responsibility
  "edition": "Edition information if missing", // 5. Edition Statement
  "location": "Place of publication if missing", // 6. Place of Publication
  "publisher": "Publisher if missing", // 7. Publisher
  "publishedYear": null, // 8. Year as number if missing
  "pageCount": null, // 9. Number of pages as number if missing
  "dimensions": "Book dimensions (height in cm) if missing", // 9. Physical Description - dimensions
  "isbn": "Hyphenated ISBN if not already formatted correctly", // 10. ISBN in hyphenated format
  "binding": "Binding type if missing", // 11. Binding information
  "price": "Price information if missing", // 11. Price information
  "summary": "Descriptive summary if missing", // 12. Book summary
  "interestCategory": "Interest category with recommended age if missing", // 13. Interest Category (IK)
  "genres": [], // Array of genres if missing
  "themes": [], // Array of themes if missing
  "readingLevel": null // Reading level if missing
}

IMPORTANT RULES:
1. ONLY include fields in your response that are missing or incomplete in the original data
2. If a field already has a valid value, DO NOT include it in your response
3. For any fields where you don't have information and cannot reasonably determine it from context, omit them entirely from your response
4. Use null for numeric fields when the value is unknown
5. DO NOT invent or make up data - only provide information that can be reasonably inferred from the provided context`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    // Process response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }
    
    try {
      // Parse and validate the returned JSON
      const result = JSON.parse(content);
      
      // Log success
      console.log(`[${analysisId}] Successfully processed book: "${result.title}" by ${result.author}`);
      apiLogger.logResponse("OpenAI API", {
        operation: "processBookAnalysis",
        status: "success",
        model: MODEL,
        usage: response.usage,
        fieldsProvided: Object.keys(result).filter(k => result[k] !== null),
      });
      
      return result;
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      apiLogger.logError("OpenAI API", {
        operation: "processBookAnalysis",
        error: "JSON parse error",
        content: content.substring(0, 200) + "...",
      });
      throw new Error("Failed to parse book analysis results");
    }
  } catch (error: any) {
    console.error("Error processing book analysis:", error);
    apiLogger.logError("OpenAI API", {
      operation: "processBookAnalysis",
      error: error.message || String(error),
    });
    
    // Return minimal data to avoid breaking the application
    return {
      title: analysisRequest.title || null,
      author: analysisRequest.author || null,
      isbn: analysisRequest.isbn || null,
    } as Partial<Book>;
  }
}

/**
 * Find similar books based on a reference book
 */
export async function searchSimilarBooks(book: Partial<Book>): Promise<any[]> {
  if (!book.title || !book.author) {
    console.log("Cannot search for similar books without title and author");
    return [];
  }
  
  try {
    // Determine language for content generation
    const language = book.language || "de";
    const languageName = languageNames[language] || languageNames.de;
    
    console.log(`Searching for books similar to "${book.title}" by ${book.author}`);
    
    // Prepare context
    const bookContext = {
      title: book.title,
      author: book.author,
      genres: book.genres || [],
      themes: book.themes || [],
      summary: book.summary ? book.summary.substring(0, 300) + "..." : null,
      language: language,
    };
    
    // Log the API request
    apiLogger.logRequest("OpenAI API", {
      operation: "searchSimilarBooks",
      model: MODEL,
      language: language,
      bookTitle: book.title,
      bookAuthor: book.author,
    });
    
    // Send request to OpenAI
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a book recommendation expert with extensive knowledge of literature. Suggest books that are similar to the reference book in terms of themes, style, or content. Always respond in ${languageName}.`,
        },
        {
          role: "user",
          content: `Suggest 3-5 books that are similar to the following book:

${JSON.stringify(bookContext, null, 2)}

For each recommendation, include:
1. Title
2. Author
3. A brief 1-2 sentence explanation of why it's similar to the reference book
4. The primary genre

Return your response as a JSON array using the following structure:
[
  {
    "title": "...",
    "author": "...",
    "similarityReason": "...",
    "primaryGenre": "..."
  },
  ...
]

IMPORTANT: Recommend actual, well-known books that exist. Do not invent fictional books.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    
    // Process response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }
    
    try {
      // Parse and process the results
      const recommendations = JSON.parse(content);
      
      // Log success
      console.log(`Found ${Array.isArray(recommendations) ? recommendations.length : 0} similar books`);
      apiLogger.logResponse("OpenAI API", {
        operation: "searchSimilarBooks",
        status: "success",
        model: MODEL,
        usage: response.usage,
        recommendationsCount: Array.isArray(recommendations) ? recommendations.length : 0,
      });
      
      // Format recommendations to match expected structure
      if (Array.isArray(recommendations)) {
        return recommendations.map(rec => ({
          title: rec.title,
          author: rec.author,
          similarityReason: rec.similarityReason,
          genres: rec.primaryGenre ? [rec.primaryGenre] : [],
          isbn: null,
          language: language,
        }));
      }
      
      return [];
    } catch (parseError) {
      console.error("Error parsing similar books JSON:", parseError);
      apiLogger.logError("OpenAI API", {
        operation: "searchSimilarBooks",
        error: "JSON parse error",
        content: content.substring(0, 200) + "...",
      });
      return [];
    }
  } catch (error: any) {
    console.error("Error searching for similar books:", error);
    apiLogger.logError("OpenAI API", {
      operation: "searchSimilarBooks",
      error: error.message || String(error),
      bookTitle: book.title,
    });
    return [];
  }
}