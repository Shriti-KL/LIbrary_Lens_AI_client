import OpenAI from "openai";
import { Book, BookAnalysisRequest, AnalysisOption } from "@shared/schema";
import { apiLogger } from "../utils/logger";
import * as googleBooks from "./googleBooks"; // Import Google Books API functions

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
      imageSize: image ? `${Math.round(image.length / 1024)} KB` : "0 KB",
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a book cataloging expert. Analyze this book cover image and extract all relevant metadata for library cataloging. Be comprehensive and accurate. Respond in German language.",
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

    // Log successful response
    apiLogger.logResponse("OpenAI API", {
      operation: "analyzeBookCover",
      status: "success",
      model: MODEL,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      const errorMsg = "No content returned from book cover analysis";
      apiLogger.logError("OpenAI API", {
        operation: "analyzeBookCover",
        error: errorMsg,
        phase: "content extraction",
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
        content: content.substring(0, 200) + "...", // Include start of content for debugging
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
        result,
      });
      throw new Error(errorMsg);
    }

    // Log the extracted data
    apiLogger.logResponse("OpenAI API", {
      operation: "analyzeBookCover:results",
      fieldsExtracted: Object.keys(result).filter(
        (k) => result[k] !== null && result[k] !== undefined,
      ),
      titleLength: result.title ? result.title.length : 0,
      authorLength: result.author ? result.author.length : 0,
      hasISBN: Boolean(result.isbn),
    });

    return result;
  } catch (error: any) {
    console.error("Error analyzing book cover:", error);
    apiLogger.logError("OpenAI API", {
      operation: "analyzeBookCover",
      error: error.message || String(error),
    });
    throw new Error(
      `Failed to analyze book cover: ${error.message || String(error)}`,
    );
  }
}

// Generate a summary for a book
export async function generateBookSummary(
  bookInfo: Partial<Book>,
): Promise<string> {
  try {
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";

    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)",
    };

    const languageName = languageNames[language] || languageNames.de;

    const context = `Book Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ""}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ""}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ""}`;

    // Log the summary generation request
    apiLogger.logRequest("OpenAI API", {
      operation: "generateBookSummary",
      endpoint: "chat.completions.create",
      model: MODEL,
      language: language,
      bookTitle: bookInfo.title,
      bookAuthor: bookInfo.author,
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a literary expert who creates concise, informative book summaries for library catalogs. Focus on plot, main themes, and significance. Always respond in ${languageName}. Your summaries must be EXACTLY 150 words (approximately 1000 characters) and contain NO metadata or bibliographic information.`,
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
${context}`,
        },
      ],
    });

    // Log successful response
    apiLogger.logResponse("OpenAI API", {
      operation: "generateBookSummary",
      status: "success",
      model: MODEL,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason,
      bookTitle: bookInfo.title,
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
      /Verlag:.*\n?/i,
    ];

    // Apply all patterns to clean up the summary
    metadataPatterns.forEach((pattern) => {
      summary = summary.replace(pattern, "");
    });

    // Remove any extra whitespace and multiple newlines
    summary = summary.replace(/\n\s*\n/g, "\n").trim();

    // Log summary stats
    apiLogger.logResponse("OpenAI API", {
      operation: "generateBookSummary:results",
      summaryLength: summary.length,
      wordCount: summary.split(/\s+/).length,
      paragraphCount: summary.split(/\n+/).length,
      cleanupApplied: true,
    });

    return summary;
  } catch (error: any) {
    console.error("Error generating book summary:", error);
    apiLogger.logError("OpenAI API", {
      operation: "generateBookSummary",
      bookTitle: bookInfo.title,
      error: error.message || String(error),
    });
    throw new Error(
      `Failed to generate book summary: ${error.message || String(error)}`,
    );
  }
}

