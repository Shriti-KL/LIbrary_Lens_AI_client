import OpenAI from "openai";
import { Book, BookAnalysisRequest, AnalysisOption } from "@shared/schema";
import { apiLogger } from "../utils/logger";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Handle book cover analysis
export async function analyzeBookCover(image: string): Promise<any> {
  try {
    // Log the request (without the actual image data for space efficiency)
    apiLogger.logRequest("OpenAI API", {
      operation: "analyzeBookCover",
      endpoint: "chat.completions.create",
      model: MODEL,
      requestType: "image analysis",
      imageProvided: Boolean(image),
      imageSize: image ? `${Math.round(image.length / 1024)} KB` : '0 KB'
    });

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

    // Log successful response
    apiLogger.logResponse("OpenAI API", {
      operation: "analyzeBookCover",
      status: "success",
      model: MODEL,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason
    });

    const content = response.choices[0].message.content;
    if (!content) {
      const errorMsg = "No content returned from book cover analysis";
      apiLogger.logError("OpenAI API", {
        operation: "analyzeBookCover",
        error: errorMsg,
        phase: "content extraction"
      });
      throw new Error(errorMsg);
    }
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parsing book cover JSON:", parseError);
      apiLogger.logError("OpenAI API", {
        operation: "analyzeBookCover",
        error: "JSON parse error",
        phase: "parsing response",
        content: content.substring(0, 200) + "..." // Include start of content for debugging
      });
      throw new Error("Failed to parse book cover analysis results");
    }
    
    // Ensure we have at least a title and author
    if (!result.title && !result.author) {
      const errorMsg = "Could not extract title or author from book cover";
      apiLogger.logError("OpenAI API", {
        operation: "analyzeBookCover",
        error: errorMsg,
        phase: "validation",
        result
      });
      throw new Error(errorMsg);
    }
    
    // Log the extracted data
    apiLogger.logResponse("OpenAI API", {
      operation: "analyzeBookCover:results",
      fieldsExtracted: Object.keys(result).filter(k => result[k] !== null && result[k] !== undefined),
      titleLength: result.title ? result.title.length : 0,
      authorLength: result.author ? result.author.length : 0,
      hasISBN: Boolean(result.isbn)
    });
    
    return result;
  } catch (error: any) {
    console.error("Error analyzing book cover:", error);
    apiLogger.logError("OpenAI API", {
      operation: "analyzeBookCover",
      error: error.message || String(error)
    });
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

    // Log the summary generation request
    apiLogger.logRequest("OpenAI API", {
      operation: "generateBookSummary",
      endpoint: "chat.completions.create",
      model: MODEL,
      language: language,
      bookTitle: bookInfo.title,
      bookAuthor: bookInfo.author
    });

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

    // Log successful response
    apiLogger.logResponse("OpenAI API", {
      operation: "generateBookSummary",
      status: "success",
      model: MODEL,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason,
      bookTitle: bookInfo.title
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
    
    // Log summary stats
    apiLogger.logResponse("OpenAI API", {
      operation: "generateBookSummary:results",
      summaryLength: summary.length,
      wordCount: summary.split(/\s+/).length,
      paragraphCount: summary.split(/\n+/).length,
      cleanupApplied: true
    });
    
    return summary;
  } catch (error: any) {
    console.error("Error generating book summary:", error);
    apiLogger.logError("OpenAI API", {
      operation: "generateBookSummary",
      bookTitle: bookInfo.title,
      error: error.message || String(error)
    });
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
    
    // Log the genre extraction request
    apiLogger.logRequest("OpenAI API", {
      operation: "extractBookGenres",
      endpoint: "chat.completions.create",
      model: MODEL,
      language: language,
      bookTitle: bookInfo.title,
      bookAuthor: bookInfo.author,
      hasGoogleCategories: bookInfo.metadata && 
                          typeof bookInfo.metadata === 'object' && 
                          !!(bookInfo.metadata as any).categories
    });

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
    
    // Log successful response
    apiLogger.logResponse("OpenAI API", {
      operation: "extractBookGenres",
      status: "success",
      model: MODEL,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason,
      bookTitle: bookInfo.title
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for genres");
      apiLogger.logError("OpenAI API", {
        operation: "extractBookGenres",
        error: "No content returned",
        bookTitle: bookInfo.title
      });
      return [];
    }
    
    console.log(`OpenAI genre response: ${content}`);
    
    try {
      const result = JSON.parse(content);
      
      if (Array.isArray(result.genres)) {
        apiLogger.logResponse("OpenAI API", {
          operation: "extractBookGenres:results",
          bookTitle: bookInfo.title,
          genreCount: result.genres.length,
          genres: result.genres,
          parseMethod: "standard"
        });
        return result.genres;
      } else if (result.genres && typeof result.genres === 'string') {
        // Handle case where it might return a comma-separated string instead of array
        const parsedGenres = result.genres.split(',').map((genre: string) => genre.trim());
        apiLogger.logResponse("OpenAI API", {
          operation: "extractBookGenres:results",
          bookTitle: bookInfo.title,
          genreCount: parsedGenres.length,
          genres: parsedGenres,
          parseMethod: "string-split"
        });
        return parsedGenres;
      } else {
        // Handle case where the genres might be in the root of the JSON
        const potentialGenres = Object.values(result).find(value => Array.isArray(value));
        if (potentialGenres && Array.isArray(potentialGenres)) {
          apiLogger.logResponse("OpenAI API", {
            operation: "extractBookGenres:results",
            bookTitle: bookInfo.title,
            genreCount: potentialGenres.length,
            genres: potentialGenres,
            parseMethod: "root-array"
          });
          return potentialGenres;
        }
        
        console.log("No genres array found in the response");
        apiLogger.logError("OpenAI API", {
          operation: "extractBookGenres",
          error: "No genres array found in response",
          content: JSON.stringify(result),
          bookTitle: bookInfo.title
        });
        return [];
      }
    } catch (parseError) {
      console.error("Error parsing genres JSON:", parseError);
      apiLogger.logError("OpenAI API", {
        operation: "extractBookGenres",
        error: "JSON parse error",
        content: content.substring(0, 200) + "...",
        bookTitle: bookInfo.title
      });
      
      // Try to extract genres from raw text if JSON parsing fails
      try {
        // Look for patterns that might indicate genres in the text
        const genreMatches = content.match(/["'\[\]\{]([^"'\[\]\{\}]+)["'\[\]\}]/g);
        if (genreMatches && genreMatches.length > 0) {
          const extractedGenres = genreMatches
            .map(match => match.replace(/["'\[\]\{\}]/g, '').trim())
            .filter(Boolean);
            
          apiLogger.logResponse("OpenAI API", {
            operation: "extractBookGenres:results",
            bookTitle: bookInfo.title,
            genreCount: extractedGenres.length,
            genres: extractedGenres,
            parseMethod: "regex-fallback"
          });
          return extractedGenres;
        }
      } catch (e) {
        console.error("Error in fallback genre extraction:", e);
        apiLogger.logError("OpenAI API", {
          operation: "extractBookGenres",
          error: "Fallback extraction failed",
          originalError: parseError.message,
          bookTitle: bookInfo.title
        });
      }
      return [];
    }
  } catch (error: any) {
    console.error("Error extracting book genres:", error);
    apiLogger.logError("OpenAI API", {
      operation: "extractBookGenres",
      error: error.message || String(error),
      bookTitle: bookInfo.title
    });
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
    // Log the catalog entry request
    apiLogger.logRequest("OpenAI API", {
      operation: "generateCatalogEntry",
      endpoint: "chat.completions.create",
      model: MODEL,
      bookTitle: bookInfo.title,
      bookAuthor: bookInfo.author
    });

    // Get the ASB classification and other German library specific data
    const germanCatalogData = bookInfo.catalogNumber || 
                              bookInfo.secondaryClassification || 
                              bookInfo.reviewerName ? 
                              bookInfo : 
                              await generateGermanLibraryCatalogData(bookInfo);
    
    // Extract the reviewer name and related classifiers
    const reviewerName = germanCatalogData.reviewerName || "[Reviewer Name]";
    const asbClassification = germanCatalogData.catalogNumber || "[ASB Placeholder]";
    const secondaryCode = germanCatalogData.secondaryClassification || "[Code Placeholder]";
    const idBNumber = germanCatalogData.idBNumber || "[ID Placeholder]";
    
    // Format the author name (lastname, firstname)
    let formattedAuthor = "[Author Placeholder]";
    if (bookInfo.author) {
      const authorParts = bookInfo.author.split(" ");
      if (authorParts.length > 1) {
        const lastName = authorParts.pop();
        const firstName = authorParts.join(" ");
        formattedAuthor = `${lastName}, ${firstName}`;
      } else {
        formattedAuthor = bookInfo.author;
      }
      
      // Check if author is an editor
      if (bookInfo.contributors && 
          Array.isArray(bookInfo.contributors) && 
          bookInfo.contributors.some(c => c.role?.toLowerCase()?.includes("hrsg"))) {
        formattedAuthor += " (Hrsg.)";
      }
    }
    
    // Format the title and subtitle
    const title = bookInfo.title || "[Title Placeholder]";
    let subtitle = "";
    if (title.includes(":")) {
      const titleParts = title.split(":");
      subtitle = ` / ${titleParts.slice(1).join(":").trim()}`;
    }
    
    // Get translator if available
    let translator = "";
    if (bookInfo.contributors && Array.isArray(bookInfo.contributors)) {
      const translatorContributor = bookInfo.contributors.find(c => 
        c.role?.toLowerCase()?.includes("übersetz") || 
        c.role?.toLowerCase()?.includes("translat")
      );
      if (translatorContributor) {
        translator = ` / ${translatorContributor.name}`;
      }
    }
    
    // Format edition
    const edition = bookInfo.edition ? `${bookInfo.edition} – ` : "";
    
    // Format location and publisher
    const location = bookInfo.location || "[Ort]";
    const publisher = bookInfo.publisher || "[Verlag]";
    const publishingInfo = `${location} : ${publisher}`;
    
    // Format year
    const year = bookInfo.publishedYear || "[Jahr]";
    
    // Format physical details
    const pageCount = bookInfo.pageCount ? `${bookInfo.pageCount}` : "[Seitenzahl]";
    const physicalDetails = bookInfo.contributors && 
                           Array.isArray(bookInfo.contributors) && 
                           bookInfo.contributors.some(c => c.role?.toLowerCase()?.includes("illustr")) ? 
                           " : Illustrationen" : "";
    
    // Format dimensions
    const dimensions = bookInfo.dimensions ? ` ; ${bookInfo.dimensions}` : " ; [Format]";
    
    // Format series
    const series = bookInfo.series ? ` : (${bookInfo.series})` : "";
    
    // Format ISBN and binding
    const isbn = bookInfo.isbn || "[ISBN]";
    const binding = bookInfo.binding ? 
                   bookInfo.binding.toLowerCase().includes("hardcover") || 
                   bookInfo.binding.toLowerCase().includes("gebunden") ? 
                   "Festeinb." : "Taschenbuch" : 
                   "[Binding Type]";
    
    // Placeholder for price
    const price = "EUR [price]";
    
    // Create the formatted catalog entry following ekz-Informationsdienst style
    let catalogEntry = `ASB: ${asbClassification}        ${secondaryCode}\n\n`;
    catalogEntry += `**${formattedAuthor}**: ${title}${subtitle}${translator} : ${edition}${publishingInfo}, ${year} – ${pageCount}${physicalDetails}${dimensions}${series}\n`;
    catalogEntry += `ISBN ${isbn}, ${binding} : ${price}\n\n`;
    
    // Add the summary (either existing or generate a new one)
    if (!bookInfo.summary) {
      try {
        bookInfo.summary = await generateBookSummary(bookInfo);
      } catch (error) {
        console.error("Failed to generate summary for catalog entry:", error);
        bookInfo.summary = "[Zusammenfassung nicht verfügbar]";
      }
    }
    
    catalogEntry += bookInfo.summary + "\n\n";
    
    // Add the footer with reviewer name and ID
    catalogEntry += `- ${reviewerName}\n`;
    catalogEntry += `- ${idBNumber}\n`;
    catalogEntry += `- ekz-Informationsdienst\n`;
    catalogEntry += `- ${secondaryCode}`;
    
    // Log success
    apiLogger.logResponse("OpenAI API", {
      operation: "generateCatalogEntry",
      status: "success",
      bookTitle: bookInfo.title,
      entryLength: catalogEntry.length
    });
    
    return catalogEntry;
  } catch (error: any) {
    console.error("Error generating catalog entry:", error);
    apiLogger.logError("OpenAI API", {
      operation: "generateCatalogEntry",
      error: error.message || String(error),
      bookTitle: bookInfo.title
    });
    
    // Create a basic template with placeholders if an error occurs
    return `ASB: [ASB Placeholder]        [Code Placeholder]

**[Author]**: [Title] : [Edition] – [Ort] : [Verlag], [Jahr] – [Seiten] ; [Format]
ISBN [ISBN], [Einband] : EUR [Preis]

[Zusammenfassung nicht verfügbar]

- [Reviewer Name]
- [ID Placeholder]
- ekz-Informationsdienst
- [Code Placeholder]`;
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
    } catch (error: unknown) {
      console.error("Error parsing German library catalog data JSON:", error);
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
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : bookInfo.genres}` : ''}

Important details for bibliographic estimation:
- ${bookInfo.genres && Array.isArray(bookInfo.genres) && bookInfo.genres.length > 0 ? 
    `This is primarily a ${bookInfo.genres[0]} book` : 
    `Book genre is unknown`}
- ${bookInfo.readingLevel ? 
    `Reading level is ${bookInfo.readingLevel} (${
      bookInfo.readingLevel?.toLowerCase().includes("kinder") || 
      bookInfo.readingLevel?.toLowerCase().includes("children") ? 
      "likely a children's book with fewer pages and larger print" : 
      bookInfo.readingLevel?.toLowerCase().includes("jugend") || 
      bookInfo.readingLevel?.toLowerCase().includes("young adult") ? 
      "likely a young adult book with standard novel length" : 
      "likely an adult-oriented book with typical adult content length"
    })` : 
    `Reading level is unknown`}
- ${bookInfo.summary ? 
    `Based on the summary complexity and length, this appears to be a ${
      bookInfo.summary.length < 500 ? "simpler, possibly shorter work" : 
      bookInfo.summary.length > 1500 ? "more complex, possibly longer work" : 
      "work of average complexity and length"
    }` : 
    `No summary is available to assess complexity`}`;

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

Return a JSON object with the following fields that are UNIQUELY tailored to THIS SPECIFIC BOOK:
- pageCount: A precise, realistic page count based on this book's specific genre, content complexity, and target audience. NEVER use generic counts like 250, 300, or 320 as defaults. (provide just the number)
- binding: The likely binding type for this book (e.g., "Hardcover", "Taschenbuch", "Gebunden", etc.)
- dimensions: Realistic physical dimensions for this book (e.g., "14.5 x 21.2 cm") that reflect the book's type
- edition: Likely edition information (e.g., "1. Auflage", "Zweite Ausgabe", etc.)
- location: Publisher's location/city
- publisher: Publisher name (if missing)

CRITICAL GUIDELINES:
1. EVERY BOOK MUST HAVE DISTINCT BIBLIOGRAPHIC VALUES - no two books should have identical page counts or dimensions
2. For pageCount, use these guidelines based on genre and reading level:
   - Children's picture books: 24-48 pages
   - Early readers: 48-96 pages
   - Middle-grade fiction: 128-224 pages
   - Young adult fiction: 224-384 pages
   - Adult fiction: 256-496 pages depending on genre (thrillers shorter, fantasy longer)
   - Academic/scholarly works: 288-672 pages
   - Choose a SPECIFIC number within these ranges, never a round number like 300 or 350

3. For dimensions, vary by book type:
   - Children's books: Typically larger format (21 x 29.7 cm or 22.5 x 27 cm)
   - Mass market paperbacks: Smaller format (10.5 x 17.5 cm)
   - Trade paperbacks: Medium format (13.5 x 21 cm)
   - Hardcover fiction: Standard format (14.5 x 22 cm)
   - Coffee table/art books: Large format (23 x 28 cm)
   - Choose SPECIFIC dimensions with decimal precision (like 14.8 x 21.3 cm)

4. If you cannot estimate a specific field with confidence, leave it as null
5. Use the book's genre, period, and content complexity to inform your estimates

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
      
    } catch (error: unknown) {
      console.error("Error parsing bibliographic data JSON:", error);
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

// Enrich book metadata using OpenAI instead of Google Books
// Search for books using OpenAI instead of Google Books
export async function searchBooks(params: any): Promise<{items: any[]}> {
  try {
    // Log the search request
    apiLogger.logRequest("OpenAI API", {
      operation: "searchBooks",
      model: MODEL,
      searchParams: params
    });

    // Construct a search query from the parameters
    let searchQuery = "";
    if (params.query) {
      searchQuery = params.query;
    } else {
      if (params.title) searchQuery += `title:${params.title} `;
      if (params.author) searchQuery += `author:${params.author} `;
      if (params.isbn) searchQuery += `isbn:${params.isbn} `;
    }

    // Create a unique ID for this request
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[${searchId}] Searching books with OpenAI: "${searchQuery}"`);

    // Query OpenAI for book search results
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a book search engine with access to a vast database of books. 
Your task is to search real books based on the provided query parameters and return accurate results.
You MUST provide REAL book information - never return placeholder or "Unknown" values for title or author.
Results should be in the language of the query when detectable (default to German).
This is extremely important: If you don't know the exact details from the query, you MUST research to find real book information.`
        },
        {
          role: "user",
          content: `Search for books matching this query: "${searchQuery}"

It's critically important that you:
1. Find REAL book information matching the query parameters
2. Provide ACTUAL titles and authors - NEVER return "Unknown" for these fields
3. Research thoroughly to find correct and complete data
4. If an ISBN is provided, use it to find the exact matching book

Return results as a JSON array of book objects with these fields:
- title: Full book title (REQUIRED, must be real book title)
- authors: Array of author names (REQUIRED, must be real author names)
- description: Brief description of the book
- isbn: ISBN-13 if available (otherwise null)
- publishedDate: Publication date (YYYY or YYYY-MM-DD format)
- pageCount: Approximate page count
- categories: Array of genres/categories
- imageLinks: Object with thumbnail and smallThumbnail URLs (or null)
- language: Two-letter language code
- publisher: Publisher name

Return up to 4 books, ranked by relevance to the query.
If no books can be found matching the query after thorough research, return an empty array.`
        }
      ],
      response_format: { type: "json_object" },
    });

    // Extract the content
    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for book search");
      return { items: [] };
    }

    try {
      // Parse the JSON response
      const searchResults = JSON.parse(content);
      
      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "searchBooks",
        status: "success",
        query: searchQuery,
        resultCount: Array.isArray(searchResults.items) ? searchResults.items.length : 0
      });
      
      // Return in the same format as Google Books API would
      return {
        items: Array.isArray(searchResults.items) ? searchResults.items : 
              Array.isArray(searchResults) ? searchResults.map(book => ({ volumeInfo: book })) :
              []
      };
    } catch (error: unknown) {
      console.error("Error parsing book search results from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "searchBooks",
        error: error instanceof Error ? error.message : String(error),
        query: searchQuery
      });
      return { items: [] };
    }
  } catch (error: any) {
    console.error("Error searching books with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "searchBooks",
      error: error.message || String(error),
      query: params.query || `${params.title || ''} ${params.author || ''} ${params.isbn || ''}`
    });
    return { items: [] };
  }
}

