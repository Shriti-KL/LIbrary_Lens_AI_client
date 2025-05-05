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
          content: "You are a book cataloging expert. Analyze this book cover image and extract all relevant metadata for library cataloging. Be comprehensive and accurate."
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

    // Default to German if no language specified
    const language = bookInfo.language || "de";
    
    // Create different system prompts based on language
    let systemPrompt = "You are a literary expert who creates concise, informative book summaries for library catalogs. Focus on plot, main themes, and significance.";
    let userPrompt = `Create a concise, informative summary for the following book that would be appropriate for a library catalog. Keep it under 250 words.\n\n${context}`;
    
    // Add language instruction
    if (language === "de") {
      systemPrompt = "Du bist ein Literaturexperte, der prägnante, informative Buchzusammenfassungen für Bibliothekskataloge erstellt. Konzentriere dich auf die Handlung, die Hauptthemen und die Bedeutung des Buches.";
      userPrompt = `Erstelle eine prägnante, informative Zusammenfassung für das folgende Buch, die für einen Bibliothekskatalog geeignet wäre. Halte sie unter 250 Wörtern.\n\n${context}`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
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

    // Default to German if no language specified
    const language = (bookInfo as any).language || "de";
    
    // Create different system prompts based on language
    let systemPrompt = "You are a library cataloging expert who specializes in classifying books by genre. Identify the primary and secondary genres for this book.";
    let userPrompt = `Based on the following book information, identify 3-5 genres that best categorize this book. Return your response as a JSON array of strings with only the genre names.\n\n${context}`;
    
    // Add language instruction
    if (language === "de") {
      systemPrompt = "Du bist ein Experte für Bibliothekskatalogisierung, der sich auf die Klassifizierung von Büchern nach Genres spezialisiert hat. Identifiziere die Haupt- und Nebengenres für dieses Buch.";
      userPrompt = `Identifiziere anhand der folgenden Buchinformationen 3-5 Genres, die dieses Buch am besten kategorisieren. Gib deine Antwort als JSON-Array mit deutschen Genrenamen zurück.\n\n${context}`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
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

    // Default to German if no language specified
    const language = (bookInfo as any).language || "de";
    
    // Create different system prompts based on language
    let systemPrompt = "You are a literary analysis expert specializing in identifying themes and motifs in books.";
    let userPrompt = `Identify 3 major themes or motifs for the following book. For each theme, provide a short description. Return as a JSON array with objects containing 'name' and 'description' properties.\n\n${context}`;
    
    // Add language instruction
    if (language === "de") {
      systemPrompt = "Du bist ein Experte für literarische Analyse, der sich auf die Identifizierung von Themen und Motiven in Büchern spezialisiert hat.";
      userPrompt = `Identifiziere 3 Hauptthemen oder Motive für das folgende Buch. Gib für jedes Thema eine kurze Beschreibung an. Antworte als JSON-Array mit Objekten, die die Eigenschaften 'name' und 'description' enthalten.\n\n${context}`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
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

    // Default to German if no language specified
    const language = (bookInfo as any).language || "de";
    
    // Create different system prompts based on language
    let systemPrompt = "You are an education specialist who assesses reading levels for books.";
    let userPrompt = `Assess the appropriate reading level for this book. Return a JSON object with 'level' (a string like 'Grade 4-5' or 'Ages 12-14'), and 'score' (a number from 1-10 representing complexity).\n\n${context}`;
    
    // Add language instruction
    if (language === "de") {
      systemPrompt = "Du bist ein Bildungsspezialist, der das Leseniveau für Bücher beurteilt.";
      userPrompt = `Beurteile das geeignete Leseniveau für dieses Buch. Gib ein JSON-Objekt zurück mit 'level' (ein String wie 'Klasse 4-5' oder 'Alter 12-14') und 'score' (eine Zahl von 1-10, die die Komplexität darstellt).\n\n${context}`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
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

    // Default to German if no language specified
    const language = (bookInfo as any).language || "de";
    
    // Create different system prompts based on language
    let systemPrompt = "You are a professional librarian who creates standardized catalog entries following library catalog conventions.";
    let userPrompt = `Create a formal library catalog entry for this book following standard cataloging conventions. Include a Dewey Decimal classification if possible.\n\n${context}`;
    
    // Add language instruction
    if (language === "de") {
      systemPrompt = "Du bist ein professioneller Bibliothekar, der standardisierte Katalogeinträge nach bibliothekarischen Konventionen erstellt.";
      userPrompt = `Erstelle einen formalen Bibliothekskatalog-Eintrag für dieses Buch nach Standard-Katalogisierungskonventionen. Füge wenn möglich eine Dewey-Dezimalklassifikation hinzu.\n\n${context}`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
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
      existingSummary: !!analysisRequest.summary,
      language: analysisRequest.language || "de"
    });
    
    // Start fresh with a new book object, ignoring any existing analysis fields
    const bookInfo: Partial<Book> & { language?: string } = {
      title: analysisRequest.title || "",
      author: analysisRequest.author || "",
      isbn: analysisRequest.isbn || null,
      coverImageUrl: analysisRequest.coverImageUrl || null,
      publisher: analysisRequest.publisher || null,
      publishedYear: analysisRequest.publishedYear || null,
      // Handle the cover image data if provided
      ...(analysisRequest.coverImage && { coverImageUrl: analysisRequest.coverImage }),
      
      // Add language preference for AI-generated content (default to German)
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
    
    console.log(`[${analysisId}] Starting fresh analysis for "${bookInfo.title}" by ${bookInfo.author} in language: ${bookInfo.language}`);

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
