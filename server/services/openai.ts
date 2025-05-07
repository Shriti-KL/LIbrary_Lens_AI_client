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

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from book cover analysis");
    }
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parsing book cover JSON:", parseError);
      throw new Error("Failed to parse book cover analysis results");
    }
    
    // Ensure we have at least a title and author
    if (!result.title && !result.author) {
      throw new Error("Could not extract title or author from book cover");
    }
    
    return result;
  } catch (error: any) {
    console.error("Error analyzing book cover:", error);
    throw new Error(`Failed to analyze book cover: ${error.message || String(error)}`);
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
          content: `You are a literary expert who creates concise, informative book summaries for library catalogs. Focus on plot, main themes, and significance. Always respond in ${languageName}. Your summaries must be EXACTLY 150 words (approximately 1000 characters) and contain NO metadata or bibliographic information.`
        },
        {
          role: "user",
          content: `Create a concise, informative summary in ${languageName} for the following book that would be appropriate for a library catalog. 

IMPORTANT REQUIREMENTS:
1. The summary MUST be EXACTLY 150 words (approximately 1000 characters).
2. Do NOT include any metadata like title, author, publisher, etc. in the summary itself.
3. Focus only on the content/plot of the book.
4. Start directly with the content without phrases like "This book is about..."
5. Use proper paragraphs with good structure.

Book information:
${context}`
        }
      ],
    });

    const content = response.choices[0].message.content;
    let summary = content ? content.trim() : "No summary available";
    
    // Clean up any metadata that might still be in the summary
    const metadataPatterns = [
      /\*\*Titel:\*\*.*\n?/i,
      /\*\*Autor(?:in)?:\*\*.*\n?/i,
      /\*\*Erscheinungsjahr:\*\*.*\n?/i,
      /\*\*ISBN:\*\*.*\n?/i,
      /\*\*Verlag:\*\*.*\n?/i,
      /Titel:.*\n?/i,
      /Autor(?:in)?:.*\n?/i,
      /Erscheinungsjahr:.*\n?/i,
      /ISBN:.*\n?/i,
      /Verlag:.*\n?/i
    ];
    
    // Apply all patterns to clean up the summary
    metadataPatterns.forEach(pattern => {
      summary = summary.replace(pattern, '');
    });
    
    // Remove any extra whitespace and multiple newlines
    summary = summary.replace(/\n\s*\n/g, '\n').trim();
    
    return summary;
  } catch (error: any) {
    console.error("Error generating book summary:", error);
    throw new Error(`Failed to generate book summary: ${error.message || String(error)}`);
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
    
    // Add more context data to improve genre extraction
    let contextText = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ''}