// Get book by ISBN using OpenAI instead of Google Books
export async function getBookByISBN(isbn: string): Promise<any | null> {
  try {
    // Log the ISBN lookup request
    apiLogger.logRequest("OpenAI API", {
      operation: "getBookByISBN",
      model: MODEL,
      isbn
    });

    // Clean the ISBN
    const cleanedISBN = isbn.replace(/[^0-9X]/gi, '');
    
    // Create a unique ID for this request
    const lookupId = `isbn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[${lookupId}] Looking up book with ISBN: "${cleanedISBN}"`);

    // Query OpenAI for book details by ISBN
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You are a book metadata service with access to comprehensive bibliographic data.
Your task is to provide detailed and accurate information for books based on ISBN numbers.
You MUST research real books and provide real metadata. NEVER return "Unknown" for title or author.
All responses should be formatted consistently in German.
This is extremely important: If you don't know the exact details for the ISBN, you MUST research using the ISBN to find the real book information.
Only include information that is confirmed from reliable sources. If certain information is missing, use [placeholder] instead. Do not guess or hallucinate data.`
        },
        {
          role: "user",
          content: `Given the ISBN: ${cleanedISBN}, return detailed book metadata including:

- title: Full, correctly capitalized book title in its original language (REQUIRED, must be real book title)
- subtitle: Subtitle if available, otherwise [placeholder]
- authors: Array with full author name(s) (REQUIRED, must be real author names)
- translator: Translator name(s) if available, otherwise [placeholder]
- edition: Edition information (like "1. Auflage")
- location: Publication place/city
- publisher: Publisher name
- publishedYear: Publication year as number
- pageCount: Total number of pages
- details: Other physical details (e.g., "Illustrationen, farbig")
- dimensions: Size in cm (format like "14.0 x 21.6 cm")
- series: Series information if present, otherwise [placeholder]
- binding: Book binding type (Hardcover, Taschenbuch, etc.)
- price: Price information if available, otherwise [placeholder]
- isbn13: The ISBN-13 (normalized)
- description: Book description or summary (150-250 words)
- categories: Array of 3-5 genre categories
- language: Two-letter language code

Only include information that is confirmed from sources. If something is missing, use [placeholder]. Do not guess or hallucinate. Do not hardcode any values.

If after extensive research you still cannot find this book, respond with a JSON object with a "notFound" field set to true.`
        }
      ],
      response_format: { type: "json_object" },
    });

    // Extract the content
    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for ISBN lookup");
      return null;
    }

    try {
      // Parse the JSON response
      const bookData = JSON.parse(content);
      
      // Check if the book was not found
      if (bookData.notFound) {
        console.log(`No book found for ISBN: ${isbn}`);
        return null;
      }
      
      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "getBookByISBN",
        status: "success",
        isbn,
        bookTitle: bookData.title
      });
      
      // Return in a standardized format with all the new fields
      return {
        id: `ISBN:${isbn}`,
        volumeInfo: {
          title: bookData.title,
          subtitle: bookData.subtitle || "",
          authors: bookData.authors,
          translator: bookData.translator || "",
          publisher: bookData.publisher,
          publishedDate: bookData.publishedYear?.toString() || "",
          description: bookData.description,
          pageCount: bookData.pageCount,
          categories: bookData.categories,
          imageLinks: bookData.imageLinks || { thumbnail: null },
          language: bookData.language,
          industryIdentifiers: [
            {
              type: "ISBN_13",
              identifier: bookData.isbn13 || isbn
            }
          ],
          dimensions: bookData.dimensions,
          binding: bookData.binding,
          edition: bookData.edition,
          location: bookData.location,
          details: bookData.details,
          series: bookData.series,
          price: bookData.price
        }
      };
    } catch (error: unknown) {
      console.error("Error parsing book data from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "getBookByISBN",
        error: error instanceof Error ? error.message : String(error),
        isbn
      });
      return null;
    }
  } catch (error: any) {
    console.error("Error getting book by ISBN with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "getBookByISBN",
      error: error.message || String(error),
      isbn
    });
    return null;
  }
}

// Search for similar books using OpenAI instead of Google Books
export async function searchSimilarBooks(bookInfo: Partial<Book>): Promise<{volumeInfo: any}[]> {
  try {
    // Log the similar books request
    apiLogger.logRequest("OpenAI API", {
      operation: "searchSimilarBooks",
      model: MODEL,
      bookInfo: {
        title: bookInfo.title,
        author: bookInfo.author,
        genres: bookInfo.genres
      }
    });

    // Create a unique ID for this request
    const similarId = `similar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[${similarId}] Finding similar books to: "${bookInfo.title}" by "${bookInfo.author}"`);

    // Prepare context from available book information
    const context = `Book information:
Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(', ') : (bookInfo.genres || 'Unknown')}
${bookInfo.summary ? `Summary: ${bookInfo.summary.substring(0, 200)}...` : ''}`;

    // Query OpenAI for similar books
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `You are a book recommendation engine with extensive knowledge of literature.
Your task is to recommend books that are similar to the reference book in style, theme, or content.
You MUST provide REAL book information - never return placeholder or "Unknown" for title or author.
All recommendations should be in the same language as the reference book (default to German).
This is extremely important: You MUST research to find real similar books with accurate information.`
        },
        {
          role: "user",
          content: `Based on this book, recommend 4 similar books that readers might enjoy:
