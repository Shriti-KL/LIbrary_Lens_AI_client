/**
 * OpenAI service for book analysis and content generation
 */

import OpenAI from "openai";
import { Book, BookAnalysisRequest } from "@shared/schema";
import { apiLogger } from "../utils/logger";
import { detectHallucination, getHallucinationIndicators } from "../utils/hallucination";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. 
// Do not change this unless explicitly requested by the user
const GPT_MODEL = "gpt-4o";

/**
 * Handle book cover analysis - Extract metadata from a book cover image
 * @param image Base64 encoded image data
 * @returns Extracted book metadata
 */
export async function analyzeBookCover(image: string): Promise<any> {
  try {
    // Log the request
    apiLogger.logRequest("OpenAI API", {
      operation: "analyzeBookCover",
      model: GPT_MODEL,
      hasCoverImage: !!image
    });

    if (!image) {
      throw new Error("No image provided for analysis");
    }

    // Send the image to OpenAI for analysis
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: 
            "You are a specialist in extracting bibliographic information from book covers. " +
            "Analyze the image and extract as much information as possible in German language, including: title, " +
            "subtitle, author, publisher, ISBN, and any other visible metadata. " +
            "If you can see a summary on the back cover, include it. " +
            "Format your response as a JSON object with fields: title, subtitle, author, publisher, publishedYear, pageCount, " +
            "isbn, summary, genres (as an array), and coverImageUrl (null since you're analyzing the image). " +
            "If you can't determine a field, set it to null. Never invent data; only report what you can see in the image. " +
            "For genre classification, follow standard library classification practices."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this book cover and extract all bibliographic information visible"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`
              }
            }
          ],
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    // Parse the response
    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Check for hallucination in any extracted text fields
    const allText = [
      result.title || "",
      result.subtitle || "",
      result.summary || "",
      result.author || ""
    ].join(" ");
    
    const hasHallucination = detectHallucination(allText);
    
    // If hallucination detected, add warning
    if (hasHallucination) {
      const indicators = getHallucinationIndicators(allText);
      console.log(`[WARNING] Hallucination detected in book cover analysis for "${result.title}":`, indicators);
      
      // Add hallucination warning to the result
      result.hallucination = {
        detected: true,
        indicators: indicators,
        warningMessage: "The extracted information may contain unreliable data."
      };
    }

    // Log the response
    apiLogger.logResponse("OpenAI API", {
      operation: "analyzeBookCover",
      model: GPT_MODEL,
      usage: response.usage,
      fieldsExtracted: Object.keys(result).filter(k => result[k] !== null && result[k] !== undefined),
      hallucinationDetected: hasHallucination
    });

    return result;
  } catch (error: any) {
    console.error("Error in OpenAI book cover analysis:", error.message);
    apiLogger.logError("OpenAI API", {
      operation: "analyzeBookCover",
      error: error.message
    });

    return {
      error: `OpenAI analysis failed: ${error.message}`,
      title: null,
      author: null
    };
  }
}

