/**
 * Book service for enhanced ISBN lookups
 * TypeScript implementation of the Python book_service.py
 */

import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { Book } from '@shared/schema';
import { apiLogger } from '../utils/logger';

// Type definitions for API responses
interface GoogleBookVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: Array<{
    type: string;
    identifier: string;
  }>;
  pageCount?: number;
  dimensions?: {
    height?: string;
    width?: string;
    thickness?: string;
  };
  printType?: string;
  categories?: string[];
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
  language?: string;
  accessInfo?: {
    pdf?: {
      isAvailable?: boolean;
    };
  };
  isEbook?: boolean;
}

interface GoogleBookSaleInfo {
  listPrice?: {
    amount?: number;
    currencyCode?: string;
  };
  retailPrice?: {
    amount?: number;
    currencyCode?: string;
  };
}

interface GoogleBookResponse {
  kind: string;
  totalItems: number;
  items?: Array<{
    volumeInfo: GoogleBookVolumeInfo;
    saleInfo?: GoogleBookSaleInfo;
  }>;
}

interface BookData {
  title?: string;
  subtitle?: string;
  author?: string;
  statementOfResponsibility?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  language?: string;
  edition?: string;
  location?: string;
  dimensions?: string;
  isbn?: string;
  binding?: string;
  price?: string;
  summary?: string;
  genres?: string[];
  coverImageUrl?: string;
  error?: string;
  [key: string]: any;
}

/**
 * Fetch book data from Google Books API using ISBN
 * @param isbn - The ISBN to look up
 * @returns Book data or error message
 */
export async function getGoogleBooksByIsbn(isbn: string): Promise<BookData> {
  try {
    console.log(`Looking up ISBN ${isbn} in Google Books API`);
    apiLogger.logRequest("Google Books API", { 
      operation: "lookupByISBN",
      isbn
    });
    
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    
    let requestUrl = url;
    const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (googleBooksApiKey) {
      requestUrl += `&key=${googleBooksApiKey}`;
    }
    
    const response = await axios.get<GoogleBookResponse>(requestUrl);
    const data = response.data;
    
    // Log the raw response for debugging
    console.log(`GOOGLE BOOKS RAW DATA for ${isbn}`, JSON.stringify(data).substring(0, 500) + "...");
    
    if (data.totalItems === 0 || !data.items || data.items.length === 0) {
      console.warn(`No book found with ISBN ${isbn} in Google Books API`);
      return { error: "No book found with this ISBN" };
    }
    
    const bookData = data.items[0].volumeInfo;
    const saleInfo = data.items[0].saleInfo || {};
    const industryIdentifiers = bookData.industryIdentifiers || [];
    
    // Extract ISBN
    const isbn13 = industryIdentifiers.find(id => id.type === "ISBN_13")?.identifier;
    const isbn10 = industryIdentifiers.find(id => id.type === "ISBN_10")?.identifier;
    let formattedIsbn = isbn13 || isbn10;
    
    // Format ISBN with hyphens if available
    if (formattedIsbn && formattedIsbn.length === 13) {
      // Format for ISBN-13: 978-3-95916-132-9 (standard German format)
      formattedIsbn = formattedIsbn.replace(/^(\d{3})(\d{1})(\d{5})(\d{3})(\d{1})$/, '$1-$2-$3-$4-$5');
    } else if (formattedIsbn && formattedIsbn.length === 10) {
      // Format for ISBN-10: 3-95916-132-5 (standard German format)
      formattedIsbn = formattedIsbn.replace(/^(\d{1})(\d{5})(\d{3})(\w{1})$/, '$1-$2-$3-$4');
    }
    
    // Extract publication year without validation
    let publishedYear: number | undefined = undefined;
    const publishedDate = bookData.publishedDate;
    if (publishedDate) {
      const yearMatch = publishedDate.match(/^(\d{4})/);
      if (yearMatch) {
        publishedYear = parseInt(yearMatch[1], 10);
      }
    }
    
    // Extract price if available
    let price: string | undefined = undefined;
    const listPrice = saleInfo.listPrice;
    if (listPrice && listPrice.amount && listPrice.currencyCode) {
      price = `${listPrice.amount.toFixed(2)} ${listPrice.currencyCode}`;
    }
    
    // Extract authors and contributor information
    const authors = bookData.authors || [];
    const mainAuthor = authors.length > 0 ? authors[0] : undefined;
    
    // Extract statement of responsibility
    let statementOfResponsibility: string | undefined = undefined;
    if (authors.length > 0) {
      statementOfResponsibility = authors.join(", ");
    }
    
    // Extract location from publisher (if in format "Location: Publisher")
    let location: string | undefined = undefined;
    let publisher = bookData.publisher;
    if (publisher && publisher.includes(":")) {
      const parts = publisher.split(":", 2);
      location = parts[0].trim();
      publisher = parts[1].trim();
    }
    
    // Determine binding based on PDF availability or other clues
    let binding: string | undefined = undefined;
    if (bookData.isEbook || 
        (bookData.accessInfo && bookData.accessInfo.pdf && bookData.accessInfo.pdf.isAvailable)) {
      binding = "E-Book";
    }
    
    // Format dimensions if available
    let dimensions: string | undefined = undefined;
    if (bookData.dimensions && bookData.dimensions.height) {
      dimensions = `${bookData.dimensions.height} cm`;
    }
    
    // No default edition
    const edition: string | undefined = undefined;
    
    // Format result
    const result: BookData = {
      title: bookData.title || '',
      subtitle: bookData.subtitle || '',
      author: mainAuthor,
      statementOfResponsibility: statementOfResponsibility,
      publisher: publisher,
      publishedYear: publishedYear,
      pageCount: bookData.pageCount,
      language: bookData.language || '',
      edition: edition,
      location: location,
      dimensions: dimensions,
      isbn: formattedIsbn || isbn,
      binding: binding,
      price: price,
      summary: bookData.description || '',
      genres: bookData.categories || [],
      coverImageUrl: bookData.imageLinks?.thumbnail || ''
    };
    
    console.log(`Successfully retrieved book data for ISBN ${isbn} from Google Books API`);
    apiLogger.logResponse("Google Books API", {
      operation: "lookupByISBN",
      isbn,
      success: true,
      fieldsFound: Object.keys(result).filter(k => result[k] !== undefined && result[k] !== '')
    });
    
    return result;
    
  } catch (error: any) {
    console.error(`Error fetching from Google Books API: ${error.message}`);
    apiLogger.logError("Google Books API", {
      operation: "lookupByISBN",
      isbn,
      error: error.message
    });
    return { error: `Google Books API error: ${error.message}` };
  }
}