${bookInfo.publishedYear ? `Published Year: ${bookInfo.publishedYear}` : ''}`;

    // Include metadata from Google Books if available
    if (bookInfo.metadata && typeof bookInfo.metadata === 'object') {
      const metadata = bookInfo.metadata as Record<string, any>;
      if (metadata.categories && Array.isArray(metadata.categories)) {
        contextText += `\nGoogle Books Categories: ${metadata.categories.join(', ')}`;
      }
    }

    console.log(`Extracting genres for "${bookInfo.title}" by "${bookInfo.author}"`);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a library cataloging expert who specializes in classifying books by genre. Identify the primary and secondary genres for this book. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Based on the following book information, identify 3-5 genres that best categorize this book. Return your response as a JSON object with a "genres" property that contains an array of strings with only the genre names in ${languageName}.\n\n${contextText}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for genres");
      return [];
    }
    
    console.log(`OpenAI genre response: ${content}`);
    
    try {
      const result = JSON.parse(content);
      
      if (Array.isArray(result.genres)) {
        return result.genres;
      } else if (result.genres && typeof result.genres === 'string') {
        // Handle case where it might return a comma-separated string instead of array
        return result.genres.split(',').map((genre: string) => genre.trim());
      } else {
        // Handle case where the genres might be in the root of the JSON
        const potentialGenres = Object.values(result).find(value => Array.isArray(value));
        if (potentialGenres && Array.isArray(potentialGenres)) {
          return potentialGenres;
        }
        
        console.log("No genres array found in the response");
        return [];
      }
    } catch (parseError) {
      console.error("Error parsing genres JSON:", parseError);
      // Try to extract genres from raw text if JSON parsing fails
      try {
        // Look for patterns that might indicate genres in the text
        const genreMatches = content.match(/["'\[\]\{]([^"'\[\]\{\}]+)["'\[\]\}]/g);
        if (genreMatches && genreMatches.length > 0) {
          return genreMatches
            .map(match => match.replace(/["'\[\]\{\}]/g, '').trim())
            .filter(Boolean);
        }
      } catch (e) {
        console.error("Error in fallback genre extraction:", e);
      }
      return [];
    }
  } catch (error: any) {
    console.error("Error extracting book genres:", error);
    return []; // Return empty array instead of throwing to avoid breaking the whole analysis
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
    
    // Create context with more information
    let contextText = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : bookInfo.genres}` : ''}`;

    console.log(`Extracting themes for "${bookInfo.title}" by "${bookInfo.author}"`);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a literary analysis expert specializing in identifying themes and motifs in books. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Identify 3 major themes or motifs for the following book. For each theme, provide a short description in ${languageName}. Return as a JSON object containing a "themes" array with objects containing 'theme' and 'description' properties.\n\n${contextText}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for themes");
      return [];
    }
    
    console.log(`OpenAI themes response: ${content}`);
    
    try {
      const result = JSON.parse(content);
      
      if (Array.isArray(result.themes)) {
        return result.themes;
      } else if (Array.isArray(result)) {
        // Handle case where it might return a direct array
        return result;
      } else {
        // Check if we have objects in the response with theme/description keys
        const potentialThemesArray = Object.values(result).find(value => 
          Array.isArray(value) && 
          value.length > 0 && 
          typeof value[0] === 'object' && 
          'theme' in value[0]
        );
        
        if (potentialThemesArray && Array.isArray(potentialThemesArray)) {
          return potentialThemesArray;
        }
        
        console.log("No valid themes array found in the response");
        return [];
      }
    } catch (parseError) {
      console.error("Error parsing themes JSON:", parseError);
      return [];
    }
  } catch (error: any) {
    console.error("Error extracting book themes:", error);
    return []; // Return empty array instead of throwing to avoid breaking the analysis
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
    
    // Create context with more information
    let contextText = `Book Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ''}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : bookInfo.genres}` : ''}`;

    console.log(`Assessing reading level for "${bookInfo.title}" by "${bookInfo.author}"`);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are an education specialist who assesses reading levels for books. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Assess the appropriate reading level for this book. Return a JSON object with 'level' (a string in ${languageName} like 'Klasse 4-5' or 'Alter 12-14' for German), and 'score' (a number from 1-10 representing complexity).\n\n${contextText}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for reading level");
      return { level: "Unbekannt", score: 5 };
    }
    
    console.log(`OpenAI reading level response: ${content}`);
    
    try {
      const result = JSON.parse(content);
      
      // Check if we have the expected fields
      if (result && 'level' in result && 'score' in result) {
        return {
          level: result.level,
          score: Number(result.score) || 5
        };
      }
      
      // Look for alternative structure
      if (result && typeof result === 'object') {
        // Try to extract level and score from any fields that might contain them
        const level = result.level || result.readingLevel || result.reading_level || "Unbekannt";
        let score = result.score || result.complexity || result.readingScore || 5;
        
        // Make sure score is a number between 1-10
        score = Number(score);
        if (isNaN(score) || score < 1 || score > 10) {
          score = 5;
        }
        
        return { level, score };
      }
      
      console.log("Could not find valid reading level information in the response");
      return { level: "Unbekannt", score: 5 };
    } catch (parseError) {
      console.error("Error parsing reading level JSON:", parseError);
      return { level: "Unbekannt", score: 5 };
    }
  } catch (error: any) {
    console.error("Error assessing reading level:", error);
    return { level: "Unbekannt", score: 5 }; // Return default values instead of throwing
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
    let contextText = `Title: ${bookInfo.title || 'Unknown'}
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

    console.log(`Generating catalog entry for "${bookInfo.title}" by "${bookInfo.author}"`);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional librarian who creates standardized catalog entries following library catalog conventions. Always respond in ${languageName}.`
        },
        {
          role: "user",
          content: `Create a formal library catalog entry in ${languageName} for this book following standard cataloging conventions for ${languageName}. Include a Dewey Decimal classification if possible.\n\n${contextText}`
        }
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for catalog entry");
      return "Keine Kataloginformationen verfügbar";
    }
    
    console.log(`Generated catalog entry with length: ${content.length} characters`);
    return content.trim();
  } catch (error: any) {
    console.error("Error generating catalog entry:", error);
    return "Keine Kataloginformationen verfügbar"; // Return default instead of throwing
  }
}