/**
 * Process a book analysis request
 * @param analysisRequest Book data and analysis options
 * @returns Enhanced book metadata
 */
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest
): Promise<Partial<Book>> {
  try {
    // Log the request
    apiLogger.logRequest("OpenAI API", {
      operation: "processBookAnalysis",
      model: GPT_MODEL,
      language: analysisRequest.language,
      isbn: analysisRequest.isbn,
      title: analysisRequest.title,
      author: analysisRequest.author
    });

    // Initial data from the request
    const { title, author, isbn, language = "de", coverImageData } = analysisRequest;

    // If we have a cover image, analyze it
    if (coverImageData) {
      console.log("Cover image provided, analyzing image first");
      const imageAnalysisResult = await analyzeBookCover(coverImageData);
      
      // Merge image analysis with provided data, prioritizing provided data
      Object.keys(imageAnalysisResult).forEach(key => {
        if (!analysisRequest[key] && imageAnalysisResult[key]) {
          analysisRequest[key] = imageAnalysisResult[key];
        }
      });
    }

    // Create system prompt for enhanced book analysis
    const systemPrompt = `
You are an expert librarian specializing in book classification and metadata enhancement. 
Your task is to analyze book information and enhance it according to library standards.

Important guidelines:
1. Work in the ${language === "de" ? "German" : language} language
2. Generate a summary of approximately 150 words (1000 characters)
3. Classify the book into appropriate genres (library categories)
4. Identify key themes
5. Provide reading level and interest category information
6. Follow German library standards for cataloging and classification

Never invent factual data:
- If ISBN, title, or author are provided, use them exactly as given
- For library classification, use standard German bibliographic practices
- Only enhance metadata, don't contradict provided information

Return your analysis as a complete JSON object with these fields:
- isbn: ISBN number (use provided value or null)
- title: Book title (use provided value or null)
- subtitle: Book subtitle (if any)
- author: Main author's name
- statementOfResponsibility: Full attribution statement
- publisher: Publisher's name
- publishedYear: Year of publication (numeric)
- pageCount: Number of pages (numeric)
- language: Language code (e.g., "de" for German)
- edition: Edition information
- location: Publication location
- dimensions: Book dimensions
- binding: Book binding type
- price: Book price
- summary: A concise summary (~150 words)
- genres: Array of genres/categories
- coverImageUrl: URL to cover image (if any)
- ASB: Library classification code
- interestCategory: Interest category (e.g., "IK: Fantasy; ab 12")
- themes: Array of main themes
- readingLevel: Target reading level

Focus on enhancing fields that are missing or incomplete, maintaining accurate information.`;

    // Create user prompt based on available data
    let userPromptFields = [];
    if (isbn) userPromptFields.push(`ISBN: ${isbn}`);
    if (title) userPromptFields.push(`Title: ${title}`);
    if (analysisRequest.subtitle) userPromptFields.push(`Subtitle: ${analysisRequest.subtitle}`);
    if (author) userPromptFields.push(`Author: ${author}`);
    if (analysisRequest.publisher) userPromptFields.push(`Publisher: ${analysisRequest.publisher}`);
    if (analysisRequest.publishedYear) userPromptFields.push(`Published Year: ${analysisRequest.publishedYear}`);
    if (analysisRequest.pageCount) userPromptFields.push(`Page Count: ${analysisRequest.pageCount}`);
    if (analysisRequest.summary) userPromptFields.push(`Summary excerpt: ${analysisRequest.summary.substring(0, 200)}...`);
    if (analysisRequest.genres && analysisRequest.genres.length > 0) userPromptFields.push(`Genres: ${analysisRequest.genres.join(", ")}`);

    const userPrompt = `
Please analyze this book information and enhance the metadata according to library standards.
${userPromptFields.join("\n")}

Return a complete JSON object with enhanced and standardized metadata for this book.
Focus on providing complete information where data is missing, especially:
- A well-written summary 
- Appropriate genre classification
- Themes and subject matter
- Reading level and interest category
- ASB classification`;

    // Send request to OpenAI
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000
    });

    // Parse the response
    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Check for hallucination in the summary
    const summaryText = result.summary || "";
    const hasHallucination = detectHallucination(summaryText);
    
    // If we detect hallucination, log it and mark in the result
    if (hasHallucination) {
      const indicators = getHallucinationIndicators(summaryText);
      console.log(`[WARNING] Hallucination detected in book analysis for "${result.title}":`, indicators);
      
      // Add hallucination warning to the result
      result.hallucination = {
        detected: true,
        indicators: indicators,
        warningMessage: "This summary may contain unreliable information."
      };
    }

    // Log the full result for debugging
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[${analysisId}] FULL OPENAI RESULT OBJECT:`, result);

    // Log successful response
    apiLogger.logResponse("OpenAI API", {
      operation: "processBookAnalysis",
      status: "success",
      model: GPT_MODEL,
      usage: response.usage,
      fieldsProvided: Object.keys(result).filter(k => result[k] !== null && result[k] !== undefined),
      hallucinationDetected: hasHallucination
    });

    return result;
  } catch (error: any) {
    console.error("Error in OpenAI book analysis:", error.message);
    apiLogger.logError("OpenAI API", {
      operation: "processBookAnalysis",
      error: error.message
    });

    // Return basic data if available with type assertion to handle nullable values
    return {
      isbn: analysisRequest.isbn as string | undefined,
      title: analysisRequest.title as string | undefined,
      author: analysisRequest.author as string | undefined,
      error: `OpenAI analysis failed: ${error.message}`
    };
  }
}

/**
 * Find similar books based on reference book
 * @param book Reference book to find similar titles for
 * @returns Array of suggested similar books
 */
export async function searchSimilarBooks(book: Partial<Book>): Promise<any[]> {
  try {
    if (!book.title || !book.author) {
      return [];
    }
    
    // Create defensive copies of genres and themes for type safety
    const bookGenres = book.genres ? 
      (Array.isArray(book.genres) ? book.genres : []) : [];
    const bookThemes = book.themes ? 
      (Array.isArray(book.themes) ? book.themes : []) : [];

    // Log the request
    apiLogger.logRequest("OpenAI API", {
      operation: "searchSimilarBooks",
      model: GPT_MODEL,
      title: book.title,
      author: book.author
    });

    // Create prompt for similar books recommendation
    const systemPrompt = `