// Extract genres for a book
export async function extractBookGenres(
  bookInfo: Partial<Book>,
): Promise<string[]> {
  try {
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";

    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)",
    };

    const languageName = languageNames[language] || languageNames.de;

    // Add more context data to improve genre extraction
    let contextText = `Book Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ""}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ""}
${bookInfo.publishedYear ? `Published Year: ${bookInfo.publishedYear}` : ""}`;

    // Include metadata from Google Books if available
    if (bookInfo.metadata && typeof bookInfo.metadata === "object") {
      const metadata = bookInfo.metadata as Record<string, any>;
      if (metadata.categories && Array.isArray(metadata.categories)) {
        contextText += `\nGoogle Books Categories: ${metadata.categories.join(", ")}`;
      }
    }

    console.log(
      `Extracting genres for "${bookInfo.title}" by "${bookInfo.author}"`,
    );

    // Log the genre extraction request
    apiLogger.logRequest("OpenAI API", {
      operation: "extractBookGenres",
      endpoint: "chat.completions.create",
      model: MODEL,
      language: language,
      bookTitle: bookInfo.title,
      bookAuthor: bookInfo.author,
      hasGoogleCategories:
        bookInfo.metadata &&
        typeof bookInfo.metadata === "object" &&
        !!(bookInfo.metadata as any).categories,
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a library cataloging expert who specializes in classifying books by genre. Identify the primary and secondary genres for this book. Always respond in ${languageName}.`,
        },
        {
          role: "user",
          content: `Based on the following book information, identify 3-5 genres that best categorize this book. Return your response as a JSON object with a "genres" property that contains an array of strings with only the genre names in ${languageName}.\n\n${contextText}`,
        },
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
      bookTitle: bookInfo.title,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log("No content returned from OpenAI for genres");
      apiLogger.logError("OpenAI API", {
        operation: "extractBookGenres",
        error: "No content returned",
        bookTitle: bookInfo.title,
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
          parseMethod: "standard",
        });
        return result.genres;
      } else if (result.genres && typeof result.genres === "string") {
        // Handle case where it might return a comma-separated string instead of array
        const parsedGenres = result.genres
          .split(",")
          .map((genre: string) => genre.trim());
        apiLogger.logResponse("OpenAI API", {
          operation: "extractBookGenres:results",
          bookTitle: bookInfo.title,
          genreCount: parsedGenres.length,
          genres: parsedGenres,
          parseMethod: "string-split",
        });
        return parsedGenres;
      } else {
        // Handle case where the genres might be in the root of the JSON
        const potentialGenres = Object.values(result).find((value) =>
          Array.isArray(value),
        );
        if (potentialGenres && Array.isArray(potentialGenres)) {
          apiLogger.logResponse("OpenAI API", {
            operation: "extractBookGenres:results",
            bookTitle: bookInfo.title,
            genreCount: potentialGenres.length,
            genres: potentialGenres,
            parseMethod: "root-array",
          });
          return potentialGenres;
        }

        console.log("No genres array found in the response");
        apiLogger.logError("OpenAI API", {
          operation: "extractBookGenres",
          error: "No genres array found in response",
          content: JSON.stringify(result),
          bookTitle: bookInfo.title,
        });
        return [];
      }
    } catch (parseError) {
      console.error("Error parsing genres JSON:", parseError);
      apiLogger.logError("OpenAI API", {
        operation: "extractBookGenres",
        error: "JSON parse error",
        content: content.substring(0, 200) + "...",
        bookTitle: bookInfo.title,
      });

      // Try to extract genres from raw text if JSON parsing fails
      try {
        // Look for patterns that might indicate genres in the text
        const genreMatches = content.match(
          /["'\[\]\{]([^"'\[\]\{\}]+)["'\[\]\}]/g,
        );
        if (genreMatches && genreMatches.length > 0) {
          const extractedGenres = genreMatches
            .map((match) => match.replace(/["'\[\]\{\}]/g, "").trim())
            .filter(Boolean);

          apiLogger.logResponse("OpenAI API", {
            operation: "extractBookGenres:results",
            bookTitle: bookInfo.title,
            genreCount: extractedGenres.length,
            genres: extractedGenres,
            parseMethod: "regex-fallback",
          });
          return extractedGenres;
        }
      } catch (e) {
        console.error("Error in fallback genre extraction:", e);
        apiLogger.logError("OpenAI API", {
          operation: "extractBookGenres",
          error: "Fallback extraction failed",
          originalError: parseError.message,
          bookTitle: bookInfo.title,
        });
      }
      return [];
    }
  } catch (error: any) {
    console.error("Error extracting book genres:", error);
    apiLogger.logError("OpenAI API", {
      operation: "extractBookGenres",
      error: error.message || String(error),
      bookTitle: bookInfo.title,
    });
    return []; // Return empty array instead of throwing to avoid breaking the whole analysis
  }
}

// Extract themes for a book
export async function extractBookThemes(
  bookInfo: Partial<Book>,
): Promise<any[]> {
  try {
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";

    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)",
    };

    const languageName = languageNames[language] || languageNames.de;

    // Create context with more information
    let contextText = `Book Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ""}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(", ") : bookInfo.genres}` : ""}`;

    console.log(
      `Extracting themes for "${bookInfo.title}" by "${bookInfo.author}"`,
    );

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a literary analysis expert specializing in identifying themes and motifs in books. Always respond in ${languageName}.`,
        },
        {
          role: "user",
          content: `Identify 3 major themes or motifs for the following book. For each theme, provide a short description in ${languageName}. Return as a JSON object containing a "themes" array with objects containing 'theme' and 'description' properties.\n\n${contextText}`,
        },
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
        const potentialThemesArray = Object.values(result).find(
          (value) =>
            Array.isArray(value) &&
            value.length > 0 &&
            typeof value[0] === "object" &&
            "theme" in value[0],
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
export async function assessReadingLevel(
  bookInfo: Partial<Book>,
): Promise<any> {
  try {
    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";

    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)",
    };

    const languageName = languageNames[language] || languageNames.de;

    // Create context with more information
    let contextText = `Book Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ""}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ""}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(", ") : bookInfo.genres}` : ""}`;

    console.log(
      `Assessing reading level for "${bookInfo.title}" by "${bookInfo.author}"`,
    );

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are an education specialist who assesses reading levels for books. Always respond in ${languageName}.`,
        },
        {
          role: "user",
          content: `Assess the appropriate reading level for this book. Return a JSON object with 'level' (a string in ${languageName} like 'Klasse 4-5' or 'Alter 12-14' for German), and 'score' (a number from 1-10 representing complexity).\n\n${contextText}`,
        },
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
      if (result && "level" in result && "score" in result) {
        return {
          level: result.level,
          score: Number(result.score) || 5,
        };
      }

      // Look for alternative structure
      if (result && typeof result === "object") {
        // Try to extract level and score from any fields that might contain them
        const level =
          result.level ||
          result.readingLevel ||
          result.reading_level ||
          "Unbekannt";
        let score =
          result.score || result.complexity || result.readingScore || 5;

        // Make sure score is a number between 1-10
        score = Number(score);
        if (isNaN(score) || score < 1 || score > 10) {
          score = 5;
        }

        return { level, score };
      }

      console.log(
        "Could not find valid reading level information in the response",
      );
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
export async function generateCatalogEntry(
  bookInfo: Partial<Book>,
): Promise<string> {
  try {
    // Log the catalog entry request
    apiLogger.logRequest("OpenAI API", {
      operation: "generateCatalogEntry",
      endpoint: "chat.completions.create",
      model: MODEL,
      bookTitle: bookInfo.title,
      bookAuthor: bookInfo.author,
    });

    // Get the ASB classification and other German library specific data
    const germanCatalogData =
      bookInfo.catalogNumber ||
      bookInfo.secondaryClassification ||
      bookInfo.reviewerName
        ? bookInfo
        : await generateGermanLibraryCatalogData(bookInfo);

    // Extract the reviewer name and related classifiers
    const reviewerName = germanCatalogData.reviewerName || "[Reviewer Name]";
    const asbClassification =
      germanCatalogData.catalogNumber || "[ASB Placeholder]";
    const secondaryCode =
      germanCatalogData.secondaryClassification || "[Code Placeholder]";
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
      if (
        bookInfo.contributors &&
        Array.isArray(bookInfo.contributors) &&
        bookInfo.contributors.some((c) =>
          c.role?.toLowerCase()?.includes("hrsg"),
        )
      ) {
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
      const translatorContributor = bookInfo.contributors.find(
        (c) =>
          c.role?.toLowerCase()?.includes("übersetz") ||
          c.role?.toLowerCase()?.includes("translat"),
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
    const pageCount = bookInfo.pageCount
      ? `${bookInfo.pageCount}`
      : "[Seitenzahl]";
    const physicalDetails =
      bookInfo.contributors &&
      Array.isArray(bookInfo.contributors) &&
      bookInfo.contributors.some((c) =>
        c.role?.toLowerCase()?.includes("illustr"),
      )
        ? " : Illustrationen"
        : "";

    // Format dimensions
    const dimensions = bookInfo.dimensions
      ? ` ; ${bookInfo.dimensions}`
      : " ; [Format]";

    // Format series
    const series = bookInfo.series ? ` : (${bookInfo.series})` : "";

    // Format ISBN and binding
    const isbn = bookInfo.isbn || "[ISBN]";
    const binding = bookInfo.binding
      ? bookInfo.binding.toLowerCase().includes("hardcover") ||
        bookInfo.binding.toLowerCase().includes("gebunden")
        ? "Festeinb."
        : "Taschenbuch"
      : "[Binding Type]";

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
      entryLength: catalogEntry.length,
    });

    return catalogEntry;
  } catch (error: any) {
    console.error("Error generating catalog entry:", error);
    apiLogger.logError("OpenAI API", {
      operation: "generateCatalogEntry",
      error: error.message || String(error),
      bookTitle: bookInfo.title,
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
export async function generateGermanLibraryCatalogData(
  bookInfo: Partial<Book>,
): Promise<Partial<Book>> {
  try {
    // Determine language for content generation (default to German)
    const language = bookInfo.language || "de";

    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)",
    };

    const languageName = languageNames[language] || languageNames.de;

    // Compile book information for context
    let contextText = `Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ""}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ""}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ""}
