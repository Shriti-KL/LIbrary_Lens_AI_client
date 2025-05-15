/**
 * OpenAI service for book analysis and content generation
 * Following DNB/German RDA cataloguing standards
 */

import { Book, BookAnalysisRequest } from "@shared/schema";
import OpenAI from "openai";

// Function to create OpenAI client with session API key or fallback to environment
function createOpenAIClient(apiKey?: string) {
  // Use provided key or fall back to environment variable
  const key = apiKey || process.env.OPENAI_API_KEY;
  
  if (!key) {
    throw new Error("OpenAI API key is required but not provided");
  }
  
  return new OpenAI({ apiKey: key });
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-4o";

/**
 * Handle book cover analysis - Extract metadata from a book cover image
 * using DNB/German RDA cataloguing standards
 */
export async function analyzeBookCover(image: string, apiKey?: string): Promise<any> {
  try {
    console.log("[API] Analyzing book cover with OpenAI...");
    
    // Create OpenAI client with provided key or environment fallback
    const openai = createOpenAIClient(apiKey);
    
    // Create the API request
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a librarian following DNB/German RDA cataloguing standards.
          Extract the following information from the book cover image:
          
          1. Book title
          2. Subtitle (if present)
          3. Author name(s)
          4. ISBN (if visible)
          5. Publisher
          6. Edition information (if visible)
          7. Publication year
          8. Language
          9. Format/binding type
          10. Brief description of cover art
          
          Return the information in JSON format with these fields:
          {
            "title": "string",
            "subtitle": "string or null",
            "author": "string or null",
            "isbn": "string or null",
            "publisher": "string or null",
            "edition": "string or null",
            "publicationYear": "number or null",
            "language": "string (two-letter language code)",
            "binding": "string or null",
            "coverDescription": "string"
          }
          
          Important:
          - Only extract information that is clearly visible in the image
          - Use null for fields you cannot determine
          - For language, use two-letter codes (e.g., 'de' for German, 'en' for English)
          - Do not make up or guess any information
          - Format the JSON properly so it can be parsed`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the book information from this cover image following DNB/German RDA standards."
            },
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

    // Parse and return the JSON response
    const result = JSON.parse(response.choices[0].message.content);
    console.log("[API] Book cover analysis complete");
    return result;
  } catch (error) {
    console.error("[API] Error analyzing book cover:", error);
    return {
      error: "Failed to analyze book cover",
      details: error.message
    };
  }
}

/**
 * Process a book analysis request
 * Only generates summary, themes, and genres - no bibliographic data
 */
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest,
  apiKey?: string
): Promise<any> {
  const bookInfo = { ...analysisRequest };
  try {
    console.log("[API] Processing book analysis with OpenAI...");
    
    // Create OpenAI client with provided key or environment fallback
    const openai = createOpenAIClient(apiKey);
    
    // Build a prompt to analyze the book
    const prompt = `
    I need a professional library catalog entry for the following book in ${bookInfo.language || 'German'} language:
    
    BIBLIOGRAPHIC INFO:
    - Title: ${bookInfo.title || 'Not available'}
    - Author: ${bookInfo.author || bookInfo.mainAuthor || 'Not available'}
    - ISBN: ${bookInfo.isbn || 'Not available'}
    - Publisher: ${bookInfo.publisher || 'Not available'}
    - Publication Year: ${bookInfo.publicationYear || 'Not available'}
    - Edition: ${bookInfo.edition || 'Not available'}
    - Page Count: ${bookInfo.pageCount || 'Not available'}
    - Language: ${bookInfo.language || 'de'}
    
    ADDITIONAL CONTEXT:
    ${bookInfo.description ? `Book Description: ${bookInfo.description}` : ''}
    ${bookInfo.themes ? `Themes: ${bookInfo.themes.join(', ')}` : ''}
    ${bookInfo.subject ? `Subject: ${bookInfo.subject}` : ''}
    ${bookInfo.categories ? `Categories: ${bookInfo.categories.join(', ')}` : ''}
    ${bookInfo.genres ? `Genres: ${bookInfo.genres.join(', ')}` : ''}
    
    For this catalog entry, I need ONLY:
    
    1. A neutral, factual summary of the book's content (approximately 150 words / 1000 characters). This should be a straightforward description of what the book is about based on authentic information.
    
    2. A critical review (approximately 150 words) that evaluates the book's content and importance for a library collection. Include a recommendation for acquisition. Start the review with a "• " bullet point character.
    
    Please format your response as a JSON object with these fields only:
    - summary: string (the neutral 3-5 sentence summary)
    - review: string (the critical review starting with "• ")
    
    Use authentic data where available from the verified sources. Do not invent bibliographic details.
    Your summary should be completely factual and based on the authentic description.
    `;
    
    // Make the OpenAI API call
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional German library cataloguer following DNB/German RDA cataloguing standards who specializes in 
          book classification, summarization, and content analysis. Provide accurate information in ${bookInfo.language} language.
          
          IMPORTANT: 
          - Use the authentic description, genres, and themes provided to create an accurate summary.
          - When authentic book descriptions are available, your summary must be based directly on that information.
          - Do not hallucinate or invent bibliographic details. Stay true to the authentic information.
          - Follow the exact output format instructions in the user's prompt.`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });
    
    // Parse the response
    const result = JSON.parse(response.choices[0].message.content);
    console.log("[API] Book analysis complete");
    
    // Return the OpenAI-generated fields merged with the original request
    return {
      ...bookInfo,
      summary: result.summary,
      review: result.review
    };
  } catch (error) {
    console.error("[API] Error processing book analysis:", error);
    return {
      ...bookInfo,
      error: "Failed to process book analysis",
      details: error.message
    };
  }
}

/**
 * Find similar books based on a reference book
 */
export async function searchSimilarBooks(book: Partial<Book>, apiKey?: string): Promise<any[]> {
  try {
    console.log("[API] Searching for similar books with OpenAI...");
    
    // Create OpenAI client with provided key or environment fallback
    const openai = createOpenAIClient(apiKey);
    
    // Build a prompt to find similar books
    const prompt = `
    I need recommendations for books similar to the following:
    
    Title: ${book.title}
    Author: ${book.author || book.mainAuthor}
    Genre: ${book.genres?.join(', ') || 'Unknown'}
    Themes: ${book.themes?.join(', ') || 'Unknown'}
    Summary: ${book.summary || 'Not available'}
    
    Please suggest 5 similar books with these characteristics:
    - Similar themes, subjects, or genres
    - Books that readers of this book might also enjoy
    - A mix of classic and contemporary titles
    - Primarily in the ${book.language || 'German'} language
    
    For each recommendation, provide:
    - Title
    - Author
    - ISBN (if a specific edition is recommended)
    - Publication year
    - Publisher
    - A brief explanation of why it's similar
    
    Format your response as a valid JSON array of books:
    [
      {
        "title": "string",
        "author": "string",
        "isbn": "string or null",
        "publicationYear": number or null,
        "publisher": "string or null",
        "similarity": "string explaining why it's similar"
      },
      ...
    ]
    `;
    
    // Make the API call
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable librarian specializing in book recommendations. Your task is to suggest similar books 
          based on the information provided. Make accurate, thoughtful recommendations. Do not invent books that don't exist.
          Prioritize well-known, authentic titles that match the requested language and themes.`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });
    
    // Parse and return the results
    try {
      const result = JSON.parse(response.choices[0].message.content);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error("[API] Error parsing similar books response:", e);
      return [];
    }
  } catch (error) {
    console.error("[API] Error finding similar books:", error);
    return [];
  }
}