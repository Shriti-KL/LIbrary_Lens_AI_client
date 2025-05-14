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
 * Detect potential hallucinations in a summary
 * This is a simple approach looking for certain patterns that might indicate hallucination
 */
function detectHallucination(summary: string, title: string, author: string): boolean {
  if (!summary) return false;
  
  // Convert to lowercase for comparison
  const lowerSummary = summary.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerAuthor = author ? author.toLowerCase() : "";
  
  // Check for patterns that often indicate hallucination
  const warningPatterns = [
    // Overly specific claims when we have minimal metadata
    "based on true events",
    "bestselling",
    "critically acclaimed",
    "award-winning",
    "highly regarded",
    "masterfully",
    "beautifully written",
    "extraordinary",
    
    // Phrases that indicate judgment
    "must-read",
    "captivating",
    "engaging",
    "brilliant",
    "powerful",
    "masterpiece",
    "tour de force",
    
    // Content claims that are less likely to be known from just metadata
    "reveals the author's",
    "explores the depths of",
    "takes the reader on a journey",
    "offers a profound",
    "provides insight into",
    "reflects on the nature of",
    
    // Personal reading experience
    "readers will be",
    "readers will find",
    "compelling reading",
    "leaves the reader",
    "immerses the reader",
    
    // Marketing language
    "perfect for fans of",
    "not to be missed",
    "unforgettable"
  ];
  
  // Check for these pattern indicators
  for (const pattern of warningPatterns) {
    if (lowerSummary.includes(pattern)) {
      console.log(`[API] Hallucination warning pattern detected: "${pattern}"`);
      return true;
    }
  }
  
  // If the summary mentions "book" or "novel", it's referring to itself (not ideal)
  if (lowerSummary.includes("this book") || 
      lowerSummary.includes("the book") || 
      lowerSummary.includes("this novel") || 
      lowerSummary.includes("the novel")) {
    console.log(`[API] Hallucination warning: Summary refers to 'book' or 'novel'`);
    return true;
  }
  
  // If the summary mentions "author" or specific author name in possessive form, it's likely making claims
  if (lowerSummary.includes("the author") || 
      lowerSummary.includes("author's") ||
      (lowerAuthor && lowerSummary.includes(`${lowerAuthor}'s`))) {
    console.log(`[API] Hallucination warning: Summary refers to the author`);
    return true;
  }
  
  // No hallucination indicators found
  return false;
}

/**
 * Generate a generic summary based on title and genres only
 * Used as a fallback when hallucination is detected
 */