${bookInfo.isbn ? `ISBN: ${bookInfo.isbn}` : ""}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(", ") : bookInfo.genres}` : ""}
${bookInfo.summary ? `Summary: ${bookInfo.summary}` : ""}`;

    console.log(
      `Generating German library catalog data for "${bookInfo.title}" by "${bookInfo.author}"`,
    );

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a German library cataloging expert who creates ASB (Allgemeine Systematik für Bibliotheken) classifications and catalog entries. Generate data that exactly matches the German library catalog format.`,
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
${contextText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.log(
        "No content returned from OpenAI for German library catalog data",
      );
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
        idBNumber: result.idBNumber,
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
export async function extractMissingBibliographicData(
  bookInfo: Partial<Book>,
): Promise<Partial<Book>> {
  try {
    // Add debug information to identify the book being processed
    console.log(
      `DEBUG bibliographic extraction for book: "${bookInfo.title}" by "${bookInfo.author}"`,
    );

    // Determine language for content generation (default to German if not specified)
    const language = bookInfo.language || "de";

    // Map language codes to full language names for prompt clarity
    const languageNames: Record<string, string> = {
      en: "English",
      de: "German (Deutsch)",
      fr: "French (Français)",
      es: "Spanish (Español)",
      zh: "Chinese (中文)",
    };

    const languageName = languageNames[language] || languageNames.de;

    // Collect all available bibliographic information
    const context = `Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ""}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ""}
${bookInfo.pageCount ? `Pages: ${bookInfo.pageCount}` : ""}
${bookInfo.isbn ? `ISBN: ${bookInfo.isbn}` : ""}
${bookInfo.summary ? `Summary: ${bookInfo.summary.substring(0, 200)}...` : ""}
${bookInfo.genres ? `Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(", ") : bookInfo.genres}` : ""}

Important details for bibliographic estimation:
- ${
      bookInfo.genres &&
      Array.isArray(bookInfo.genres) &&
      bookInfo.genres.length > 0
        ? `This is primarily a ${bookInfo.genres[0]} book`
        : `Book genre is unknown`
    }
- ${
      bookInfo.readingLevel
        ? `Reading level is ${bookInfo.readingLevel} (${
            bookInfo.readingLevel?.toLowerCase().includes("kinder") ||
            bookInfo.readingLevel?.toLowerCase().includes("children")
              ? "likely a children's book with fewer pages and larger print"
              : bookInfo.readingLevel?.toLowerCase().includes("jugend") ||
                  bookInfo.readingLevel?.toLowerCase().includes("young adult")
                ? "likely a young adult book with standard novel length"
                : "likely an adult-oriented book with typical adult content length"
          })`
        : `Reading level is unknown`
    }
