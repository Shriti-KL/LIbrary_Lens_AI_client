import OpenAI from "openai";
import { Book, BookAnalysisRequest, AnalysisOption } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Handle book cover analysis
export async function analyzeBookCover(image: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a book cataloging expert. Analyze this book cover image and extract all relevant metadata for library cataloging. Be comprehensive and accurate. Respond in German language."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this book cover image and extract the following information with high accuracy:\n1. Book title (exact as shown)\n2. Author name (full name as shown)\n3. Publisher (if visible)\n4. ISBN (if visible)\n5. Publication year (if visible)\n6. Brief description of cover design\n\nRespond with a JSON object with keys: title, author, publisher, isbn, publishedYear, coverDescription. Use null for any fields not visible or unclear. Be as accurate as possible with the visible text on the cover."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Lower temperature for more accurate extraction
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Ensure we have at least a title and author
    if (!result.title && !result.author) {
      throw new Error("Could not extract title or author from book cover");
    }
    
    return result;
  } catch (error) {
    console.error("Error analyzing book cover:", error);
    throw new Error(`Failed to analyze book cover: ${error.message}`);
  }
}

// Generate a summary for a book
export async function generateBookSummary(bookInfo: Partial<Book>): Promise<string> {
  try {
    const context = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ''}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ''}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a literary expert who creates concise, informative book summaries for library catalogs. Focus on plot, main themes, and significance. Always respond in German language."
        },
        {
          role: "user",
          content: `Create a concise, informative summary in German for the following book that would be appropriate for a library catalog. Keep it under 250 words.\n\n${context}`
        }
      ],
    });

    const content = response.choices[0].message.content;
    return content ? content.trim() : "No summary available";
  } catch (error: any) {
    console.error("Error generating book summary:", error);
    throw new Error(`Failed to generate book summary: ${error.message}`);
  }
}

// Extract genres for a book
export async function extractBookGenres(bookInfo: Partial<Book>): Promise<string[]> {
  try {
    const context = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a library cataloging expert who specializes in classifying books by genre. Identify the primary and secondary genres for this book. Always respond in German language."
        },
        {
          role: "user",
          content: `Based on the following book information, identify 3-5 genres that best categorize this book. Return your response as a JSON array of strings with only the genre names in German.\n\n${context}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return Array.isArray(result.genres) ? result.genres : [];
  } catch (error) {
    console.error("Error extracting book genres:", error);
    throw new Error(`Failed to extract book genres: ${error.message}`);
  }
}

// Extract themes for a book
export async function extractBookThemes(bookInfo: Partial<Book>): Promise<any[]> {
  try {
    const context = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a literary analysis expert specializing in identifying themes and motifs in books. Always respond in German language."
        },
        {
          role: "user",
          content: `Identify 3 major themes or motifs for the following book. For each theme, provide a short description in German. Return as a JSON array with objects containing 'theme' and 'description' properties.\n\n${context}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return Array.isArray(result.themes) ? result.themes : [];
  } catch (error) {
    console.error("Error extracting book themes:", error);
    throw new Error(`Failed to extract book themes: ${error.message}`);
  }
}

// Determine reading level for a book
export async function assessReadingLevel(bookInfo: Partial<Book>): Promise<any> {
  try {
    const context = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an education specialist who assesses reading levels for books. Always respond in German language."
        },
        {
          role: "user",
          content: `Assess the appropriate reading level for this book. Return a JSON object with 'level' (a string like 'Grade 4-5' or 'Ages 12-14'), and 'score' (a number from 1-10 representing complexity).\n\n${context}`
        }
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error assessing reading level:", error);
    throw new Error(`Failed to assess reading level: ${error.message}`);
  }
}

// Generate a library catalog entry
export async function generateCatalogEntry(bookInfo: Partial<Book>): Promise<string> {
  try {
    const context = `Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ''}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ''}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ''}
${bookInfo.isbn ? `ISBN: ${bookInfo.isbn}` : ''}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : bookInfo.genres}` : ''}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a professional librarian who creates standardized catalog entries following library catalog conventions. Always respond in German language."
        },
        {
          role: "user",
          content: `Create a formal library catalog entry for this book following standard cataloging conventions. Include a Dewey Decimal classification if possible.\n\n${context}`
        }
      ],
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating catalog entry:", error);
    throw new Error(`Failed to generate catalog entry: ${error.message}`);
  }
}

// Process the full book analysis
export async function processBookAnalysis(analysisRequest: BookAnalysisRequest): Promise<Partial<Book>> {
  try {
    // Create a unique ID for this analysis request
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Log the incoming data for debugging
    console.log(`[${analysisId}] ProcessBookAnalysis input:`, {
      title: analysisRequest.title,
      author: analysisRequest.author,
      hasCoverImage: !!analysisRequest.coverImage,
      existingSummary: !!analysisRequest.summary
    });
    
    // Start fresh with a new book object, ignoring any existing analysis fields
    const bookInfo: Partial<Book> = {
      title: analysisRequest.title || "",
      author: analysisRequest.author || "",
      isbn: analysisRequest.isbn || null,
      coverImageUrl: analysisRequest.coverImageUrl || null,
      publisher: analysisRequest.publisher || null,
      publishedYear: analysisRequest.publishedYear || null,
      // Handle the cover image data if provided
      ...(analysisRequest.coverImage && { coverImageUrl: analysisRequest.coverImage }),
      
      // Reset all analysis fields
      summary: null,
      genres: null,
      themes: null,
      readingLevel: null,
      catalogEntry: null,
      deweyDecimal: null,
      metadata: {}
    };
    
    const options = analysisRequest.options || {
      summary: true,
      genres: true,
      themes: true,
      readingLevel: true,
      catalogEntry: true,
    };
    
    console.log(`[${analysisId}] Starting fresh analysis for "${bookInfo.title}" by ${bookInfo.author}`);

    // Process book analysis in sequence
    if (options.summary) {
      bookInfo.summary = await generateBookSummary(bookInfo);
    }
    
    if (options.genres) {
      bookInfo.genres = await extractBookGenres(bookInfo);
    }
    
    if (options.themes) {
      bookInfo.themes = await extractBookThemes(bookInfo);
    }
    
    if (options.readingLevel) {
      const readingLevelInfo = await assessReadingLevel(bookInfo);
      bookInfo.readingLevel = readingLevelInfo.level;
      bookInfo.metadata = {
        ...(bookInfo.metadata || {}),
        readingLevelScore: readingLevelInfo.score
      };
    }
    
    if (options.catalogEntry) {
      bookInfo.catalogEntry = await generateCatalogEntry(bookInfo);
      
      // Extract Dewey Decimal from catalog entry if present
      const deweyMatch = bookInfo.catalogEntry.match(/Dewey:\s*([0-9.]+)/i);
      if (deweyMatch && deweyMatch[1]) {
        bookInfo.deweyDecimal = deweyMatch[1];
      }
    }

    return bookInfo;
  } catch (error) {
    console.error("Error processing book analysis:", error);
    throw new Error(`Failed to process book analysis: ${error.message}`);
  }
}