function generateGenericSummary(title: string, genres: string[] = []): string {
  // Check if we have any genres
  if (!genres || genres.length === 0) {
    return `Eine Veröffentlichung mit dem Titel "${title}". Keine weitere Inhaltsangabe verfügbar.`;
  }
  
  // Determine if it's fiction or non-fiction based on genres
  const fictionGenres = [
    "roman", "krimi", "thriller", "science fiction", "fantasy", "lyrik",
    "gedichte", "märchen", "kinder", "jugend", "abenteuer"
  ];
  
  const nonFictionGenres = [
    "sachbuch", "biografie", "ratgeber", "wissenschaft", "geschichte", "philosophie",
    "politik", "wirtschaft", "psychologie", "selbsthilfe", "reise"
  ];
  
  // Convert genres to lowercase for comparison
  const lowerGenres = genres.map(g => g.toLowerCase());
  
  // Check if any genres match fiction or non-fiction
  const isFiction = lowerGenres.some(g => fictionGenres.some(fg => g.includes(fg)));
  const isNonFiction = lowerGenres.some(g => nonFictionGenres.some(nfg => g.includes(nfg)));
  
  // If we can determine genre type, generate an appropriate generic summary
  if (isFiction) {
    return `Ein literarisches Werk mit dem Titel "${title}" aus dem Bereich ${genres.join(", ")}. Es handelt sich um eine fiktionale Erzählung. Weitere Details zum Inhalt sind nicht verfügbar.`;
  } else if (isNonFiction) {
    return `Ein Sachbuch mit dem Titel "${title}" zum Thema ${genres.join(", ")}. Es behandelt Aspekte und Perspektiven im genannten Fachbereich. Weitere Details zum Inhalt sind nicht verfügbar.`;
  } else {
    // Default generic summary if we can't determine
    return `Eine Veröffentlichung mit dem Titel "${title}" aus dem Bereich ${genres.join(", ")}. Weitere Details zum Inhalt sind nicht verfügbar.`;
  }
}

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
    
    // Use a web search API to get additional information about the book
    let additionalInfo = "";
    
    try {
      if (bookInfo.title && (bookInfo.mainAuthor || bookInfo.isbn)) {
        // TODO: Add web search API integration here if needed
        // Deliberately not implementing this yet until requested
      }
    } catch (error) {
      console.log("[API] Error getting additional book information:", error);
    }
    
    // Define prompt based on DNB/German RDA standards with improved summary guidelines
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
    
    ${additionalInfo}
    
    Provide the following information for this book:
    
    1. A SUMMARY that follows these strict guidelines:
       - 3-5 sentences only (approximately 100-150 words)
       - For fiction: objectively describe main characters and plot without revealing the ending
       - For non-fiction: objectively describe the key themes and approaches
       - Be factual and precise, without personal evaluation or opinion
       - Avoid phrases like "this book is about" or "this book tells the story of"
       - DO NOT mention "the author" or the book itself in the summary
       - DO NOT evaluate or judge the quality of the book
       - End the summary without any evaluation
    
    2. 3-5 key themes as single words or short phrases
    
    3. 2-4 genres following library classification standards
    
    4. ASB (Allgemeine Systematik für Bibliotheken) classification code (e.g. "Phy 400")
    
    5. Reading level (e.g. "Children", "Young Adult", "Adult")
    
    6. Interest category (e.g. "IK: Geschichte; ab 14")
    
    Please format your response as a JSON object with these fields only:
    - summary: string
    - themes: string[]
    - genres: string[]
    - ASB: string
    - readingLevel: string
    - interestCategory: string
    
    IMPORTANT: If you don't have enough information to write an accurate summary, provide a very brief, generic description based solely on the title and genre. DO NOT invent plot details, characters, or content. Do not use your training data to fill in details about the book.
    `;
    
    // Make the OpenAI API call
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional librarian following DNB/German RDA cataloguing standards who specializes in 
          book classification, summarization, and content analysis. You will:
          
          1. Provide accurate, concise information in ${bookInfo.language} language
          2. Write objective, factual summaries without personal evaluation
          3. Never invent or hallucinate book details, characters, or plot elements
          4. Only base your summary on the information directly provided to you
          5. Be extremely cautious about making claims about book content
          6. For fiction books: describe main characters and plot without revealing endings
          7. For non-fiction books: describe key themes and approaches objectively
          8. Follow the strict guidelines provided for length and content
          9. If you lack sufficient information, provide only a brief, generic description based on title and genre
          10. End all summaries without any evaluation or judgment

          Your primary goal is accuracy and objectivity over creativity.`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.1, // Lowered temperature for more deterministic output
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
    
    // Check for potential hallucinations in the summary
    let hallucinationDetected = false;
    
    if (result.summary) {
      hallucinationDetected = detectHallucination(
        result.summary, 
        bookInfo.title, 
        bookInfo.mainAuthor
      );
      
      if (hallucinationDetected) {
        console.warn("[API] WARNING: Potential hallucination detected in summary");
        // Replace potentially hallucinated summary with a generic one
        result.summary = generateGenericSummary(bookInfo.title, result.genres);
      }
    }
    
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    console.log(`[API] OpenAI API response: ${JSON.stringify({
      operation: "processBookAnalysis",
      status: "success", 
      model: OPENAI_MODEL,
      usage: usage,
      fieldsProvided: Object.keys(result),
      hallucinationDetected: hallucinationDetected
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