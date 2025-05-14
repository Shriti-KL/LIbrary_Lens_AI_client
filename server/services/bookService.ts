/**
 * Book service for enhanced ISBN lookups
 * TypeScript implementation of the Python book_service.py
 */

import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { Book } from '@shared/schema';
import { apiLogger } from '../utils/logger';
import { verifyBookData, googleBookSearch, getGoodreadsData } from './googleCustomSearch';

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
  accessInfo?: any;
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
  publishedYear?: number | null;
  pageCount?: number | null;
  language?: string;
  edition?: string | null;
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

interface SubField {
  $: {
    code: string;
    [key: string]: string;
  };
  _: string;
}

interface Field {
  $: {
    tag: string;
    [key: string]: string;
  };
  'marc:subfield': SubField | SubField[];
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
    
    // Parse XML with no arrays for single elements
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
    let datafields: Field[] = recordData['marc:datafield'];
    if (!Array.isArray(datafields)) {
      datafields = datafields ? [datafields] : [];
    }
    
    // Use a local variable to handle the MARC subfields
    let subfields: SubField[] = [];

    // Helper function to get subfields (defined as a local variable function)
    const getSubfields = (field: Field): SubField[] => {
      let sf = field['marc:subfield'];
      if (!Array.isArray(sf)) {
        sf = sf ? [sf] : [];
      }
      return sf as SubField[];
    };
    
    // Process title and statement of responsibility (MARC field 245)
    const titleField = datafields.find(field => field.$.tag === '245');
    if (titleField) {
      const subfields = getSubfields(titleField);
      
      // Title (subfield a)
      const titleSubfield = subfields.find(sf => sf.$.code === 'a');
      if (titleSubfield && titleSubfield._) {
        title = titleSubfield._.trim();
      }
      
      // Subtitle (subfield b)
      const subtitleSubfield = subfields.find(sf => sf.$.code === 'b');
      if (subtitleSubfield && subtitleSubfield._) {
        subtitle = subtitleSubfield._.trim();
      }
      
      // Statement of responsibility (subfield c)
      const respSubfield = subfields.find(sf => sf.$.code === 'c');
      if (respSubfield && respSubfield._) {
        statementOfResponsibility = respSubfield._.trim();
      }
    }
    
    // Process author information (MARC field 100)
    const authorField = datafields.find(field => field.$.tag === '100');
    if (authorField) {
      const subfields = getSubfields(authorField);
      
      const authorSubfield = subfields.find(sf => sf.$.code === 'a');
      if (authorSubfield && authorSubfield._) {
        mainAuthor = authorSubfield._.trim();
      }
    }
    
    // Process publication information (MARC field 264)
    const pubField = datafields.find(field => field.$.tag === '264');
    if (pubField) {
      const subfields = getSubfields(pubField);
      
      // Location (subfield a)
      const locSubfield = subfields.find(sf => sf.$.code === 'a');
      if (locSubfield && locSubfield._) {
        location = locSubfield._.trim();
      }
      
      // Publisher (subfield b)
      const pubSubfield = subfields.find(sf => sf.$.code === 'b');
      if (pubSubfield && pubSubfield._) {
        publisher = pubSubfield._.trim();
      }
      
      // Publication year (subfield c)
      const yearSubfield = subfields.find(sf => sf.$.code === 'c');
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
      const subfields = getSubfields(physicalField);
      
      // Extent/pages (subfield a)
      const extentSubfield = subfields.find(sf => sf.$.code === 'a');
      if (extentSubfield && extentSubfield._) {
        const extentText = extentSubfield._.trim();
        const pagesMatch = extentText.match(/(\d+)\s*S/);
        if (pagesMatch) {
          pageCount = parseInt(pagesMatch[1], 10);
        }
      }
      
      // Dimensions (subfield c)
      const dimSubfield = subfields.find(sf => sf.$.code === 'c');
      if (dimSubfield && dimSubfield._) {
        dimensions = dimSubfield._.trim();
      }
    }
    