${context}

It's critically important that you:
1. Find REAL similar books based on the reference book's characteristics
2. Provide ACTUAL titles and authors - NEVER return "Unknown" for these fields
3. Research thoroughly to find correct and complete data
4. Ensure all recommended books are genuine published works

Return results as a JSON object with an "items" array containing book objects with these fields:
- title: Full book title (REQUIRED, must be real book title)
- authors: Array of author names (REQUIRED, must be real author names)
- description: Brief description of why this book is similar
- publisher: Publisher name
- publishedDate: Publication year
- categories: Array of genres/categories
- language: Two-letter language code of the book (same as reference book)
- isbn: ISBN-13 if available (otherwise null)

Make sure each recommendation is a real book that's similar in theme, style, or content to the reference book.
If no similar books can be found after thorough research, return an empty array of items.`
        }
      ],
      response_format: { type: "json_object" },
    });

    // Extract the content
    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for similar books");
      return [];
    }

    try {
      // Parse the JSON response
      const similarBooks = JSON.parse(content);
      
      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "searchSimilarBooks",
        status: "success",
        referenceBook: bookInfo.title,
        resultCount: Array.isArray(similarBooks.items) ? similarBooks.items.length : 0
      });
      
      // Format to match Google Books API structure
      if (Array.isArray(similarBooks.items)) {
        return similarBooks.items.map(book => ({ volumeInfo: book }));
      }
      return [];
    } catch (error: unknown) {
      console.error("Error parsing similar books from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "searchSimilarBooks",
        error: error instanceof Error ? error.message : String(error),
        referenceBook: bookInfo.title
      });
      return [];
    }
  } catch (error: any) {
    console.error("Error finding similar books with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "searchSimilarBooks",
      error: error.message || String(error),
      referenceBook: bookInfo.title
    });
    return [];
  }
}

export async function enrichBookMetadata(bookInfo: Partial<Book>): Promise<Partial<Book>> {
  try {
    // Log the enrichment request
    apiLogger.logRequest("OpenAI API", {
      operation: "enrichBookMetadata",
      model: MODEL,
      bookInfo: {
        title: bookInfo.title,
        author: bookInfo.author,
        isbn: bookInfo.isbn
      }
    });

    // Create a unique ID for this request
    const enrichmentId = `enrich_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[${enrichmentId}] Enriching book metadata with OpenAI for "${bookInfo.title || bookInfo.isbn}" by "${bookInfo.author || 'unknown'}"`);

    // Prepare context from available book information
    const context = `Book information:
