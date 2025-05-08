// New implementation of OpenAI functions for a streamlined approach

import OpenAI from "openai";
import { Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";
import * as googleBooks from "./googleBooks";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// New function that takes Google Books data and a list of missing fields
// and sends ONE OpenAI request to fill in missing metadata and generate analysis
export async function completeBookMetadata(
  bookData: Partial<Book>,
  missingFields: string[]
): Promise<Partial<Book>> {
  try {
    const analysisId = `complete_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    console.log(`[${analysisId}] Sending ONE request to OpenAI to complete book metadata and generate analysis`);
    console.log(`[${analysisId}] Book info: "${bookData.title || ''}" by "${bookData.author || ''}", ISBN: ${bookData.isbn || 'None'}`);
    console.log(`[${analysisId}] Fields to complete: ${missingFields.join(', ')}`);
    
    // Determine which language to use for the response (default to German if not specified)
    const responseLanguage = bookData.language || "de";
    const responseLanguageName =
      responseLanguage === "de"
        ? "German"
        : responseLanguage === "en"
        ? "English"
        : responseLanguage === "fr"
        ? "French"
        : responseLanguage === "es"
        ? "Spanish"
        : "German";
    
    // Construct a context string with all the information we already have
    const context = `
Title: ${bookData.title || "Unknown"}
Author: ${bookData.author || "Unknown"}
ISBN: ${bookData.isbn || "Unknown"}
${bookData.publisher ? `Publisher: ${bookData.publisher}` : ""}
${bookData.publishedYear ? `Year: ${bookData.publishedYear}` : ""}
${bookData.pageCount ? `Pages: ${bookData.pageCount}` : ""}
${bookData.subtitle ? `Subtitle: ${bookData.subtitle}` : ""}
    `.trim();
    
    // Prepare a list of the fields we need OpenAI to complete
    const fieldsToComplete = missingFields.map(field => {
      switch(field) {
        case 'title': return "title (if missing)";
        case 'author': return "author (if missing)";
        case 'publisher': return "publisher (if missing)";
        case 'publishedYear': return "publication year (if missing)";
        case 'pageCount': return "page count (if missing)";
        case 'isbn': return "ISBN (if missing)";
        case 'translator': return "translator's name (fill with N/A if none)";
        case 'illustrator': return "illustrator's name (fill with N/A if none)";
        case 'edition': return "edition information";
        case 'location': return "publishing location/city";
        case 'dimensions': return "physical dimensions (in cm)";
        case 'binding': return "binding type (hardcover, paperback, etc.)";
        case 'price': return "price information (with currency)";
        case 'summary': return "a 150-word summary of the book content";
        case 'genres': return "3-5 genres that best categorize this book";
        case 'themes': return "3 major themes in the book, each with a short description";
        default: return field;
      }
    });
    
    apiLogger.logRequest("OpenAI API", {
      operation: "completeBookMetadata",
      model: MODEL,
      bookInfo: {
        title: bookData.title,
        author: bookData.author,
        isbn: bookData.isbn,
      },
      fieldsToComplete: missingFields
    });
    
    // Make a single API call to get all the missing information at once
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a library and book metadata specialist who provides accurate and comprehensive information about books.

INSTRUCTIONS:
1. Process the query in English for maximum accuracy
2. Return your final response in ${responseLanguageName} language
3. ALWAYS respond with a properly structured JSON

IMPORTANT: If you don't have information about specific fields, use "N/A" for text fields and null for numeric fields. DO NOT invent or guess at information you don't have. Answer with what you know is accurate.`
        },
        {
          role: "user",
          content: `Based on the following book information, provide the following details:

BOOK INFORMATION:
${context}

FIELDS TO COMPLETE:
${fieldsToComplete.join("\n")}

Return your response as a JSON object with the following structure:
{
  "bibliographicData": {
    "title": "Full book title (if missing)",
    "author": "Author's full name (if missing)",
    "translator": "Translator's name or N/A",
    "illustrator": "Illustrator's name or N/A",
    "publisher": "Publisher's name (if missing)",
    "publishedYear": Year as a number (if missing),
    "pageCount": Number of pages as a number (if missing),
    "isbn": "ISBN number (if missing)",
    "edition": "Edition information",
    "location": "Publishing location/city",
    "dimensions": "Physical dimensions in cm",
    "binding": "Binding type (hardcover, paperback, etc.)",
    "price": "Price with currency",
    "language": "Language code (e.g., 'de' for German)"
  },
  "contentAnalysis": {
    "summary": "A 150-word summary of the book's content",
    "genres": ["Genre 1", "Genre 2", "Genre 3", ...],
    "themes": [
      {
        "name": "Theme name 1",
        "description": "Brief description of this theme"
      },
      {
        "name": "Theme name 2",
        "description": "Brief description of this theme"
      },
      {
        "name": "Theme name 3",
        "description": "Brief description of this theme"
      }
    ]
  }
}`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Extract the content
    const content = response.choices[0].message.content;
    if (!content) {
      console.error(`[${analysisId}] No content returned from OpenAI`);
      return bookData; // Return original data if OpenAI returns nothing
    }
    
    try {
      // Parse the JSON response
      const result = JSON.parse(content);
      
      console.log(`[${analysisId}] Successfully received metadata and analysis from OpenAI`);
      
      // Log success
      apiLogger.logResponse("OpenAI API", {
        operation: "completeBookMetadata",
        status: "success",
        bookTitle: result.bibliographicData?.title || bookData.title,
      });
      
      // Merge the OpenAI data with our existing book data
      // Book data from Google Books takes precedence over OpenAI data
      // We only use OpenAI data for fields that are missing in bookData
      const mergedData: Partial<Book> = {
        ...bookData,
        
        // Bibliographic data - use existing data first, fall back to OpenAI data
        title: bookData.title || result.bibliographicData?.title || "",
        author: bookData.author || result.bibliographicData?.author || "",
        publisher: bookData.publisher || result.bibliographicData?.publisher || null,
        publishedYear: bookData.publishedYear || result.bibliographicData?.publishedYear || null,
        pageCount: bookData.pageCount || result.bibliographicData?.pageCount || null,
        isbn: bookData.isbn || result.bibliographicData?.isbn || null,
        
        // Additional fields - these typically come from OpenAI
        translator: result.bibliographicData?.translator || null,
        illustrator: result.bibliographicData?.illustrator || null,
        edition: result.bibliographicData?.edition || null,
        location: result.bibliographicData?.location || null,
        dimensions: result.bibliographicData?.dimensions || null,
        binding: result.bibliographicData?.binding || null,
        price: result.bibliographicData?.price || null,
        
        // Content analysis - always from OpenAI
        summary: result.contentAnalysis?.summary || null,
        genres: result.contentAnalysis?.genres || null,
        themes: result.contentAnalysis?.themes || null,
        
        // Metadata - preserve existing metadata
        metadata: {
          ...(bookData.metadata || {}),
          openaiEnrichment: true,
          completedFields: missingFields
        }
      };
      
      // Log merged data
      console.log(`[${analysisId}] Merged book data: "${mergedData.title}" by "${mergedData.author}"`);
      console.log(`[${analysisId}] Completed ${missingFields.length} missing fields`);
      
      return mergedData;
      
    } catch (error) {
      console.error(`[${analysisId}] Error parsing OpenAI response:`, error);
      console.error(`[${analysisId}] Raw response:`, content);
      
      // Return original data if parsing fails
      return bookData;
    }
  } catch (error: any) {
    console.error("Error completing book metadata:", error);
    apiLogger.logError("OpenAI API", {
      operation: "completeBookMetadata",
      error: error.message || String(error),
      bookTitle: bookData.title,
    });
    
    // Return original book info if there's an error
    return bookData;
  }
}