- ${
      bookInfo.summary
        ? `Based on the summary complexity and length, this appears to be a ${
            bookInfo.summary.length < 500
              ? "simpler, possibly shorter work"
              : bookInfo.summary.length > 1500
                ? "more complex, possibly longer work"
                : "work of average complexity and length"
          }`
        : `No summary is available to assess complexity`
    }`;

    // Identify missing fields
    const missingFields = [];
    if (!bookInfo.pageCount) missingFields.push("pageCount");
    if (!bookInfo.binding) missingFields.push("binding");
    if (!bookInfo.dimensions) missingFields.push("dimensions");
    if (!bookInfo.edition) missingFields.push("edition");
    if (!bookInfo.location) missingFields.push("location");
    if (!bookInfo.publisher) missingFields.push("publisher");

    // Skip if we have all the fields
    if (missingFields.length === 0) {
      console.log(
        "All bibliographic fields are present, skipping AI extraction",
      );
      return bookInfo;
    }

    console.log(
      `Attempting to extract missing bibliographic fields: ${missingFields.join(", ")}`,
    );

    // Add a random request ID to track this specific extraction
    const extractionId = `bibex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(
      `[${extractionId}] Extracting bibliographic data for "${bookInfo.title}" by "${bookInfo.author}"`,
    );

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a professional librarian specialized in bibliographic data. Always respond in ${languageName} and provide JSON format. IMPORTANT: Do not use generic placeholder values - each book should have unique, specific bibliographic characteristics based on its genre, publishing norms, and content.`,
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
${context}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9, // Increase temperature further for more variation
    });

    // Log the raw response for debugging
    console.log(
      `[${extractionId}] OpenAI raw response: ${response.choices[0].message.content}`,
    );

    const content = response.choices[0].message.content;
    if (!content) {
      console.log(
        "No content returned from AI for bibliographic data extraction",
      );
      return bookInfo;
    }

    let extractedData;
    try {
      extractedData = JSON.parse(content);

      // DEBUG: Log detailed information about the extracted data
      console.log(
        `DEBUG: Bibliographic data for "${bookInfo.title}" by "${bookInfo.author}":`,
      );
      console.log(`- Page count: ${extractedData.pageCount || "null"}`);
      console.log(`- Binding: ${extractedData.binding || "null"}`);
      console.log(`- Dimensions: ${extractedData.dimensions || "null"}`);
      console.log(`- Edition: ${extractedData.edition || "null"}`);
      console.log(`- Location: ${extractedData.location || "null"}`);
      console.log(`- Publisher: ${extractedData.publisher || "null"}`);
    } catch (error: unknown) {
      console.error("Error parsing bibliographic data JSON:", error);
      return bookInfo;
    }

    // Make sure to parse pageCount as a number
    const pageCount = extractedData.pageCount
      ? typeof extractedData.pageCount === "string"
        ? parseInt(extractedData.pageCount, 10)
        : extractedData.pageCount
      : null;

    // Explicitly log final values before returning
    console.log(`[${extractionId}] FINAL extracted bibliographic values:`);
    console.log(
      `- Page count: ${pageCount} (original: ${extractedData.pageCount}, type: ${typeof extractedData.pageCount})`,
    );
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
export async function searchBooks(params: any): Promise<{ items: any[] }> {
  try {
    // Log the search request
    apiLogger.logRequest("OpenAI API", {
      operation: "searchBooks",
      model: MODEL,
      searchParams: params,
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

    // Query OpenAI for book search results with a simple but structured prompt
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that provides book information in JSON format.`,
        },
        {
          role: "user",
          content: `Get detailed information about books matching: ${searchQuery}

Return the response as a JSON object with an "items" array containing books. Each book should have these fields:
- title: Full book title
- author: Book author's name
- publisher: Publisher name
- publishedDate: Publication date (year)
- description: Brief description of the book
- pageCount: Number of pages
- categories: Array of genres or categories
- language: Primary language of the book (e.g., "de" for German)
- isbn: The ISBN number (if available)`,
        },
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
      // Parse the JSON response - this will be in a free-form format now
      const searchResults = JSON.parse(content);

      console.log(
        "Raw OpenAI search response:",
        JSON.stringify(searchResults).substring(0, 500) + "...",
      );

      // Determine what format the results are in and normalize to our expected structure
      let items = [];

      if (Array.isArray(searchResults)) {
        // Direct array of books
        items = searchResults.map((book) => ({
          volumeInfo: {
            title: book.title || book.name || "",
            authors: Array.isArray(book.authors)
              ? book.authors
              : book.author
                ? Array.isArray(book.author)
                  ? book.author
                  : [book.author]
                : [],
            publisher: book.publisher || book.publishingHouse || "",
            publishedDate:
              book.publishedDate || book.year || book.publishedYear || "",
            description: book.description || book.summary || book.content || "",
            pageCount:
              book.pageCount || book.pages || book.numberOfPages || null,
            categories: book.categories || book.genres || book.subjects || [],
            imageLinks: book.imageLinks || book.image || { thumbnail: null },
            language: book.language || book.languageCode || "de",
            isbn: book.isbn || book.isbn13 || null,
          },
        }));
      } else if (searchResults.books && Array.isArray(searchResults.books)) {
        // { books: [...] } format
        items = searchResults.books.map((book) => ({
          volumeInfo: {
            title: book.title || book.name || "",
            authors: Array.isArray(book.authors)
              ? book.authors
              : book.author
                ? Array.isArray(book.author)
                  ? book.author
                  : [book.author]
                : [],
            publisher: book.publisher || book.publishingHouse || "",
            publishedDate:
              book.publishedDate || book.year || book.publishedYear || "",
            description: book.description || book.summary || book.content || "",
            pageCount:
              book.pageCount || book.pages || book.numberOfPages || null,
            categories: book.categories || book.genres || book.subjects || [],
            imageLinks: book.imageLinks || book.image || { thumbnail: null },
            language: book.language || book.languageCode || "de",
            isbn: book.isbn || book.isbn13 || null,
          },
        }));
      } else if (searchResults.items && Array.isArray(searchResults.items)) {
        // Standard { items: [...] } format
        items = searchResults.items.map((book) => {
          if (book.volumeInfo) {
            // Item already has volumeInfo structure
            return book;
          } else {
            // Need to transform to volumeInfo structure
            return {
              volumeInfo: {
                title: book.title || book.name || "",
                authors: Array.isArray(book.authors)
                  ? book.authors
                  : book.author
                    ? Array.isArray(book.author)
                      ? book.author
                      : [book.author]
                    : [],
                publisher: book.publisher || book.publishingHouse || "",
                publishedDate:
                  book.publishedDate || book.year || book.publishedYear || "",
                description:
                  book.description || book.summary || book.content || "",
                pageCount:
                  book.pageCount || book.pages || book.numberOfPages || null,
                categories:
                  book.categories || book.genres || book.subjects || [],
                imageLinks: book.imageLinks ||
                  book.image || { thumbnail: null },
                language: book.language || book.languageCode || "de",
                isbn: book.isbn || book.isbn13 || null,
              },
            };
          }
        });
      } else if (
        searchResults.results &&
        Array.isArray(searchResults.results)
      ) {
        // { results: [...] } format
        items = searchResults.results.map((book) => ({
          volumeInfo: {
            title: book.title || book.name || "",
            authors: Array.isArray(book.authors)
              ? book.authors
              : book.author
                ? Array.isArray(book.author)
                  ? book.author
                  : [book.author]
                : [],
            publisher: book.publisher || book.publishingHouse || "",
            publishedDate:
              book.publishedDate || book.year || book.publishedYear || "",
            description: book.description || book.summary || book.content || "",
            pageCount:
              book.pageCount || book.pages || book.numberOfPages || null,
            categories: book.categories || book.genres || book.subjects || [],
            imageLinks: book.imageLinks || book.image || { thumbnail: null },
            language: book.language || book.languageCode || "de",
            isbn: book.isbn || book.isbn13 || null,
          },
        }));
      }

      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "searchBooks",
        status: "success",
        query: searchQuery,
        resultCount: items.length,
      });

      return { items };
    } catch (error: unknown) {
      console.error("Error parsing book search results from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "searchBooks",
        error: error instanceof Error ? error.message : String(error),
        query: searchQuery,
      });
      return { items: [] };
    }
  } catch (error: any) {
    console.error("Error searching books with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "searchBooks",
      error: error.message || String(error),
      query:
        params.query ||
        `${params.title || ""} ${params.author || ""} ${params.isbn || ""}`,
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
      isbn,
    });

    // Clean the ISBN
    const cleanedISBN = isbn.replace(/[^0-9X]/gi, "");

    // Create a unique ID for this request
    const lookupId = `isbn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[${lookupId}] Looking up book with ISBN: "${cleanedISBN}"`);

    // Query OpenAI for book details by ISBN using a simple, direct prompt with format instructions
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that provides book information in JSON format.
          