Title: ${bookInfo.title || 'Unknown'}
Author: ${bookInfo.author || 'Unknown'}
ISBN: ${bookInfo.isbn || 'Unknown'}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ''}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ''}
${bookInfo.summary ? `Summary preview: ${bookInfo.summary.substring(0, 150)}...` : ''}`;

    // Query OpenAI to enrich the book's metadata
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a book metadata specialist with access to comprehensive bibliographic data. 
Your task is to provide accurate, detailed metadata for books based on ISBN numbers or other identifiers.
You MUST research real books and provide real metadata - NEVER return "Unknown" for title or author when an ISBN is provided.
All responses should be in the same language as the book title (detect language).
This is extremely important: If you don't know the exact details from the information given, you MUST research to find the real book information.`
        },
        {
          role: "user",
          content: `Based on the following book information, research and generate complete, accurate book metadata.

It's critically important that you:
1. If an ISBN is provided, use it to find the real book information
2. Provide the ACTUAL title and author - NEVER return "Unknown" for these fields
3. Research thoroughly to find correct and complete data

Return a JSON object with these fields:
- title: Full, correctly capitalized book title in its original language (REQUIRED, must be real book title)
- subtitle: Subtitle if available, otherwise [placeholder]
- author: Full author name with correct capitalization (REQUIRED, must be real author name)
- translator: Translator name(s) if available, otherwise [placeholder]
- edition: Edition information (like "1. Auflage")
- location: Publication place/city
- publisher: Publisher name
- publishedYear: Publication year as number
- pageCount: Total number of pages
- details: Other physical details (e.g., "Illustrationen, farbig")
- dimensions: Size in cm (format like "14.0 x 21.6 cm")
- series: Series information if present, otherwise [placeholder]
- binding: Book binding type (Hardcover, Taschenbuch, etc.)
- price: Price information if available, otherwise [placeholder]
- isbn: ONLY include the ISBN if provided in the query, otherwise null
- description: Book description or summary (150-250 words)
- categories: Array of 3-5 genre categories
- language: Primary language of the book (two-letter code: en, de, fr, etc.)
- coverImageUrl: ONLY include if already provided, otherwise null

Only include information that is confirmed from sources. If something is missing, use [placeholder]. Do not guess or hallucinate. Do not hardcode any values.

${context}`
        }
      ],
      response_format: { type: "json_object" },
    });

    // Log the raw response
    console.log(`[${enrichmentId}] OpenAI enrichment response received`);
    
    // Extract the content
    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for book metadata enrichment");
      return bookInfo;
    }

    try {
      // Parse the JSON response
      const enrichedData = JSON.parse(content);
      
      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "enrichBookMetadata",
        status: "success",
        bookTitle: enrichedData.title || bookInfo.title
      });
      
      // Merge the enriched data with the original book info
      // Keep original data where available and fill in the blanks
      return {
        ...bookInfo,
        title: bookInfo.title || enrichedData.title,
        subtitle: bookInfo.subtitle || enrichedData.subtitle,
        author: bookInfo.author || enrichedData.author,
        translator: bookInfo.translator || enrichedData.translator,
        publishedYear: bookInfo.publishedYear || enrichedData.publishedYear,
        publisher: bookInfo.publisher || enrichedData.publisher,
        pageCount: bookInfo.pageCount || enrichedData.pageCount,
        summary: bookInfo.summary || enrichedData.description,
        genres: bookInfo.genres || enrichedData.categories,
        language: bookInfo.language || enrichedData.language,
        coverImageUrl: bookInfo.coverImageUrl || enrichedData.coverImageUrl || null,
        isbn: bookInfo.isbn || enrichedData.isbn || null,
        binding: bookInfo.binding || enrichedData.binding,
        dimensions: bookInfo.dimensions || enrichedData.dimensions,
        edition: bookInfo.edition || enrichedData.edition,
        location: bookInfo.location || enrichedData.location,
        details: bookInfo.details || enrichedData.details,
        series: bookInfo.series || enrichedData.series,
        price: bookInfo.price || enrichedData.price
      };
    } catch (error: unknown) {
      console.error("Error parsing book metadata JSON from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "enrichBookMetadata",
        error: error instanceof Error ? error.message : String(error),
        bookTitle: bookInfo.title
      });
      // Return original book info if parsing fails
      return bookInfo;
    }
  } catch (error: any) {
    console.error("Error enriching book metadata with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "enrichBookMetadata",
      error: error.message || String(error),
      bookTitle: bookInfo.title
    });
    // Return original book info if there's an error
    return bookInfo;
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
      subtitle: analysisRequest.subtitle || null,
      author: analysisRequest.author || "",
      translator: analysisRequest.translator || null,
      isbn: analysisRequest.isbn || null,
      coverImageUrl: analysisRequest.coverImageUrl || null,
      publisher: analysisRequest.publisher || null,
      publishedYear: analysisRequest.publishedYear || null,
      // Handle the cover image data if provided
      ...(analysisRequest.coverImage && { coverImageUrl: analysisRequest.coverImage }),
      
      // Include the language parameter
      language: analysisRequest.language || "de",
      
      // Physical book properties
      dimensions: analysisRequest.dimensions || null,
      details: analysisRequest.details || null,
      edition: analysisRequest.edition || null,
      binding: analysisRequest.binding || null,
      price: analysisRequest.price || null,
      series: analysisRequest.series || null,
      location: analysisRequest.location || null,
      
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
    const fieldsToCheck = [
      'pageCount', 'binding', 'dimensions', 'edition', 'location', 'publisher',
      'subtitle', 'translator', 'details', 'series', 'price'
    ] as const;
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
