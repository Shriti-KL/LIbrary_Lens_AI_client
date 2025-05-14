/**
 * DNB ISBN Service Adapter
 * 
 * This service provides access to the German National Library (DNB) API
 * to retrieve authentic book metadata according to DNB/German RDA standards
 */

import axios from "axios";
import { Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";

// DNB SRU API endpoints
const DNB_SRU_URL = "https://services.dnb.de/sru/dnb";
const DNB_SEARCH_URL = "https://portal.dnb.de/opac.htm";

/**
 * Look up book by ISBN using DNB API (SRU interface)
 * Following DNB/German RDA cataloguing standards
 */
export async function lookupBookByIsbn(isbn: string): Promise<Partial<Book> | null> {
  try {
    // Clean the ISBN
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    
    console.log(`[DNB] Looking up ISBN: ${cleanIsbn}`);
    
    // Prepare the DNB SRU API request using ISBN
    // Documentation: https://www.dnb.de/EN/Professionell/Metadatendienste/Datenbezug/SRU/sru_node.html
    const params = {
      version: '1.1',
      operation: 'searchRetrieve',
      query: `dnb.isbn=${cleanIsbn}`,
      recordSchema: 'MARC21-xml',
      maximumRecords: '1'
    };
    
    // Make the API request to DNB
    const response = await axios.get(DNB_SRU_URL, { params });
    
    // Check if we got a valid response with records
    if (!response.data || 
        !response.data.searchRetrieveResponse || 
        !response.data.searchRetrieveResponse.records || 
        response.data.searchRetrieveResponse.records.length === 0) {
      console.log(`[DNB] No records found for ISBN: ${cleanIsbn}`);
      return null;
    }
    
    // Extract the MARC21 record
    const record = response.data.searchRetrieveResponse.records[0].recordData.record;
    
    // If no record found, return null
    if (!record) {
      console.log(`[DNB] No valid record found for ISBN: ${cleanIsbn}`);
      return null;
    }
    
    // Parse the MARC21 record to extract book metadata
    // This follows German RDA cataloguing standards
    const bookData: Partial<Book> = {
      isbn: cleanIsbn,
      source: "DNB"
    };
    
    // Extract each field from the MARC21 record
    // Title information (245)
    if (record.datafield && Array.isArray(record.datafield)) {
      // Extract title (245)
      const titleField = record.datafield.find((field: any) => field.$.tag === '245');
      if (titleField && titleField.subfield) {
        // Title (245 $a)
        const titleSubfield = titleField.subfield.find((subfield: any) => subfield.$.code === 'a');
        if (titleSubfield && titleSubfield._) {
          bookData.title = titleSubfield._.trim();
        }
        
        // Subtitle (245 $b)
        const subtitleSubfield = titleField.subfield.find((subfield: any) => subfield.$.code === 'b');
        if (subtitleSubfield && subtitleSubfield._) {
          bookData.subtitle = subtitleSubfield._.trim();
        }
        
        // Statement of responsibility (245 $c)
        const statementSubfield = titleField.subfield.find((subfield: any) => subfield.$.code === 'c');
        if (statementSubfield && statementSubfield._) {
          bookData.statementOfResponsibility = statementSubfield._.trim();
        }
      }
      
      // Extract author (100)
      const authorField = record.datafield.find((field: any) => field.$.tag === '100');
      if (authorField && authorField.subfield) {
        const authorSubfield = authorField.subfield.find((subfield: any) => subfield.$.code === 'a');
        if (authorSubfield && authorSubfield._) {
          bookData.mainAuthor = authorSubfield._.trim();
        }
      }
      
      // Extract edition (250)
      const editionField = record.datafield.find((field: any) => field.$.tag === '250');
      if (editionField && editionField.subfield) {
        const editionSubfield = editionField.subfield.find((subfield: any) => subfield.$.code === 'a');
        if (editionSubfield && editionSubfield._) {
          bookData.edition = editionSubfield._.trim();
        }
      }
      
      // Extract publication info (264)
      const pubField = record.datafield.find((field: any) => field.$.tag === '264');
      if (pubField && pubField.subfield) {
        // Place (264 $a)
        const placeSubfield = pubField.subfield.find((subfield: any) => subfield.$.code === 'a');
        if (placeSubfield && placeSubfield._) {
          bookData.publicationPlace = placeSubfield._.trim();
        }
        
        // Publisher (264 $b)
        const pubSubfield = pubField.subfield.find((subfield: any) => subfield.$.code === 'b');
        if (pubSubfield && pubSubfield._) {
          bookData.publisher = pubSubfield._.trim();
        }
        
        // Year (264 $c)
        const yearSubfield = pubField.subfield.find((subfield: any) => subfield.$.code === 'c');
        if (yearSubfield && yearSubfield._) {
          const yearMatch = yearSubfield._.match(/\d{4}/);
          if (yearMatch) {
            bookData.publicationYear = parseInt(yearMatch[0], 10);
          }
        }
      }
      
      // Extract physical description (300)
      const physicalField = record.datafield.find((field: any) => field.$.tag === '300');
      if (physicalField && physicalField.subfield) {
        // Pages (300 $a)
        const pagesSubfield = physicalField.subfield.find((subfield: any) => subfield.$.code === 'a');
        if (pagesSubfield && pagesSubfield._) {
          const pagesMatch = pagesSubfield._.match(/(\d+)/);
          if (pagesMatch) {
            bookData.pageCount = parseInt(pagesMatch[0], 10);
          }
        }
        
        // Dimensions (300 $c)
        const dimSubfield = physicalField.subfield.find((subfield: any) => subfield.$.code === 'c');
        if (dimSubfield && dimSubfield._) {
          bookData.dimensions = dimSubfield._.trim();
        }
      }
      
      // Extract language (041)
      const langField = record.datafield.find((field: any) => field.$.tag === '041');
      if (langField && langField.subfield) {
        const langSubfield = langField.subfield.find((subfield: any) => subfield.$.code === 'a');
        if (langSubfield && langSubfield._) {
          bookData.language = langSubfield._.trim();
        }
      } else {
        // Default to German if no language specified (DNB is primarily German)
        bookData.language = "de";
      }
    }
    
    // Log the extracted data
    console.log("[DNB] Lookup successful, extracted data:", bookData);
    apiLogger.logSuccess("DNB", { 
      message: "Successfully retrieved book data from DNB",
      isbn: cleanIsbn
    });
    
    return bookData;
  } catch (error: any) {
    console.error("Error in DNB lookup:", error.message || error);
    apiLogger.logError("DNB", {
      message: "Failed to retrieve book data from DNB",
      error: error.message || "Unknown error",
      isbn
    });
    return null;
  }
}