IMPORTANT: When given an ISBN number, you must ONLY return information for that exact ISBN. Do not substitute with information about similar books or books by the same author. If you don't have information about the specific ISBN, clearly indicate this in your response with a 'bookFound: false' field instead of making up information.`,
        },
        {
          role: "user",
          content: `Get detailed information about the book with ISBN: ${cleanedISBN}

Return the response as a JSON object with these fields:
- title: Full book title
- author: Book author's name
- publisher: Publisher name
- publishedDate: Publication date (year)
- description: Brief description of the book
- pageCount: Number of pages
- categories: Array of genres or categories
- language: Primary language of the book (e.g., "de" for German)
- dimensions: Physical dimensions (in cm)
- binding: Book binding type (Hardcover, Paperback, etc.)
- isbn: The ISBN number`,
        },
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
      // Parse the JSON response - this will be in a free-form format now
      const bookData = JSON.parse(content);

      console.log(
        "Raw OpenAI book data response:",
        JSON.stringify(bookData).substring(0, 500) + "...",
      );

      // Check if the book was not found
      if (bookData.notFound || bookData.error) {
        console.log(`No book found for ISBN: ${isbn}`);
        return null;
      }

      // Extract fields from the response with fallbacks
      // We're flexible here since the format might vary
      const title = bookData.title || bookData.bookTitle || bookData.name || "";
      const authors = bookData.authors || bookData.author || [];
      const authorsArray = Array.isArray(authors) ? authors : [authors];

      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "getBookByISBN",
        status: "success",
        isbn,
        bookTitle: title,
      });

      // Return in the format expected by our application
      return {
        id: `ISBN:${isbn}`,
        volumeInfo: {
          title,
          authors: authorsArray,
          publisher: bookData.publisher || bookData.publishingHouse || "",
          publishedDate:
            bookData.publishedDate ||
            bookData.year ||
            bookData.publishedYear ||
            "",
          description:
            bookData.description || bookData.summary || bookData.content || "",
          pageCount:
            bookData.pageCount ||
            bookData.pages ||
            bookData.numberOfPages ||
            null,
          categories:
            bookData.categories ||
            bookData.genres ||
            bookData.subjects ||
            bookData.genre ||
            [],
          imageLinks: bookData.imageLinks ||
            bookData.coverImage || { thumbnail: null },
          language: bookData.language || bookData.languageCode || "de",
          industryIdentifiers: [
            {
              type: "ISBN_13",
              identifier: bookData.isbn || bookData.isbn13 || isbn,
            },
          ],
          dimensions:
            bookData.dimensions || bookData.size || bookData.format || "",
          binding:
            bookData.binding ||
            bookData.coverType ||
            bookData.bindingType ||
            "",
        },
      };
    } catch (error: unknown) {
      console.error("Error parsing book data from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "getBookByISBN",
        error: error instanceof Error ? error.message : String(error),
        isbn,
      });
      return null;
    }
  } catch (error: any) {
    console.error("Error getting book by ISBN with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "getBookByISBN",
      error: error.message || String(error),
      isbn,
    });
    return null;
  }
}