// Generate German library catalog specific classifications and data
export async function generateGermanLibraryCatalogData(bookInfo: Partial<Book>): Promise<Partial<Book>> {
  try {
    // Determine language for content generation (default to German)
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
    
    // Compile book information for context
    let contextText = `Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ''}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ''}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ''}
${bookInfo.isbn ? `ISBN: ${bookInfo.isbn}` : ''}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : bookInfo.genres}` : ''}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ''}`;

    console.log(`Generating German library catalog data for "${bookInfo.title}" by "${bookInfo.author}"`);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a German library cataloging expert who creates ASB (Allgemeine Systematik für Bibliotheken) classifications and catalog entries. Generate data that exactly matches the German library catalog format.`
        },
        {
          role: "user",
          content: `Generate German library catalog specific fields for this book. 
Return a JSON object with the following fields:
- catalogNumber: an ASB classification number (like "103.485.0")
- categories: an array of applicable ASB categories
- secondaryClassification: a secondary classification like "4.3/Y" or "6.1/Aax"
- reviewerName: a German reviewer name in the format "Firstname Lastname"
- interestCategory: an interest category in the format "IK: Category; ab X" where X is an age
- idBNumber: an ID-B number in the format "ID-B YY/ZZ" where YY is the year and ZZ is a sequence number

The response should be valid JSON.

Book information:
${contextText}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for German library catalog data");
      return {};
    }
    
    console.log(`Generated German library catalog data response: ${content}`);
    
    try {
      const result = JSON.parse(content);
      return {
        catalogNumber: result.catalogNumber,
        categories: result.categories,
        secondaryClassification: result.secondaryClassification,
        reviewerName: result.reviewerName,
        interestCategory: result.interestCategory,
        idBNumber: result.idBNumber
      };
    } catch (parseError) {
      console.error("Error parsing German library catalog data JSON:", parseError);
      return {};
    }
  } catch (error: any) {
    console.error("Error generating German library catalog data:", error);
    return {}; // Return empty object instead of throwing to avoid breaking the analysis
  }
}

// Extract missing bibliographic fields from AI
export async function extractMissingBibliographicData(bookInfo: Partial<Book>): Promise<Partial<Book>> {
  try {
    // Add debug information to identify the book being processed
    console.log(`DEBUG bibliographic extraction for book: "${bookInfo.title}" by "${bookInfo.author}"`);
    
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
${bookInfo.summary ? `Summary: ${bookInfo.summary.substring(0, 200)}...` : ''}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : bookInfo.genres}` : ''}`;

    // Identify missing fields
    const missingFields = [];
    if (!bookInfo.pageCount) missingFields.push('pageCount');
    if (!bookInfo.binding) missingFields.push('binding');
    if (!bookInfo.dimensions) missingFields.push('dimensions');
    if (!bookInfo.edition) missingFields.push('edition');
    if (!bookInfo.location) missingFields.push('location');
    if (!bookInfo.publisher) missingFields.push('publisher');

    // Skip if we have all the fields
    if (missingFields.length === 0) {
      console.log("All bibliographic fields are present, skipping AI extraction");
      return bookInfo;
    }

    console.log(`Attempting to extract missing bibliographic fields: ${missingFields.join(', ')}`);

    // Add a random request ID to track this specific extraction
    const extractionId = `bibex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[${extractionId}] Extracting bibliographic data for "${bookInfo.title}" by "${bookInfo.author}"`);
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional librarian specialized in bibliographic data. Always respond in ${languageName} and provide JSON format. IMPORTANT: Do not use generic placeholder values - each book should have unique, specific bibliographic characteristics based on its genre, publishing norms, and content.`
        },
        {
          role: "user",
          content: `Based on the available information about "${bookInfo.title}" by "${bookInfo.author}", provide realistic estimates for the missing bibliographic data. 

Return a JSON object with the following fields that are specific to THIS BOOK:
- pageCount: A realistic page count for this specific book based on its genre and content. Different books should have different page counts. (just the number, no text)
- binding: The likely binding type for this book (e.g., "Hardcover", "Taschenbuch", "Gebunden", etc.)
- dimensions: Realistic physical dimensions for this book (e.g., "14.5 x 21.2 cm")
- edition: Likely edition information (e.g., "1. Auflage", "Zweite Ausgabe", etc.)
- location: Publisher's location/city
- publisher: Publisher name (if missing)

IMPORTANT RULES:
1. Provide significantly different values for different books - do not default to 320 pages for every book
2. Use realistic dimensions that vary by book type and genre
3. If you cannot estimate a field with confidence, leave it as null
4. Base your estimates on typical characteristics for the book's genre and content
5. Consider the book's publication year when estimating format and dimensions
6. For pageCount, please provide a specific number that makes sense for this book - 
   academic books might be 400-600 pages, while novels might be 250-350 pages, and children's books 32-80 pages

Available information:
${context}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.9, // Increase temperature further for more variation
    });
    
    // Log the raw response for debugging
    console.log(`[${extractionId}] OpenAI raw response: ${response.choices[0].message.content}`);

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from AI for bibliographic data extraction");
      return bookInfo;
    }
    
    let extractedData;
    try {
      extractedData = JSON.parse(content);
      
      // DEBUG: Log detailed information about the extracted data
      console.log(`DEBUG: Bibliographic data for "${bookInfo.title}" by "${bookInfo.author}":`);
      console.log(`- Page count: ${extractedData.pageCount || 'null'}`);
      console.log(`- Binding: ${extractedData.binding || 'null'}`);
      console.log(`- Dimensions: ${extractedData.dimensions || 'null'}`);
      console.log(`- Edition: ${extractedData.edition || 'null'}`);
      console.log(`- Location: ${extractedData.location || 'null'}`);
      console.log(`- Publisher: ${extractedData.publisher || 'null'}`);
      
    } catch (parseError) {
      console.error("Error parsing bibliographic data JSON:", parseError);
      return bookInfo;
    }

    // Make sure to parse pageCount as a number
    const pageCount = extractedData.pageCount ? 
      (typeof extractedData.pageCount === 'string' ? 
        parseInt(extractedData.pageCount, 10) : 
        extractedData.pageCount) : 
      null;
    
    // Explicitly log final values before returning
    console.log(`[${extractionId}] FINAL extracted bibliographic values:`);
    console.log(`- Page count: ${pageCount} (original: ${extractedData.pageCount}, type: ${typeof extractedData.pageCount})`);
    console.log(`- Binding: ${extractedData.binding}`);
    console.log(`- Dimensions: ${extractedData.dimensions}`);
    
    // Merge the extracted data with the book info, only using AI data where we lack actual data
    return {
      ...bookInfo,
      pageCount: bookInfo.pageCount || pageCount || null,
      binding: bookInfo.binding || extractedData.binding || null,
      dimensions: bookInfo.dimensions || extractedData.dimensions || null,
      edition: bookInfo.edition || extractedData.edition || null,
      location: bookInfo.location || extractedData.location || null,
      publisher: bookInfo.publisher || extractedData.publisher || null,
    };
  } catch (error: any) {
    console.error("Error extracting missing bibliographic data:", error);
    return bookInfo; // Return original book info on error
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
    let bookInfo: Partial<Book> = {
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
      
      // Generate German library catalog specific data
      const germanLibraryCatalogData = await generateGermanLibraryCatalogData(bookInfo);
      
      // Merge the German library catalog data with the book info
      bookInfo = {
        ...bookInfo,
        catalogNumber: germanLibraryCatalogData.catalogNumber || null,
        categories: germanLibraryCatalogData.categories || [],
        secondaryClassification: germanLibraryCatalogData.secondaryClassification || null,
        reviewerName: germanLibraryCatalogData.reviewerName || null,
        interestCategory: germanLibraryCatalogData.interestCategory || null,
        idBNumber: germanLibraryCatalogData.idBNumber || null,
      };
      
      // Check for illustrator information in catalog entry
      if (bookInfo.catalogEntry) {
        const illustratorMatch = bookInfo.catalogEntry.match(/Illustr(?:ation(?:en)?|\.)\s+(?:von|by)\s+([^.,;]+)/i);
        if (illustratorMatch && illustratorMatch[1]) {
          // Add illustrator to contributors if not already present
          const illustratorName = illustratorMatch[1].trim();
          
          // Initialize contributors array if it doesn't exist or isn't an array
          // Use type assertion to handle the unknown type
          const contributors: {role: string, name: string}[] = Array.isArray(bookInfo.contributors) 
            ? [...(bookInfo.contributors as {role: string, name: string}[])] 
            : [];
          
          // Check if this illustrator is already in contributors
          const hasIllustrator = contributors.some((c: any) => 
            c.role === 'illustrator' && c.name === illustratorName
          );
          
          if (!hasIllustrator) {
            contributors.push({
              role: 'illustrator',
              name: illustratorName
            });
            
            // Update the book info with the new contributors array
            bookInfo = {
              ...bookInfo,
              contributors
            };
          }
        }
      }
    }
    
    // Check if we have all required bibliographic data, if not use AI to fill missing fields
    const fieldsToCheck = ['pageCount', 'binding', 'dimensions', 'edition', 'location', 'publisher'] as const;
    const missingFields = fieldsToCheck.filter(field => 
      !bookInfo[field as keyof typeof bookInfo]);
    
    if (missingFields.length > 0) {
      console.log(`Missing bibliographic fields detected: ${missingFields.join(', ')}. Attempting to extract using AI.`);
      bookInfo = await extractMissingBibliographicData(bookInfo);
    }

    return bookInfo;
  } catch (error: any) {
    console.error("Error processing book analysis:", error);
    throw new Error(`Failed to process book analysis: ${error.message || String(error)}`);
  }
}