    // Process language (MARC field 041)
    const langField = datafields.find(field => field.$.tag === '041');
    if (langField) {
      const subfields = getSubfields(langField);
      
      const langSubfield = subfields.find(sf => sf.$.code === 'a');
      if (langSubfield && langSubfield._) {
        language = langSubfield._.trim();
      }
    }
    
    // Process edition statement (MARC field 250)
    const editionField = datafields.find(field => field.$.tag === '250');
    if (editionField) {
      const subfields = getSubfields(editionField);
      
      const editionSubfield = subfields.find(sf => sf.$.code === 'a');
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
  // Generate a unique request ID for tracking this lookup in logs
  const requestId = `isbn_lookup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Clean ISBN format for searching
  const cleanIsbn = isbn.replace(/[^0-9X]/g, '');
  console.log(`[${requestId}] Starting multi-source book lookup for ISBN: ${isbn} (cleaned: ${cleanIsbn})`);
  
  // Initialize an empty result and track sources
  const mergedResult: BookData = { isbn: cleanIsbn };
  const sourcesUsed: string[] = [];
  
  // Step 1: Query DNB (German National Library) - more authoritative for German books
  console.log(`[${requestId}] Step 1: Querying DNB (German National Library)`);
  const dnbResult = await getDnbMetadata(cleanIsbn);
  const hasDnbData = !dnbResult.error;
  
  if (hasDnbData) {
    console.log(`[${requestId}] Found book in DNB: ${dnbResult.title}`);
    sourcesUsed.push('DNB');
    Object.assign(mergedResult, dnbResult);
  } else {
    console.log(`[${requestId}] No DNB data found, error: ${dnbResult.error}`);
  }
  
  // Step 2: Query Google Books API
  console.log(`[${requestId}] Step 2: Querying Google Books API`);
  const googleResult = await getGoogleBooksByIsbn(cleanIsbn);
  const hasGoogleData = !googleResult.error;
  
  // If we have Google Books data
  if (hasGoogleData) {
    console.log(`[${requestId}] Found book in Google Books: ${googleResult.title}`);
    sourcesUsed.push('Google Books');
    
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
  } else {
    console.log(`[${requestId}] No Google Books data found, error: ${googleResult.error}`);
  }
  
  // Step 3: Additional verification with Google Custom Search
  // Only proceed if we have at least a title to search for
  if (mergedResult.title) {
    console.log(`[${requestId}] Step 3: Starting additional verification with Google Custom Search`);
    
    // Check if we have both API keys needed for verification
    const hasVerificationApiKeys = process.env.GOOGLE_BOOKS_API_KEY && process.env.GOOGLE_CSE_ID;
    
    if (!hasVerificationApiKeys) {
      console.log(`[${requestId}] Skipping verification step - API keys not configured`);
      // Add basic verification info without detailed analysis
      mergedResult.verification = {
        status: "unavailable",
        confidence: 0,
        message: "Cross-source verification unavailable - API keys not configured",
        sources: sourcesUsed
      };
    } else {
      try {
        // Step 3a: Get Goodreads data for verification
        const goodreadsData = await getGoodreadsData(mergedResult.title, mergedResult.author || "");
        if (!goodreadsData.error) {
          console.log(`[${requestId}] Found book on Goodreads: ${goodreadsData.title}`);
          sourcesUsed.push('Goodreads');
          
          // If we have a summary missing and Goodreads has a description, use it
          if (!mergedResult.summary && goodreadsData.description) {
            mergedResult.summary = goodreadsData.description;
          }
        } else {
          // Handle quota errors specially
          if (goodreadsData.error.includes('403')) {
            console.log(`[${requestId}] Google CSE API quota exceeded or authentication error`);
            mergedResult.verification = {
              status: "quota_exceeded",
              confidence: 0,
              message: "Cross-source verification temporarily unavailable - API quota exceeded",
              sources: sourcesUsed
            };
          } else {
            console.log(`[${requestId}] No Goodreads data found: ${goodreadsData.error}`);
          }
        }
        
        // Step 3b: Get general search results for additional cross-verification
        // Only if we didn't already detect a quota issue
        if (!mergedResult.verification || mergedResult.verification.status !== "quota_exceeded") {
          const searchQuery = `${mergedResult.title} ${mergedResult.author || ""} book`;
          const googleSearchResults = await googleBookSearch(searchQuery);
          
          if (googleSearchResults.length > 0) {
            console.log(`[${requestId}] Found ${googleSearchResults.length} additional references via Google Search`);
            sourcesUsed.push('Google CSE');
            
            // Analyze the verification results
            const verificationStatus = analyzeVerificationResults(mergedResult, goodreadsData, googleSearchResults);
            
            // Add verification metadata to the result
            mergedResult.verification = {
              status: verificationStatus.status,
              confidence: verificationStatus.confidence,
              sources: sourcesUsed
            };
            
            // Log the verification status
            console.log(`[${requestId}] Verification status: ${verificationStatus.status} (${verificationStatus.confidence}% confidence)`);
          } else {
            console.log(`[${requestId}] No additional search results found`);
            
            // If we have at least two sources already, we can still provide basic verification
            if (sourcesUsed.length >= 2) {
              mergedResult.verification = {
                status: "basic_verification",
                confidence: sourcesUsed.length * 20, // Simple confidence based on number of sources
                message: "Basic verification completed without additional references",
                sources: sourcesUsed
              };
            }
          }
        }
      } catch (error: any) {
        console.warn(`[${requestId}] Error during verification: ${error.message}`);
        
        // Handle quota errors specially
        if (error.message.includes('403')) {
          mergedResult.verification = {
            status: "quota_exceeded",
            confidence: 0,
            message: "Cross-source verification temporarily unavailable - API quota exceeded",
            sources: sourcesUsed
          };
        } else {
          // Other error occurred
          mergedResult.verification = {
            status: "error",
            confidence: 0,
            message: `Verification error: ${error.message}`,
            sources: sourcesUsed
          };
        }
      }
    }
  }
  
  // Log the detailed merged result for debugging
  console.log(`[${requestId}] BIBLIOGRAPHIC DATA CHECK from final ISBN lookup result:`);
  console.log(`- Title: "${mergedResult.title}"`);
  console.log(`- Subtitle: "${mergedResult.subtitle}"`);
  console.log(`- Main Author: "${mergedResult.author}"`);
  console.log(`- Statement of Responsibility: ${mergedResult.statementOfResponsibility}`);
  console.log(`- Edition: ${mergedResult.edition || 'N/A'}`);
  console.log(`- Location: ${mergedResult.location || 'N/A'}`);
  console.log(`- Publisher: ${mergedResult.publisher}`);
  console.log(`- Published Year: ${mergedResult.publishedYear}`);
  console.log(`- Page Count: ${mergedResult.pageCount}`);
  console.log(`- Dimensions: ${mergedResult.dimensions || 'N/A'}`);
  console.log(`- ISBN: ${mergedResult.isbn}`);
  console.log(`- Binding: ${mergedResult.binding || 'N/A'}`);
  console.log(`- Price: ${mergedResult.price || 'N/A'}`);
  console.log(`- Language: ${mergedResult.language}`);
  console.log(`- Genres: ${JSON.stringify(mergedResult.genres)}`);
  console.log(`- Summary: ${mergedResult.summary?.substring(0, 40)}...`);
  
  // Log a summary of the result with source information
  if (mergedResult.title) {
    console.log(`[${requestId}] Successfully processed complete book data: "${mergedResult.title}" by ${mergedResult.author}`);
    
    // Check if there's an ISBN mismatch (this can happen during format conversion)
    if (mergedResult.isbn && mergedResult.isbn !== cleanIsbn) {
      // Get the normalized versions for comparison (remove hyphens)
      const normalizedRequestIsbn = cleanIsbn.replace(/-/g, '');
      const normalizedResultIsbn = mergedResult.isbn.replace(/-/g, '');
      
      if (normalizedRequestIsbn === normalizedResultIsbn) {
        console.log(`[${requestId}] INFO: ISBNs match after normalization. Using requested format: ${cleanIsbn}`);
        mergedResult.isbn = cleanIsbn;
      } else {
        console.log(`[${requestId}] WARNING: ISBN mismatch between request (${isbn}) and final result (${mergedResult.isbn}). Using requested ISBN.`);
        mergedResult.isbn = cleanIsbn;
      }
    }
    
    // Generate field source report
    const fieldSources: Record<string, string> = {};
    for (const key in mergedResult) {
      if (key !== 'error' && key !== 'verification') {
        if (dnbResult[key] && googleResult[key]) {
          fieldSources[key] = 'Both';
        } else if (dnbResult[key]) {
          fieldSources[key] = 'DNB';
        } else if (googleResult[key]) {
          fieldSources[key] = 'Google Books';
        } else if (key === 'verification') {
          fieldSources[key] = 'Verification';
        } else {
          fieldSources[key] = 'Other';
        }
      }
    }
    console.log(`[${requestId}] Field data sources:`, fieldSources);
  } else {
    console.warn(`[${requestId}] Failed to find complete book data for ISBN: ${isbn}`);
  }
  
  return mergedResult as Partial<Book>;
}

/**
 * Analyze verification results to determine confidence level
 * Local helper function to maintain consistency with the verification service
 */
function analyzeVerificationResults(
  book: any, 
  goodreadsData: any, 
  googleSearchResults: any[]
): { status: string, confidence: number } {
  let confidenceScore = 0;
  const maxScore = 5; // Maximum possible score
  let matches = 0;
  let checks = 0;
  
  // Check if Goodreads data is available and matches
  if (!goodreadsData.error) {
    checks++;
    // Check title similarity
    if (isSimilar(book.title || "", goodreadsData.title)) {
      confidenceScore += 1;
      matches++;
    }
    
    // Check author similarity if available
    if (book.author && goodreadsData.author) {
      checks++;
      if (isSimilar(book.author, goodreadsData.author)) {
        confidenceScore += 1;
        matches++;
      }
    }
  }
  
  // Check if we have Google search results
  if (googleSearchResults.length > 0) {
    checks++;
    
    // Check how many search results match our book data
    const matchingResults = googleSearchResults.filter(result => 
      isSimilar(book.title || "", result.title)
    );
    
    if (matchingResults.length > 0) {
      confidenceScore += 1;
      matches++;
      
      // Additional confidence if multiple sources mention the book
      const uniqueSources = new Set(matchingResults.map(r => r.source));
      if (uniqueSources.size > 1) {
        confidenceScore += 1;
      }
    }
  }
  
  // Calculate final confidence percentage
  const confidence = checks > 0 
    ? Number((confidenceScore / Math.max(maxScore, checks) * 100).toFixed(1)) 
    : 0;
    
  // Determine verification status
  let status = "unverified";
  if (matches > 0) {
    status = confidence >= 70 ? "verified" : "partially_verified";
  }
  
  return { status, confidence };
}

/**
 * Simple text similarity function for verification
 */
function isSimilar(text1: string, text2: string): boolean {
  if (!text1 || !text2) return false;
  
  const normalized1 = text1.toLowerCase().replace(/[\s:,?!.-]+/g, ' ').trim();
  const normalized2 = text2.toLowerCase().replace(/[\s:,?!.-]+/g, ' ').trim();
  
  // Check for exact match or containment
  if (normalized1 === normalized2 || 
      normalized1.includes(normalized2) || 
      normalized2.includes(normalized1)) {
    return true;
  }
  
  // Check for word similarity
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');
  
  // Count matching words (only consider words with length > 3 to avoid common words)
  const commonWords = words1.filter(word => 
    word.length > 3 && words2.includes(word)
  );
  
  // Require at least 60% of words to match for longer texts
  const minLength = Math.min(words1.length, words2.length);
  const matchPercentage = commonWords.length / minLength;
  
  return matchPercentage >= 0.6;
}