// Search for similar books using OpenAI instead of Google Books
export async function searchSimilarBooks(
  bookInfo: Partial<Book>,
): Promise<{ volumeInfo: any }[]> {
  try {
    // Log the similar books request
    apiLogger.logRequest("OpenAI API", {
      operation: "searchSimilarBooks",
      model: MODEL,
      bookInfo: {
        title: bookInfo.title,
        author: bookInfo.author,
        genres: bookInfo.genres,
      },
    });

    // Create a unique ID for this request
    const similarId = `similar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(
      `[${similarId}] Finding similar books to: "${bookInfo.title}" by "${bookInfo.author}"`,
    );

    // Prepare context from available book information
    const context = `Book information:
Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
Genres: ${Array.isArray(bookInfo.genres) ? bookInfo.genres.join(", ") : bookInfo.genres || "Unknown"}
${bookInfo.summary ? `Summary: ${bookInfo.summary.substring(0, 200)}...` : ""}`;

    // Query OpenAI for similar books with a simple but structured prompt
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that provides book recommendations in JSON format.`,
        },
        {
          role: "user",
          content: `Get 4 books similar to this one:
Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
${Array.isArray(bookInfo.genres) ? `Genres: ${bookInfo.genres.join(", ")}` : ""}

Return the response as a JSON object with an "items" array containing books. Each book should have these fields:
- title: Full book title
- author: Book author's name
- publisher: Publisher name
- publishedDate: Publication date (year)
- description: Brief description of the book and why it's similar
- pageCount: Number of pages (approximate is fine)
- categories: Array of genres or categories
- language: Primary language of the book (e.g., "de" for German, same as reference book)`,
        },
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
      // Parse the JSON response - this will be in a free-form format now
      const similarBooks = JSON.parse(content);

      console.log(
        "Raw OpenAI similar books response:",
        JSON.stringify(similarBooks).substring(0, 500) + "...",
      );

      // Determine what format the results are in and normalize to our expected structure
      let items = [];

      if (Array.isArray(similarBooks)) {
        // Direct array of books
        items = similarBooks.map((book) => ({
          volumeInfo: {
            title: book.title || book.name || "",
            authors: Array.isArray(book.authors)
              ? book.authors
              : book.author
                ? Array.isArray(book.author)
                  ? book.author
                  : [book.author]
                : [],
            publisher: book.publisher || book.publishingHouse || "",
            publishedDate:
              book.publishedDate || book.year || book.publishedYear || "",
            description: book.description || book.summary || book.content || "",
            pageCount:
              book.pageCount || book.pages || book.numberOfPages || null,
            categories: book.categories || book.genres || book.subjects || [],
            imageLinks: book.imageLinks || book.image || { thumbnail: null },
            language: book.language || book.languageCode || "de",
            isbn: book.isbn || book.isbn13 || null,
          },
        }));
      } else if (similarBooks.books && Array.isArray(similarBooks.books)) {
        // { books: [...] } format
        items = similarBooks.books.map((book) => ({
          volumeInfo: {
            title: book.title || book.name || "",
            authors: Array.isArray(book.authors)
              ? book.authors
              : book.author
                ? Array.isArray(book.author)
                  ? book.author
                  : [book.author]
                : [],
            publisher: book.publisher || book.publishingHouse || "",
            publishedDate:
              book.publishedDate || book.year || book.publishedYear || "",
            description: book.description || book.summary || book.content || "",
            pageCount:
              book.pageCount || book.pages || book.numberOfPages || null,
            categories: book.categories || book.genres || book.subjects || [],
            imageLinks: book.imageLinks || book.image || { thumbnail: null },
            language: book.language || book.languageCode || "de",
            isbn: book.isbn || book.isbn13 || null,
          },
        }));
      } else if (similarBooks.items && Array.isArray(similarBooks.items)) {
        // Standard { items: [...] } format
        items = similarBooks.items.map((book) => {
          if (book.volumeInfo) {
            // Item already has volumeInfo structure
            return book;
          } else {
            // Need to transform to volumeInfo structure
            return {
              volumeInfo: {
                title: book.title || book.name || "",
                authors: Array.isArray(book.authors)
                  ? book.authors
                  : book.author
                    ? Array.isArray(book.author)
                      ? book.author
                      : [book.author]
                    : [],
                publisher: book.publisher || book.publishingHouse || "",
                publishedDate:
                  book.publishedDate || book.year || book.publishedYear || "",
                description:
                  book.description || book.summary || book.content || "",
                pageCount:
                  book.pageCount || book.pages || book.numberOfPages || null,
                categories:
                  book.categories || book.genres || book.subjects || [],
                imageLinks: book.imageLinks ||
                  book.image || { thumbnail: null },
                language: book.language || book.languageCode || "de",
                isbn: book.isbn || book.isbn13 || null,
              },
            };
          }
        });
      } else if (
        similarBooks.recommendations &&
        Array.isArray(similarBooks.recommendations)
      ) {
        // { recommendations: [...] } format
        items = similarBooks.recommendations.map((book) => ({
          volumeInfo: {
            title: book.title || book.name || "",
            authors: Array.isArray(book.authors)
              ? book.authors
              : book.author
                ? Array.isArray(book.author)
                  ? book.author
                  : [book.author]
                : [],
            publisher: book.publisher || book.publishingHouse || "",
            publishedDate:
              book.publishedDate || book.year || book.publishedYear || "",
            description: book.description || book.summary || book.content || "",
            pageCount:
              book.pageCount || book.pages || book.numberOfPages || null,
            categories: book.categories || book.genres || book.subjects || [],
            imageLinks: book.imageLinks || book.image || { thumbnail: null },
            language: book.language || book.languageCode || "de",
            isbn: book.isbn || book.isbn13 || null,
          },
        }));
      } else if (similarBooks.results && Array.isArray(similarBooks.results)) {
        // { results: [...] } format
        items = similarBooks.results.map((book) => ({
          volumeInfo: {
            title: book.title || book.name || "",
            authors: Array.isArray(book.authors)
              ? book.authors
              : book.author
                ? Array.isArray(book.author)
                  ? book.author
                  : [book.author]
                : [],
            publisher: book.publisher || book.publishingHouse || "",
            publishedDate:
              book.publishedDate || book.year || book.publishedYear || "",
            description: book.description || book.summary || book.content || "",
            pageCount:
              book.pageCount || book.pages || book.numberOfPages || null,
            categories: book.categories || book.genres || book.subjects || [],
            imageLinks: book.imageLinks || book.image || { thumbnail: null },
            language: book.language || book.languageCode || "de",
            isbn: book.isbn || book.isbn13 || null,
          },
        }));
      }

      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "searchSimilarBooks",
        status: "success",
        referenceBook: bookInfo.title,
        resultCount: items.length,
      });

      return items;
    } catch (error: unknown) {
      console.error("Error parsing similar books from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "searchSimilarBooks",
        error: error instanceof Error ? error.message : String(error),
        referenceBook: bookInfo.title,
      });
      return [];
    }
  } catch (error: any) {
    console.error("Error finding similar books with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "searchSimilarBooks",
      error: error.message || String(error),
      referenceBook: bookInfo.title,
    });
    return [];
  }
}