/**
 * Fetch book metadata from DNB SRU API
 * @param isbn - The ISBN to look up
 * @returns Book data or error message
 */
export async function getDnbMetadata(isbn: string): Promise<BookData> {
  try {
    console.log(`Looking up ISBN ${isbn} in DNB database`);
    apiLogger.logRequest("DNB API", {
      operation: "lookupByISBN",
      isbn
    });
    
    // DNB SRU API endpoint
    const baseUrl = "https://services.dnb.de/sru/dnb";
    const params = {
      version: "1.1",
      operation: "searchRetrieve",
      query: `isbn=${isbn}`,
      recordSchema: "MARC21-xml"
    };
    
    console.log(`DNB REQUEST URL: ${baseUrl} with params ${JSON.stringify(params)}`);
    
    const response = await axios.get(baseUrl, { params });
    
    // Parse XML response
    const xmlText = response.data;
    console.log(`DNB XML RESPONSE (first 500 chars): ${xmlText.substring(0, 500)}...`);
    
    const result = await parseStringPromise(xmlText, { explicitArray: false });
    
    // Extract the number of records
    const searchResponse = result['srw:searchRetrieveResponse'] || {};
    const numberOfRecords = parseInt(searchResponse['srw:numberOfRecords'] || '0', 10);
    
    if (numberOfRecords === 0) {
      console.warn(`No records found in DNB for ISBN ${isbn}`);
      return { error: "No records found in DNB database" };
    }
    
    // Extract MARC records
    let records = searchResponse['srw:records']?.['srw:record'] || [];
    
    // Handle single record vs array
    if (!Array.isArray(records)) {
      records = [records];
    }
    
    if (records.length === 0) {
      console.error("No record found in DNB response");
      return { error: "No record found in DNB response" };
    }
    
    // Process the first record
    const recordData = records[0]['srw:recordData']['marc:record'];
    
    // Initialize fields
    let title: string | undefined = undefined;
    let subtitle: string | undefined = undefined;
    let mainAuthor: string | undefined = undefined;
    let publisher: string | undefined = undefined;
    let publishedYear: number | undefined = undefined;
    let pageCount: number | undefined = undefined;
    let language: string | undefined = undefined;
    let location: string | undefined = undefined;
    let statementOfResponsibility: string | undefined = undefined;
    let dimensions: string | undefined = undefined;
    let binding: string | undefined = undefined;
    let price: string | undefined = undefined;
    let edition: string | undefined = undefined;
    
    // Extract datafields from MARC record
    let datafields: any[] = recordData['marc:datafield'];
    if (!Array.isArray(datafields)) {
      datafields = datafields ? [datafields] : [];
    }
    
    // Process title and statement of responsibility (MARC field 245)
    const titleField = datafields.find(field => field.$.tag === '245');
    if (titleField) {
      // Handle subfields array or object
      let subfields = titleField['marc:subfield'];
      if (!Array.isArray(subfields)) {
        subfields = subfields ? [subfields] : [];
      }
      
      // Title (subfield a)
      const titleSubfield = subfields.find((sf: any) => sf.$.code === 'a');
      if (titleSubfield && titleSubfield._) {
        title = titleSubfield._.trim();
      }
      
      // Subtitle (subfield b)
      const subtitleSubfield = subfields.find((sf: any) => sf.$.code === 'b');
      if (subtitleSubfield && subtitleSubfield._) {
        subtitle = subtitleSubfield._.trim();
      }
      
      // Statement of responsibility (subfield c)
      const respSubfield = subfields.find((sf: any) => sf.$.code === 'c');
      if (respSubfield && respSubfield._) {
        statementOfResponsibility = respSubfield._.trim();
      }
    }
    
    // Process author information (MARC field 100)
    const authorField = datafields.find(field => field.$.tag === '100');
    if (authorField) {
      let subfields = authorField['marc:subfield'];
      if (!Array.isArray(subfields)) {
        subfields = subfields ? [subfields] : [];
      }
      
      const authorSubfield = subfields.find((sf: any) => sf.$.code === 'a');
      if (authorSubfield && authorSubfield._) {
        mainAuthor = authorSubfield._.trim();
      }
    }
    
    // Process publication information (MARC field 264)
    const pubField = datafields.find(field => field.$.tag === '264');
    if (pubField) {
      let subfields = pubField['marc:subfield'];
      if (!Array.isArray(subfields)) {
        subfields = subfields ? [subfields] : [];
      }
      
      // Location (subfield a)
      const locSubfield = subfields.find((sf: any) => sf.$.code === 'a');
      if (locSubfield && locSubfield._) {
        location = locSubfield._.trim();
      }
      
      // Publisher (subfield b)
      const pubSubfield = subfields.find((sf: any) => sf.$.code === 'b');
      if (pubSubfield && pubSubfield._) {
        publisher = pubSubfield._.trim();
      }
      
      // Publication year (subfield c)
      const yearSubfield = subfields.find((sf: any) => sf.$.code === 'c');
      if (yearSubfield && yearSubfield._) {
        const yearText = yearSubfield._.trim();
        const yearMatch = yearText.match(/\d{4}/);
        if (yearMatch) {
          publishedYear = parseInt(yearMatch[0], 10);
        }
      }
    }
    
    // Process physical description (MARC field 300)
    const physicalField = datafields.find(field => field.$.tag === '300');
    if (physicalField) {
      let subfields = physicalField['marc:subfield'];
      if (!Array.isArray(subfields)) {
        subfields = subfields ? [subfields] : [];
      }
      
      // Extent/pages (subfield a)
      const extentSubfield = subfields.find((sf: any) => sf.$.code === 'a');
      if (extentSubfield && extentSubfield._) {
        const extentText = extentSubfield._.trim();
        const pagesMatch = extentText.match(/(\d+)\s*S/);
        if (pagesMatch) {
          pageCount = parseInt(pagesMatch[1], 10);
        }
      }
      
      // Dimensions (subfield c)
      const dimSubfield = subfields.find((sf: any) => sf.$.code === 'c');
      if (dimSubfield && dimSubfield._) {
        dimensions = dimSubfield._.trim();
      }
    }
    
    // Process language (MARC field 041)
    const langField = datafields.find(field => field.$.tag === '041');
    if (langField) {
      let subfields = langField['marc:subfield'];
      if (!Array.isArray(subfields)) {
        subfields = subfields ? [subfields] : [];
      }
      
      const langSubfield = subfields.find((sf: any) => sf.$.code === 'a');
      if (langSubfield && langSubfield._) {
        language = langSubfield._.trim();
      }
    }
    
    // Process edition statement (MARC field 250)
    const editionField = datafields.find(field => field.$.tag === '250');
    if (editionField) {
      let subfields = editionField['marc:subfield'];
      if (!Array.isArray(subfields)) {
        subfields = subfields ? [subfields] : [];
      }
      
      const editionSubfield = subfields.find((sf: any) => sf.$.code === 'a');
      if (editionSubfield && editionSubfield._) {
        edition = editionSubfield._.trim();
      }
    }
    
    // Format result according to our application's schema
    const resultData: BookData = {
      title: title || '',
      subtitle: subtitle || '',
      author: mainAuthor || '',
      statementOfResponsibility: statementOfResponsibility || '',
      publisher: publisher || '',
      publishedYear: publishedYear,
      pageCount: pageCount,
      language: language || '',
      edition: edition,
      location: location || '',
      dimensions: dimensions || '',
      isbn: isbn,  // Use the input ISBN
      binding: binding || '',
      price: price || '',
      // DNB doesn't provide these fields directly:
      summary: '',
      genres: [],
      coverImageUrl: ''
    };
    
    console.log(`Successfully retrieved book data for ISBN ${isbn} from DNB`);
    apiLogger.logResponse("DNB API", {
      operation: "lookupByISBN",
      isbn,
      success: true,
      fieldsFound: Object.keys(resultData).filter(k => resultData[k] !== undefined && resultData[k] !== '')
    });
    
    return resultData;
    
  } catch (error: any) {
    console.error(`Error fetching from DNB API: ${error.message}`);
    apiLogger.logError("DNB API", {
      operation: "lookupByISBN",
      isbn,
      error: error.message
    });
    return { error: `DNB API error: ${error.message}` };
  }
}