You are a knowledgeable librarian expert in book recommendations. 
Your task is to recommend 5 similar books to the one described.
Each recommendation should include:
- title: Full title of the book
- author: Author's full name
- publishedYear: Publication year (if known)
- isbn: ISBN (if known)
- reason: Brief explanation for why this book is similar

Return ONLY a JSON array of 5 recommendations without any preamble or explanations.
Use similar genres, themes, writing styles or time periods as the basis for recommendations.
Focus on quality literary connections, not superficial similarities.
Recommendations should be for real books that actually exist, not fictional ones.`;

    const userPrompt = `
Recommend 5 books similar to:
Title: ${book.title}
Author: ${book.author}
${book.summary ? `Summary: ${book.summary.substring(0, 300)}...` : ''}
${bookGenres.length > 0 ? `Genres: ${bookGenres.join(', ')}` : ''}
${bookThemes.length > 0 ? `Themes: ${bookThemes.join(', ')}` : ''}

Return ONLY a JSON array of 5 similar book recommendations.`;

    // Send request to OpenAI
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 1000
    });

    // Parse response
    const results = JSON.parse(response.choices[0].message.content || "[]");

    // Check for hallucinations in the recommendations
    if (Array.isArray(results)) {
      for (let i = 0; i < results.length; i++) {
        const book = results[i];
        const bookText = [
          book.title || "",
          book.author || "",
          book.reason || ""
        ].join(" ");
        
        const hasHallucination = detectHallucination(bookText);
        
        if (hasHallucination) {
          const indicators = getHallucinationIndicators(bookText);
          console.log(`[WARNING] Hallucination detected in similar book recommendation #${i+1}:`, indicators);
          
          // Add hallucination warning to the result
          results[i].hallucination = {
            detected: true,
            indicators: indicators,
            warningMessage: "This recommendation may contain unreliable information."
          };
        }
      }
    }

    // Log the response
    apiLogger.logResponse("OpenAI API", {
      operation: "searchSimilarBooks",
      status: "success",
      model: GPT_MODEL,
      usage: response.usage,
      resultsCount: Array.isArray(results) ? results.length : 0,
      hallucinationsDetected: Array.isArray(results) 
        ? results.filter(r => r.hallucination?.detected).length 
        : 0
    });

    // Normalize response to ensure it's an array
    const recommendations = Array.isArray(results) ? results : 
                          (results.recommendations || results.books || []);

    // Return the recommendations
    return recommendations;
  } catch (error: any) {
    console.error("Error finding similar books:", error.message);
    apiLogger.logError("OpenAI API", {
      operation: "searchSimilarBooks",
      error: error.message
    });
    return [];
  }
}