export async function enrichBookMetadata(
  bookInfo: Partial<Book>,
): Promise<Partial<Book>> {
  try {
    // Log the enrichment request
    apiLogger.logRequest("OpenAI API", {
      operation: "enrichBookMetadata",
      model: MODEL,
      bookInfo: {
        title: bookInfo.title,
        author: bookInfo.author,
        isbn: bookInfo.isbn,
      },
    });

    // Create a unique ID for this request
    const enrichmentId = `enrich_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(
      `[${enrichmentId}] Enriching book metadata with OpenAI for "${bookInfo.title || bookInfo.isbn}" by "${bookInfo.author || "unknown"}"`,
    );

    // Prepare context from available book information
    const context = `Book information:
Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
ISBN: ${bookInfo.isbn || "Unknown"}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ""}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ""}
${bookInfo.summary ? `Summary preview: ${bookInfo.summary.substring(0, 150)}...` : ""}`;

    // Query OpenAI to enrich the book's metadata with a simple but structured prompt
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that provides book information in JSON format.
          
IMPORTANT: When given an ISBN number, you must ONLY return information for that exact ISBN. Do not substitute with information about similar books or books by the same author. If you don't have information about the specific ISBN, clearly indicate this in your response with a 'bookFound: false' field instead of making up information.`,
        },
        {
          role: "user",
          content: `Get detailed information about this book:
Title: ${bookInfo.title || "Unknown"}
Author: ${bookInfo.author || "Unknown"}
ISBN: ${bookInfo.isbn || "Unknown"}
${bookInfo.publishedYear ? `Year: ${bookInfo.publishedYear}` : ""}
${bookInfo.publisher ? `Publisher: ${bookInfo.publisher}` : ""}

Return the response as a JSON object with the following fields:
- title: Full book title
- author: Book author's name
- publisher: Publisher name
- publishedYear: Publication year (number)
- description: Brief description of the book
- pageCount: Number of pages
- genres: Array of genres or categories
- language: Primary language of the book (e.g., "de" for German)
- dimensions: Physical dimensions (in cm)
- binding: Book binding type (Hardcover, Paperback, etc.)
- isbn: The ISBN number
- location: Publishing location/city`,
        },
      ],
      response_format: { type: "json_object" },
    });

    // Log the raw response
    console.log(`[${enrichmentId}] OpenAI enrichment response received`);

    // Extract the content
    const content = response.choices[0].message.content;
    if (!content) {
      console.log(
        "No content returned from OpenAI for book metadata enrichment",
      );
      return bookInfo;
    }

    try {
      // Parse the JSON response - this will be in a free-form format now
      const enrichedData = JSON.parse(content);

      console.log(
        "Raw OpenAI enrichment response:",
        JSON.stringify(enrichedData).substring(0, 500) + "...",
      );
      
      // Check if the book was not found
      if (enrichedData.bookFound === false) {
        console.log(`[${enrichmentId}] OpenAI indicates book not found for ISBN: ${bookInfo.isbn}`);
        return bookInfo; // Return original info if book not found
      }
      
      // Verify if the returned ISBN matches the requested ISBN (if an ISBN was provided)
      if (bookInfo.isbn) {
        const requestedIsbn = bookInfo.isbn.replace(/[^0-9X]/gi, '');
        const returnedIsbn = enrichedData.isbn?.replace(/[^0-9X]/gi, '');
        
        if (returnedIsbn && requestedIsbn !== returnedIsbn) {
          console.log(`[${enrichmentId}] WARNING: ISBN mismatch detected! Requested: ${requestedIsbn}, Returned: ${returnedIsbn}`);
          console.log(`[${enrichmentId}] This suggests OpenAI may have provided information for a different book.`);
          
          // Add warning metadata
          enrichedData.metadata = enrichedData.metadata || {};
          enrichedData.metadata.isbnMismatch = true;
          enrichedData.metadata.requestedIsbn = requestedIsbn;
          enrichedData.metadata.returnedIsbn = returnedIsbn;
        }
      }

      // Extract fields from the response with fallbacks
      // We're flexible here since the format might vary
      const title =
        enrichedData.title || enrichedData.bookTitle || enrichedData.name || "";
      const author = enrichedData.author || enrichedData.authors || [];
      const authorArray = Array.isArray(author) ? author : [author];

      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "enrichBookMetadata",
        status: "success",
        bookTitle: title || bookInfo.title,
      });

      // Merge the enriched data with the original book info
      // Keep original data where available and fill in the blanks
      return {
        ...bookInfo,
        title: bookInfo.title || title,
        author:
          bookInfo.author || (authorArray.length > 0 ? authorArray[0] : ""),
        publishedYear:
          bookInfo.publishedYear ||
          enrichedData.publishedYear ||
          enrichedData.year ||
          null,
        publisher:
          bookInfo.publisher ||
          enrichedData.publisher ||
          enrichedData.publishingHouse ||
          null,
        pageCount:
          bookInfo.pageCount ||
          enrichedData.pageCount ||
          enrichedData.pages ||
          enrichedData.numberOfPages ||
          null,
        summary:
          bookInfo.summary ||
          enrichedData.description ||
          enrichedData.summary ||
          enrichedData.content ||
          null,
        genres:
          bookInfo.genres ||
          enrichedData.categories ||
          enrichedData.genres ||
          enrichedData.subjects ||
          enrichedData.genre ||
          null,
        language:
          bookInfo.language ||
          enrichedData.language ||
          enrichedData.languageCode ||
          "de",
        coverImageUrl:
          bookInfo.coverImageUrl ||
          enrichedData.coverImageUrl ||
          enrichedData.imageUrl ||
          null,
        isbn: bookInfo.isbn || enrichedData.isbn || enrichedData.isbn13 || null,
        // Include metadata about any ISBN mismatch
        metadata: {
          ...(bookInfo.metadata || {}),
          ...(enrichedData.metadata || {}),
        },
        binding:
          bookInfo.binding ||
          enrichedData.binding ||
          enrichedData.coverType ||
          enrichedData.bindingType ||
          null,
        dimensions:
          bookInfo.dimensions ||
          enrichedData.dimensions ||
          enrichedData.size ||
          enrichedData.format ||
          null,
        edition: bookInfo.edition || enrichedData.edition || null,
        location:
          bookInfo.location ||
          enrichedData.location ||
          enrichedData.place ||
          enrichedData.publishingLocation ||
          null,
      };
    } catch (error: unknown) {
      console.error("Error parsing book metadata JSON from OpenAI:", error);
      apiLogger.logError("OpenAI API", {
        operation: "enrichBookMetadata",
        error: error instanceof Error ? error.message : String(error),
        bookTitle: bookInfo.title,
      });
      // Return original book info if parsing fails
      return bookInfo;
    }
  } catch (error: any) {
    console.error("Error enriching book metadata with OpenAI:", error);
    apiLogger.logError("OpenAI API", {
      operation: "enrichBookMetadata",
      error: error.message || String(error),
      bookTitle: bookInfo.title,
    });
    // Return original book info if there's an error
    return bookInfo;
  }
}

