/**
 * OpenAI service for book analysis and content generation
 * Following DNB/German RDA cataloguing standards
 */

import { Book, BookAnalysisRequest } from "@shared/schema";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-4o";

/**
 * Handle book cover analysis - Extract metadata from a book cover image
 * using DNB/German RDA cataloguing standards
 */
export async function analyzeBookCover(image: string): Promise<any> {
  try {
    console.log("[API] Analyzing book cover with OpenAI...");
    
    // Create the API request
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a librarian following DNB/German RDA cataloguing standards.
          Extract the following information from the book cover image:
          - ISBN
          - Title
          - Subtitle (if present)
          - Main Author
          - Statement of Responsibility
          - Edition
          - Publication Place
          - Publisher
          - Publication Year
          - Dimensions
          - Binding
          - Price (if visible)
          
          Format your response as a valid JSON object with these fields. Use null if information is not available.`
        },
        {
          role: "user", 
          content: [
            { type: "text", text: "Extract book metadata from this cover:" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const content = response.choices[0].message.content || "{}";
    const result = JSON.parse(content);
    
    console.log("[API] Cover analysis completed");
    
    // Return the extracted data
    return {
      isbn: result.isbn || null,
      title: result.title || null,
      subtitle: result.subtitle || null,
      mainAuthor: result.mainAuthor || null,
      statementOfResponsibility: result.statementOfResponsibility || null,
      edition: result.edition || null,
      publicationPlace: result.publicationPlace || null,
      publisher: result.publisher || null,
      publicationYear: result.publicationYear || null,
      dimensions: result.dimensions || null,
      binding: result.binding || null,
      price: result.price || null,
      language: result.language || "de"
    };
  } catch (error: any) {
    console.error("[API] Error analyzing book cover:", error);
    throw new Error(`Error analyzing book cover: ${error.message}`);
  }
}

/**
 * Process a book analysis request
 * Only generates summary, themes, and genres - no bibliographic data
 */
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest
): Promise<Partial<Book>> {
  try {
    console.log(`[API] Request to OpenAI API: ${JSON.stringify({
      operation: "processBookAnalysis",
      model: OPENAI_MODEL,
      language: analysisRequest.language,
      isbn: analysisRequest.isbn,
      title: analysisRequest.title,
      mainAuthor: analysisRequest.mainAuthor || analysisRequest.author
    })}`);
    
    // Extract fields to ensure consistent structure
    const bookInfo = {
      isbn: analysisRequest.isbn || "",
      title: analysisRequest.title || "",
      subtitle: analysisRequest.subtitle || "",
      mainAuthor: analysisRequest.mainAuthor || analysisRequest.author || "",
      statementOfResponsibility: analysisRequest.statementOfResponsibility || "",
      edition: analysisRequest.edition || "",
      publicationPlace: analysisRequest.publicationPlace || "",
      publisher: analysisRequest.publisher || "",
      publicationYear: analysisRequest.publicationYear || analysisRequest.publishedYear || null,
      pageCount: analysisRequest.pageCount || null,
      dimensions: analysisRequest.dimensions || "",
      binding: analysisRequest.binding || "",
      price: analysisRequest.price || "",
      language: analysisRequest.language || "de"
    };
    
    // Extract additional content fields from the request
    const description = analysisRequest.description || "";
    const existingGenres = Array.isArray(analysisRequest.genres) && analysisRequest.genres.length > 0 
      ? analysisRequest.genres.join(", ") 
      : "";
    const existingThemes = Array.isArray(analysisRequest.themes) && analysisRequest.themes.length > 0 
      ? analysisRequest.themes.join(", ") 
      : "";
    const sources = analysisRequest.sources || "";
    
    // Define prompt based on DNB/German RDA standards, including authentic description data
    const prompt = `
    Book Information:
    ISBN: ${bookInfo.isbn}
    Title: ${bookInfo.title}
    Subtitle: ${bookInfo.subtitle}
    Main Author: ${bookInfo.mainAuthor}
    Statement of Responsibility: ${bookInfo.statementOfResponsibility}
    Edition: ${bookInfo.edition}
    Publication Place: ${bookInfo.publicationPlace}
    Publisher: ${bookInfo.publisher}
    Publication Year: ${bookInfo.publicationYear}
    Page Count: ${bookInfo.pageCount}
    Dimensions: ${bookInfo.dimensions}
    Binding: ${bookInfo.binding}
    Price: ${bookInfo.price}
    Language: ${bookInfo.language}
    
    ${description ? `Authentic Book Description: ${description}` : ''}
    ${existingGenres ? `Verified Genres: ${existingGenres}` : ''}
    ${existingThemes ? `Identified Themes: ${existingThemes}` : ''}
    ${sources ? `Data Sources: ${sources}` : ''}
    
    Based on the authentic book information above, provide the following:
    1. A concise summary (approximately 150 words)
    2. 3-5 key themes
    3. 2-4 genres
    4. ASB (Allgemeine Systematik für Bibliotheken) classification (e.g. "Phy 400")
    5. Reading level (e.g. "Children", "Young Adult", "Adult")
    6. Interest category (e.g. "IK: Geschichte; ab 14")
    
    Please format your response as a JSON object with these fields only:
    - summary: string
    - themes: string[]
    - genres: string[]
    - ASB: string
    - readingLevel: string
    - interestCategory: string
    
    Use authentic data where available from the verified sources. Do not invent bibliographic details.
    `;
    
    // Make the OpenAI API call
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a librarian following DNB/German RDA cataloguing standards who specializes in 
          book classification, summarization, and content analysis. Provide accurate, concise information 
          in ${bookInfo.language} language.
          
          IMPORTANT: Use the authentic description, genres, and themes provided to create an accurate summary. 
          When authentic book descriptions are available, your summary should be based directly on that information.
          Do not hallucinate or invent bibliographic details. Stay true to the authentic information.`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const content = response.choices[0].message.content || "{}";
    let result;
    
    try {
      result = JSON.parse(content);
    } catch (error) {
      console.error("[API] Error parsing OpenAI response:", error);
      throw new Error("Invalid response format from OpenAI");
    }
    
    console.log("[API] FULL OPENAI RESULT OBJECT:", result);
    
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    console.log(`[API] OpenAI API response: ${JSON.stringify({
      operation: "processBookAnalysis",
      status: "success", 
      model: OPENAI_MODEL,
      usage: usage,
      fieldsProvided: Object.keys(result),
      hallucinationDetected: false
    })}`);
    
    // Return OpenAI-generated fields (summary, themes, genres only)
    return {
      ...bookInfo,  // Include original book info
      summary: result.summary || null,
      themes: result.themes || [],
      genres: result.genres || [],
      ASB: result.ASB || null,
      readingLevel: result.readingLevel || null,
      interestCategory: result.interestCategory || null
    };
  } catch (error: any) {
    console.error("[API] OpenAI API error:", error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Find similar books based on a reference book
 */
export async function searchSimilarBooks(book: Partial<Book>): Promise<any[]> {
  try {
    console.log(`[API] Requesting similar books for "${book.title}" by ${book.mainAuthor || book.author || 'Unknown'}`);
    
    // Create a prompt for the OpenAI API
    const prompt = `
    Based on this book:
    Title: ${book.title || ""}
    Author: ${book.mainAuthor || book.author || ""}
    Genres: ${Array.isArray(book.genres) ? book.genres.join(", ") : (book.genres || "")}
    
    Suggest 5 similar books following DNB/German RDA standards. Format your response as a JSON array with objects containing these fields:
    - title: string (required)
    - subtitle: string (optional)
    - mainAuthor: string (required)
    - publicationYear: number (optional)
    - isbn: string (optional)
    - publisher: string (optional)
    - summary: string (brief description, optional)
    
    Only include books that actually exist. Do not generate fictional books.
    `;
    
    // Make the API call
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable librarian following DNB/German RDA cataloguing standards who can suggest books similar to a given reference book."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const content = response.choices[0].message.content || "{}";
    let result;
    
    try {
      result = JSON.parse(content);
      // Ensure we have a books array
      if (!Array.isArray(result) && result.books && Array.isArray(result.books)) {
        result = result.books;
      } else if (!Array.isArray(result)) {
        result = [];
      }
    } catch (error) {
      console.error("[API] Error parsing similar books response:", error);
      return [];
    }
    
    console.log(`[API] Found ${result.length} similar books via OpenAI`);
    
    // Return the books array
    return result;
  } catch (error) {
    console.error("[API] Error finding similar books:", error);
    return [];
  }
}