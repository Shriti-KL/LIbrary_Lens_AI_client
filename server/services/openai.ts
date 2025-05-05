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
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";
    
    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)"
    };
    
    const languageName = languageNames[language] || languageNames.de;
    
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
          content: `You are a literary expert who creates concise, informative book summaries for library catalogs. Focus on plot, main themes, and significance. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Create a concise, informative summary in ${languageName} for the following book that would be appropriate for a library catalog. Keep it under 250 words.\n\n${context}`
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
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";
    
    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)"
    };
    
    const languageName = languageNames[language] || languageNames.de;
    
    const context = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a library cataloging expert who specializes in classifying books by genre. Identify the primary and secondary genres for this book. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Based on the following book information, identify 3-5 genres that best categorize this book. Return your response as a JSON array of strings with only the genre names in ${languageName}.\n\n${context}`
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
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";
    
    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)"
    };
    
    const languageName = languageNames[language] || languageNames.de;
    
    const context = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a literary analysis expert specializing in identifying themes and motifs in books. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Identify 3 major themes or motifs for the following book. For each theme, provide a short description in ${languageName}. Return as a JSON array with objects containing 'theme' and 'description' properties.\n\n${context}`
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
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";
    
    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)"
    };
    
    const languageName = languageNames[language] || languageNames.de;
    
    const context = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are an education specialist who assesses reading levels for books. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Assess the appropriate reading level for this book. Return a JSON object with 'level' (a string in ${languageName} like 'Klasse 4-5' or 'Alter 12-14' for German), and 'score' (a number from 1-10 representing complexity).\n\n${context}`
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
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";
    
    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)"
    };
    
    const languageName = languageNames[language] || languageNames.de;
    
    // Collect all available bibliographic information
    const context = `Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ''}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ''}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ''}
${bookInfo.isbn ? `ISBN: ${bookInfo.isbn}` : ''}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : bookInfo.genres}` : ''}
${bookInfo.dimensions ? `Dimensions: ${bookInfo.dimensions}` : ''}
${bookInfo.edition ? `Edition: ${bookInfo.edition}` : ''}
${bookInfo.binding ? `Binding: ${bookInfo.binding}` : ''}
${bookInfo.series ? `Series: ${bookInfo.series}` : ''}
${bookInfo.contributors && Array.isArray(bookInfo.contributors) && bookInfo.contributors.length > 0 
  ? `Contributors: ${bookInfo.contributors.map((c: any) => `${c.name} (${c.role})`).join(', ')}` 
  : ''}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional librarian who creates standardized catalog entries following library catalog conventions. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Create a formal library catalog entry in ${languageName} for this book following standard cataloging conventions for ${languageName}. Include a Dewey Decimal classification if possible.\n\n${context}`
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
      
      // Include the language parameter
      language: analysisRequest.language || "de",
      
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
      
      // Extract other bibliographic details from catalog entry if not already present
      if (!bookInfo.dimensions) {
        const dimensionsMatch = bookInfo.catalogEntry.match(/(\d+\s*[xX]\s*\d+\s*(?:cm|mm))/);
        if (dimensionsMatch && dimensionsMatch[1]) {
          bookInfo.dimensions = dimensionsMatch[1];
        }
      }
      
      if (!bookInfo.edition) {
        const editionMatch = bookInfo.catalogEntry.match(/((?:\d+(?:st|nd|rd|th)|Erste[rnms]?|Zweite[rnms]?|Dritte[rnms]?|Vierte[rnms]?)[\s\-.](?:Aufl(?:age)?|Ausg(?:abe)?|Ed(?:ition)?))/i);
        if (editionMatch && editionMatch[1]) {
          bookInfo.edition = editionMatch[1];
        }
      }
      
      if (!bookInfo.publisher && !bookInfo.location) {
        const publisherMatch = bookInfo.catalogEntry.match(/([A-Z][a-zA-Z\s]+)\s*:\s*([A-Z][a-zA-Z\s]+)/);
        if (publisherMatch) {
          bookInfo.location = publisherMatch[1].trim();
          bookInfo.publisher = publisherMatch[2].trim();
        }
      }
      
      if (!bookInfo.binding) {
        const bindingMatch = bookInfo.catalogEntry.match(/(Hardcover|Gebunden|Broschiert|Taschenbuch|Paperback|Festeinband)/i);
        if (bindingMatch && bindingMatch[1]) {
          bookInfo.binding = bindingMatch[1];
        }
      }
      
      // Check for illustrator information
      const illustratorMatch = bookInfo.catalogEntry.match(/Illustr(?:ation(?:en)?|\.)\s+(?:von|by)\s+([^.,;]+)/i);
      if (illustratorMatch && illustratorMatch[1]) {
        // Add illustrator to contributors if not already present
        const illustratorName = illustratorMatch[1].trim();
        if (!bookInfo.contributors || !Array.isArray(bookInfo.contributors)) {
          bookInfo.contributors = [];
        }
        
        // Check if this illustrator is already in contributors
        const hasIllustrator = bookInfo.contributors.some((c: any) => 
          c.role === 'illustrator' && c.name === illustratorName
        );
        
        if (!hasIllustrator) {
          bookInfo.contributors.push({
            role: 'illustrator',
            name: illustratorName
          });
        }
      }
    }

    return bookInfo;
  } catch (error) {
    console.error("Error processing book analysis:", error);
    throw new Error(`Failed to process book analysis: ${error.message}`);
  }
}