// Process the full book analysis with a single comprehensive OpenAI request
export async function processBookAnalysis(
  analysisRequest: BookAnalysisRequest,
): Promise<Partial<Book>> {
  try {
    // Create a unique ID for this analysis request
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Log the incoming data for debugging
    console.log(`[${analysisId}] ProcessBookAnalysis input:`, {
      title: analysisRequest.title,
      author: analysisRequest.author,
      hasCoverImage: !!analysisRequest.coverImage,
      isbn: analysisRequest.isbn,
      language: analysisRequest.language || "de",
    });

    // Gather all available book information to send to OpenAI
    const bookIdentifiers = [];
    if (analysisRequest.isbn)
      bookIdentifiers.push(`ISBN: ${analysisRequest.isbn}`);
    if (analysisRequest.title)
      bookIdentifiers.push(`Title: ${analysisRequest.title}`);
    if (analysisRequest.author)
      bookIdentifiers.push(`Author: ${analysisRequest.author}`);

    if (bookIdentifiers.length === 0) {
      throw new Error(
        "Insufficient information provided. Please provide at least an ISBN, title, or author.",
      );
    }

    // Determine which language to use
    const language = analysisRequest.language || "de";
    const languageName =
      language === "de"
        ? "German"
        : language === "en"
          ? "English"
          : language === "fr"
            ? "French"
            : language === "es"
              ? "Spanish"
              : "German";

    // Log the API request
    apiLogger.logRequest("OpenAI API", {
      operation: "processBookAnalysis",
      model: MODEL,
      bookIdentifiers: bookIdentifiers.join(", "),
      language,
    });

    console.log(
      `[${analysisId}] Sending single comprehensive request to OpenAI for book analysis in ${languageName}`,
    );

    // Make a single API call to get all book information and analysis
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that provides detailed book information and analysis in JSON format. 
          Return your response in ${languageName} language.
          
          IMPORTANT: When given an ISBN number, you must ONLY return information for that exact ISBN. Do not substitute with information about similar books or books by the same author. If you don't have information about the specific ISBN, clearly indicate this in your response with a 'bookFound: false' field instead of making up information.`,
        },
        {
          role: "user",
          content: `Get comprehensive details and analysis about this book:
${bookIdentifiers.join("\n")}

Return the response as a structured JSON object with these fields:
- bibliographicData:
  - title: Full book title
  - author: Full author name
  - publisher: Publisher name
  - publishedYear: Publication year as a number
  - pageCount: Number of pages as a number
  - isbn: ISBN number
  - binding: Book binding type (e.g., Hardcover, Paperback)
  - dimensions: Physical dimensions (in cm)
  - edition: Edition information (e.g., "1. Auflage")
  - location: Publishing location/city
  - language: Primary language of the book (e.g., "de" for German)

- analysis:
  - summary: A concise summary of approximately 150 words (1000 characters) that captures the main content and themes
  - genres: Array of 3-5 genres or categories that best represent the book
  - themes: Array of 3 theme objects, each with:
    - theme: Short name of the theme
    - description: 2-3 sentence explanation of the theme as presented in the book
  - readingLevel:
    - level: Age recommendation (e.g., "Alter 16+")
    - score: Reading level score from 1-10

- germanLibraryCatalog:
  - catalogNumber: German library catalog number (format like "105.738.0")
  - categories: Array of catalog categories
  - secondaryClassification: Secondary classification code (format like "4.1/Acz")
  - reviewerName: Name of fictional reviewer
  - interestCategory: Interest category (format like "IK: Gesellschaft; ab 18")
  - idBNumber: ID-B number (format like "ID-B 18/102")
  
- catalogEntry: A complete library catalog entry in ${languageName}, approximately 1000-1500 characters
`,
        },
      ],
      response_format: { type: "json_object" },
    });

    // Extract the content
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI for book analysis");
    }

    try {
      // Parse the JSON response
      const result = JSON.parse(content);
      console.log(
        `[${analysisId}] Successfully received comprehensive book analysis from OpenAI`,
      );
      
      // Check if the book was not found
      if (result.bookFound === false) {
        console.log(`[${analysisId}] OpenAI indicates book not found for identifiers: ${bookIdentifiers.join(", ")}`);
        throw new Error(`Book not found for identifiers: ${bookIdentifiers.join(", ")}`);
      }
      
      // Verify if the returned ISBN matches the requested ISBN (if an ISBN was provided)
      const requestedIsbn = analysisRequest.isbn?.replace(/[^0-9X]/gi, '');
      const returnedIsbn = result.bibliographicData?.isbn?.replace(/[^0-9X]/gi, '');
      
      if (requestedIsbn && returnedIsbn && requestedIsbn !== returnedIsbn) {
        console.log(`[${analysisId}] WARNING: ISBN mismatch detected! Requested: ${requestedIsbn}, Returned: ${returnedIsbn}`);
        console.log(`[${analysisId}] This suggests OpenAI may have provided information for a different book.`);
        
        // We'll still return the data, but with a warning in the metadata
        result.metadata = result.metadata || {};
        result.metadata.isbnMismatch = true;
        result.metadata.requestedIsbn = requestedIsbn;
        result.metadata.returnedIsbn = returnedIsbn;
      }

      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "processBookAnalysis",
        status: "success",
        bookTitle: result.bibliographicData?.title,
      });

      // Map the API response to our book model
      const bookInfo: Partial<Book> = {
        // Bibliographic data
        title: result.bibliographicData?.title || analysisRequest.title || "",
        author:
          result.bibliographicData?.author || analysisRequest.author || "",
        isbn: result.bibliographicData?.isbn || analysisRequest.isbn || null,
        publisher: result.bibliographicData?.publisher || null,
        publishedYear: result.bibliographicData?.publishedYear || null,
        pageCount: result.bibliographicData?.pageCount || null,
        binding: result.bibliographicData?.binding || null,
        dimensions: result.bibliographicData?.dimensions || null,
        edition: result.bibliographicData?.edition || null,
        location: result.bibliographicData?.location || null,
        language: result.bibliographicData?.language || language,

        // Handle the cover image data if provided
        coverImageUrl:
          analysisRequest.coverImage || analysisRequest.coverImageUrl || null,

        // Analysis data
        summary: result.analysis?.summary || null,
        genres: result.analysis?.genres || null,
        themes: result.analysis?.themes || null,
        readingLevel: result.analysis?.readingLevel?.level || null,
        catalogEntry: result.catalogEntry || null,

        // German library catalog specific data
        catalogNumber: result.germanLibraryCatalog?.catalogNumber || null,
        categories: result.germanLibraryCatalog?.categories || [],
        secondaryClassification:
          result.germanLibraryCatalog?.secondaryClassification || null,
        reviewerName: result.germanLibraryCatalog?.reviewerName || null,
        interestCategory: result.germanLibraryCatalog?.interestCategory || null,
        idBNumber: result.germanLibraryCatalog?.idBNumber || null,

        // Additional metadata
        metadata: {
          readingLevelScore: result.analysis?.readingLevel?.score || null,
          // Include any ISBN mismatch information if it exists
          ...(result.metadata || {}),
        },
      };

      // Log bibliographic data for debugging
      console.log(`[${analysisId}] BIBLIOGRAPHIC DATA CHECK:`);
      console.log(`- Title: "${bookInfo.title}"`);
      console.log(`- Author: "${bookInfo.author}"`);
      console.log(
        `- Page Count: ${bookInfo.pageCount} (type: ${typeof bookInfo.pageCount})`,
      );
      console.log(`- Dimensions: ${bookInfo.dimensions}`);
      console.log(`- Binding: ${bookInfo.binding}`);
      console.log(`- Edition: ${bookInfo.edition}`);
      console.log(`- Location: ${bookInfo.location}`);
      console.log(`- Publisher: ${bookInfo.publisher}`);

      return bookInfo;
    } catch (error: any) {
      console.error(
        `[${analysisId}] Error parsing book analysis JSON from OpenAI:`,
        error,
      );
      apiLogger.logError("OpenAI API", {
        operation: "processBookAnalysis",
        error: error.message || String(error),
        bookIdentifiers: bookIdentifiers.join(", "),
      });
      throw new Error(
        `Failed to process book analysis response: ${error.message}`,
      );
    }
  } catch (error: any) {
    console.error("Error processing book analysis:", error);
    throw new Error(
      `Failed to process book analysis: ${error.message || String(error)}`,
    );
  }
}
