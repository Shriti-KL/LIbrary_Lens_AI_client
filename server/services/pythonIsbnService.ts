/**
 * DNB ISBN Service Adapter
 * 
 * This service provides access to the German National Library (DNB) API
 * to retrieve authentic book metadata according to DNB/German RDA standards
 */

import axios from "axios";
import { Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";
import { parseStringPromise } from 'xml2js';

// DNB SRU API endpoint for searching by ISBN
const DNB_SRU_URL = "https://services.dnb.de/sru/dnb";

// Alternative URL for OAI protocol
const DNB_OAI_URL = "https://services.dnb.de/oai/repository";

/**
 * Look up book by ISBN using DNB's SRU interface
 * Following DNB/German RDA cataloguing standards
 */
export async function lookupBookByIsbn(isbn: string): Promise<Partial<Book> | null> {
  try {
    // Clean the ISBN
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    
    console.log(`[DNB] Looking up ISBN: ${cleanIsbn}`);
    
    // First try the SRU interface
    try {
      const bookData = await lookupViaSRU(cleanIsbn);
      if (bookData) {
        return bookData;
      }
    } catch (error: any) {
      console.log(`[DNB] SRU lookup failed: ${error.message}, trying OAI lookup`);
    }
    
    // If SRU fails, try the OAI interface
    try {
      const bookData = await lookupViaOAI(cleanIsbn);
      if (bookData) {
        return bookData;
      }
    } catch (error: any) {
      console.log(`[DNB] OAI lookup failed: ${error.message}, falling back to direct XML parsing`);
    }
    
    // Fall back to direct XML parsing if both methods fail
    return await lookupViaSRUDirectXML(cleanIsbn);
    
  } catch (error: any) {
    console.error(`[DNB] Error in DNB lookup:`, error.message || error);
    
    apiLogger.logError("DNB", {
      message: "All DNB lookup methods failed",
      error: error.message || "Unknown error",
      isbn
    });
    
    return null;
  }
}

/**
 * Look up book by ISBN using DNB's SRU interface with proper XML parsing
 */
async function lookupViaSRU(cleanIsbn: string): Promise<Partial<Book> | null> {
  // Parameters for SRU search with MARCXML format
  const params = {
    version: "1.1",
    operation: "searchRetrieve",
    recordSchema: "MARC21-xml",
    query: `dnb.isbn=${cleanIsbn}`,
    maximumRecords: "1"
  };
  
  // Make the API request with proper Accept header for XML
  const response = await axios.get(DNB_SRU_URL, { 
    params,
    headers: {
      'Accept': 'application/xml'
    }
  });
  
  // Check if we received a valid response
  if (!response.data) {
    console.log(`[DNB SRU] No response data received for ISBN: ${cleanIsbn}`);
    return null;
  }
  
  // Parse the XML response
  const result = await parseStringPromise(response.data, {
    explicitArray: false,
    mergeAttrs: true
  });
  
  // Check if we have records
  if (!result || 
      !result.searchRetrieveResponse || 
      !result.searchRetrieveResponse.numberOfRecords ||
      result.searchRetrieveResponse.numberOfRecords === '0') {
    console.log(`[DNB SRU] No records found for ISBN: ${cleanIsbn}`);
    return null;
  }

  try {
    // Navigate to the MARC record
    const record = result.searchRetrieveResponse.records.record.recordData.record;
    
    // Prepare a book data object to populate
    const bookData: Partial<Book> = {
      isbn: cleanIsbn,
      source: "DNB",
      language: "de" // Default language for DNB is German
    };
    
    // Function to find a field by tag
    const findField = (tag: string, record: any) => {
      if (!record.datafield) return null;
      
      // Convert to array if it's not already
      const datafields = Array.isArray(record.datafield) ? record.datafield : [record.datafield];
      
      return datafields.find((field: any) => field.tag === tag);
    };
    
    // Function to find a subfield by code in a datafield
    const findSubfield = (field: any, code: string) => {
      if (!field || !field.subfield) return null;
      
      // Convert to array if it's not already
      const subfields = Array.isArray(field.subfield) ? field.subfield : [field.subfield];
      
      return subfields.find((subfield: any) => subfield.code === code);
    };
    
    // Function to find all fields with a specific tag
    const findAllFields = (tag: string, record: any) => {
      if (!record.datafield) return [];
      
      // Convert to array if it's not already
      const datafields = Array.isArray(record.datafield) ? record.datafield : [record.datafield];
      
      return datafields.filter((field: any) => field.tag === tag);
    };
    
    // Extract title fields (245)
    const titleField = findField('245', record);
    if (titleField) {
      const titleSubfield = findSubfield(titleField, 'a');
      if (titleSubfield) {
        bookData.title = titleSubfield._;
      }
      
      const subtitleSubfield = findSubfield(titleField, 'b');
      if (subtitleSubfield) {
        bookData.subtitle = subtitleSubfield._;
      }
      
      const statementSubfield = findSubfield(titleField, 'c');
      if (statementSubfield) {
        bookData.statementOfResponsibility = statementSubfield._;
      }
    }
    
    // Extract author (100)
    const authorField = findField('100', record);
    if (authorField) {
      const authorSubfield = findSubfield(authorField, 'a');
      if (authorSubfield) {
        bookData.mainAuthor = authorSubfield._;
      }
    }
    
    // Extract other contributors (700) such as co-authors, translators, editors, etc.
    const contributorFields = findAllFields('700', record);
    if (contributorFields && contributorFields.length > 0) {
      const contributors: {[role: string]: string[]} = {};
      
      for (const contribField of contributorFields) {
        const nameSubfield = findSubfield(contribField, 'a');
        const roleSubfield = findSubfield(contribField, 'e') || findSubfield(contribField, '4');
        
        if (nameSubfield) {
          const name = nameSubfield._;
          const role = roleSubfield ? roleSubfield._ : 'contributor';
          
          // Map common German role codes to readable roles
          let mappedRole = role;
          if (role === 'Übers.' || role === 'trl') mappedRole = 'translator';
          else if (role === 'Hrsg.' || role === 'edt') mappedRole = 'editor';
          else if (role === 'Ill.' || role === 'ill') mappedRole = 'illustrator';
          
          if (!contributors[mappedRole]) {
            contributors[mappedRole] = [];
          }
          contributors[mappedRole].push(name);
        }
      }
      
      if (Object.keys(contributors).length > 0) {
        bookData.contributors = contributors;
      }
    }
    
    // Extract edition (250)
    const editionField = findField('250', record);
    if (editionField) {
      const editionSubfield = findSubfield(editionField, 'a');
      if (editionSubfield) {
        bookData.edition = editionSubfield._;
      }
    }
    
    // Extract publication info (264)
    const pubField = findField('264', record);
    if (pubField) {
      const placeSubfield = findSubfield(pubField, 'a');
      if (placeSubfield) {
        bookData.publicationPlace = placeSubfield._;
      }
      
      const pubSubfield = findSubfield(pubField, 'b');
      if (pubSubfield) {
        bookData.publisher = pubSubfield._;
      }
      
      const yearSubfield = findSubfield(pubField, 'c');
      if (yearSubfield) {
        const yearMatch = yearSubfield._.match(/\d{4}/);
        if (yearMatch) {
          bookData.publicationYear = parseInt(yearMatch[0]);
        }
      }
    }
    
    // Extract physical description (300)
    const physicalField = findField('300', record);
    if (physicalField) {
      const pagesSubfield = findSubfield(physicalField, 'a');
      if (pagesSubfield) {
        const pagesMatch = pagesSubfield._.match(/\d+/);
        if (pagesMatch) {
          bookData.pageCount = parseInt(pagesMatch[0]);
        }
      }
      
      // Extract illustrations information
      const illustrationsSubfield = findSubfield(physicalField, 'b');
      if (illustrationsSubfield) {
        bookData.illustrations = illustrationsSubfield._;
      }
      
      const dimSubfield = findSubfield(physicalField, 'c');
      if (dimSubfield) {
        bookData.dimensions = dimSubfield._;
      }
    }
    
    // Extract price and binding (020)
    const isbnField = findField('020', record);
    if (isbnField) {
      const priceSubfield = findSubfield(isbnField, 'c');
      if (priceSubfield) {
        bookData.price = priceSubfield._;
      }
      
      const bindingSubfield = findSubfield(isbnField, 'q');
      if (bindingSubfield) {
        bookData.binding = bindingSubfield._;
      }
    }
    
    // Extract language (041)
    const langField = findField('041', record);
    if (langField) {
      const langSubfield = findSubfield(langField, 'a');
      if (langSubfield) {
        const langCode = langSubfield._;
        // Convert ISO 639-2 codes to more common ISO 639-1
        if (langCode === "ger") {
          bookData.language = "de";
        } else if (langCode === "eng") {
          bookData.language = "en";
        } else if (langCode === "fre" || langCode === "fra") {
          bookData.language = "fr";
        } else if (langCode === "ita") {
          bookData.language = "it";
        } else if (langCode === "spa") {
          bookData.language = "es";
        } else {
          bookData.language = langCode.substring(0, 2).toLowerCase();
        }
      }
    }
    
    // Log the extracted data
    const fieldsFound = Object.keys(bookData).filter(key => key !== 'isbn' && key !== 'source');
    
    if (fieldsFound.length > 0) {
      console.log(`[DNB SRU] Successfully extracted ${fieldsFound.length} fields for ISBN: ${cleanIsbn}`);
      console.log("[DNB SRU] Extracted fields:", fieldsFound.join(", "));
      
      apiLogger.logSuccess("DNB SRU", {
        message: `Successfully retrieved book data from DNB with ${fieldsFound.length} fields`,
        isbn: cleanIsbn,
        fields: fieldsFound
      });
      
      return bookData;
    } else {
      console.log(`[DNB SRU] No useful metadata fields found for ISBN: ${cleanIsbn}`);
      return null;
    }
  } catch (error: any) {
    console.error(`[DNB SRU] Error parsing XML:`, error.message || error);
    throw error;
  }
}

/**
 * Look up book by ISBN using DNB's OAI protocol
 */
async function lookupViaOAI(cleanIsbn: string): Promise<Partial<Book> | null> {
  // Parameters for OAI protocol
  const params = {
    verb: "GetRecord",
    metadataPrefix: "MARC21-xml",
    identifier: `oai:dnb.de/ISBN/${cleanIsbn}`
  };
  
  // Make the API request
  const response = await axios.get(DNB_OAI_URL, { params });
  
  // Check if we received a valid response
  if (!response.data) {
    console.log(`[DNB OAI] No response data received for ISBN: ${cleanIsbn}`);
    return null;
  }
  
  // Parse the XML response
  const result = await parseStringPromise(response.data, {
    explicitArray: false,
    mergeAttrs: true
  });
  
  // Check if we have a valid record
  if (!result || !result.OAI_PMH || !result.OAI_PMH.GetRecord) {
    console.log(`[DNB OAI] No record found for ISBN: ${cleanIsbn}`);
    return null;
  }
  
  // Extract the MARC record
  try {
    const record = result.OAI_PMH.GetRecord.record.metadata.record;
    
    // From here on, the structure is similar to SRU
    // Implement the same extraction logic as in lookupViaSRU
    // ...
    
    // This is a placeholder - the actual implementation would be similar to lookupViaSRU
    return null;
  } catch (error: any) {
    console.error(`[DNB OAI] Error parsing XML:`, error.message || error);
    throw error;
  }
}

/**
 * Fallback method: Look up book by ISBN using DNB SRU interface and direct XML parsing
 */
async function lookupViaSRUDirectXML(cleanIsbn: string): Promise<Partial<Book> | null> {
  // Parameters for SRU search with MARCXML format
  const params = {
    version: "1.1",
    operation: "searchRetrieve",
    recordSchema: "MARC21-xml",
    query: `dnb.isbn=${cleanIsbn}`,
    maximumRecords: "1"
  };
  
  // Make the API request with proper Accept header for XML
  const response = await axios.get(DNB_SRU_URL, { 
    params,
    headers: {
      'Accept': 'application/xml'
    }
  });
  
  // Check if we received a valid response
  if (!response.data) {
    console.log(`[DNB Direct XML] No response data received for ISBN: ${cleanIsbn}`);
    return null;
  }
  
  // Get the raw XML string
  const xmlString = response.data;
  
  // Prepare a book data object to populate
  const bookData: Partial<Book> = {
    isbn: cleanIsbn,
    source: "DNB",
    language: "de" // Default language for DNB is German
  };
  
  // Check for number of records
  const numberOfRecordsMatch = /<zs:numberOfRecords>(.*?)<\/zs:numberOfRecords>/;
  const recordsMatch = numberOfRecordsMatch.exec(xmlString);
  
  if (!recordsMatch || parseInt(recordsMatch[1]) === 0) {
    console.log(`[DNB Direct XML] No records found for ISBN: ${cleanIsbn}`);
    return null;
  }
  
  // Extract all available fields using regular expressions
  
  // Extract title (245 field, subfield a)
  const titleMatch = /<datafield tag="245"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/i;
  const titleResult = titleMatch.exec(xmlString);
  if (titleResult && titleResult[1]) {
    bookData.title = titleResult[1].trim();
  }
  
  // Extract subtitle (245 field, subfield b)
  const subtitleMatch = /<datafield tag="245"[\s\S]*?<subfield code="b">(.*?)<\/subfield>/i;
  const subtitleResult = subtitleMatch.exec(xmlString);
  if (subtitleResult && subtitleResult[1]) {
    bookData.subtitle = subtitleResult[1].trim();
  }
  
  // Extract statement of responsibility (245 field, subfield c)
  const statementMatch = /<datafield tag="245"[\s\S]*?<subfield code="c">(.*?)<\/subfield>/i;
  const statementResult = statementMatch.exec(xmlString);
  if (statementResult && statementResult[1]) {
    bookData.statementOfResponsibility = statementResult[1].trim();
  }
  
  // Extract main author (100 field, subfield a)
  const authorMatch = /<datafield tag="100"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/i;
  const authorResult = authorMatch.exec(xmlString);
  if (authorResult && authorResult[1]) {
    bookData.mainAuthor = authorResult[1].trim();
  }
  
  // Extract edition (250 field, subfield a)
  const editionMatch = /<datafield tag="250"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/i;
  const editionResult = editionMatch.exec(xmlString);
  if (editionResult && editionResult[1]) {
    bookData.edition = editionResult[1].trim();
  }
  
  // Extract more fields as needed...
  // (similar to previous implementation)
  
  // Log the extracted data
  const fieldsFound = Object.keys(bookData).filter(key => key !== 'isbn' && key !== 'source');
  
  if (fieldsFound.length > 0) {
    console.log(`[DNB Direct XML] Successfully extracted ${fieldsFound.length} fields for ISBN: ${cleanIsbn}`);
    console.log("[DNB Direct XML] Extracted fields:", fieldsFound.join(", "));
    
    apiLogger.logSuccess("DNB Direct XML", {
      message: `Successfully retrieved book data using direct XML parsing with ${fieldsFound.length} fields`,
      isbn: cleanIsbn,
      fields: fieldsFound
    });
    
    return bookData;
  } else {
    console.log(`[DNB Direct XML] No useful metadata fields found for ISBN: ${cleanIsbn}`);
    return null;
  }
}