/**
 * Get book information by ISBN from multiple sources
 * and merge the results prioritizing reliable data
 * @param isbn - The ISBN to look up
 * @returns Merged book data
 */
export async function getBookByIsbn(isbn: string): Promise<Partial<Book>> {
  // Clean ISBN format for searching
  const cleanIsbn = isbn.replace(/[^0-9X]/g, '');
  console.log(`Starting book lookup for ISBN: ${isbn} (cleaned: ${cleanIsbn})`);
  
  // Initialize an empty result
  const mergedResult: BookData = { isbn: cleanIsbn };
  
  // First try DNB (more authoritative for German books)
  const dnbResult = await getDnbMetadata(cleanIsbn);
  const hasDnbData = !dnbResult.error;
  
  if (hasDnbData) {
    console.log(`Found book in DNB: ${dnbResult.title}`);
    Object.assign(mergedResult, dnbResult);
  }
  
  // Then try Google Books (for cover image and summary)
  const googleResult = await getGoogleBooksByIsbn(cleanIsbn);
  const hasGoogleData = !googleResult.error;
  
  // If we have Google Books data
  if (hasGoogleData) {
    console.log(`Found book in Google Books: ${googleResult.title}`);
    
    // If we don't have DNB data, use Google Books as base
    if (!hasDnbData) {
      Object.assign(mergedResult, googleResult);
    } else {
      // We have both sources, merge strategically
      // Always take cover image from Google if available
      if (googleResult.coverImageUrl) {
        mergedResult.coverImageUrl = googleResult.coverImageUrl;
      }
      
      // Always take summary from Google if available
      if (googleResult.summary) {
        mergedResult.summary = googleResult.summary;
      }
      
      // Always take genres from Google if available
      if (googleResult.genres && googleResult.genres.length > 0) {
        mergedResult.genres = googleResult.genres;
      }
      
      // Use Google Books data to fill in missing fields
      for (const [key, value] of Object.entries(googleResult)) {
        if (!(key in mergedResult) || mergedResult[key] === undefined || mergedResult[key] === '') {
          mergedResult[key] = value;
        }
      }
    }
  }
  
  // No hardcoded validation for year or page count
  // Just keep the original data as provided by the sources
  
  // Log the detailed merged result for debugging
  console.log(`FINAL MERGED BOOK DATA: ${JSON.stringify(mergedResult, null, 2)}`);
  
  // Log a summary of the result
  if (mergedResult.title) {
    console.log(`Successfully processed book data: '${mergedResult.title}' by ${mergedResult.author}`);
  } else {
    console.warn(`Failed to find complete book data for ISBN: ${isbn}`);
  }
  
  return mergedResult as Partial<Book>;
}