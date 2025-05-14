/**
 * Google Custom Search API service
 * This service provides book verification data from Google Custom Search API
 */

import axios from 'axios';
import { Book } from '@shared/schema';

// Logger
const apiLogger = {
  logRequest: (api: string, details: any) => console.log(`[API] ${api} Request:`, details),
  logResponse: (api: string, details: any) => console.log(`[API] ${api} Response:`, details),
  logError: (api: string, details: any) => console.error(`[API ERROR] ${api}:`, details)
};

// Environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

// Store quota error information globally
declare global {
  var googleCSE_quotaError: number | undefined;
  var googleCSE_quotaReset: number | undefined;
}

// Initialize if not set
if (global.googleCSE_quotaError === undefined) {
  global.googleCSE_quotaError = 0;
  global.googleCSE_quotaReset = 0;
}

/**
 * Search for book information from multiple sources via Google Custom Search
 * This replaces the google_book_search function from the Python implementation
 * 
 * @param query The search query (typically book title and author)
 * @returns Array of search results with source information
 */
export async function googleBookSearch(query: string): Promise<any[]> {
  // Check if we've reached API quota limits
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  if (global.googleCSE_quotaError && global.googleCSE_quotaError > oneHourAgo) {
    const resetTime = new Date(global.googleCSE_quotaReset || 0).toLocaleTimeString();
    console.log(`Skipping Google CSE API call due to recent quota error. Next attempt after ${resetTime}`);
    return [];
  }
  
  try {
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      console.log('Google CSE API keys not configured');
      return [];
    }

    const encodedQuery = encodeURIComponent(`${query} book`);
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodedQuery}&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}`;
    
    apiLogger.logRequest('Google Custom Search API', { query: encodedQuery });
    
    const response = await axios.get(url);
    const items = response.data.items || [];
    
    // Process and normalize results
    const results = items.map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      source: getDomainFromUrl(item.link),
      pagemap: item.pagemap
    }));
    
    apiLogger.logResponse('Google Custom Search API', {
      status: 'success',
      resultsCount: results.length
    });
    
    // Reset quota error tracking on success
    if (global.googleCSE_quotaError > 0) {
      global.googleCSE_quotaError = 0;
      global.googleCSE_quotaReset = 0;
      console.log('Google CSE API quota error cleared after successful request');
    }
    
    return results;
  } catch (error: any) {
    // Check for quota exceeded error (403)
    if (error.response && error.response.status === 403) {
      // Set quota exceeded flag and reset time (1 hour from now)
      global.googleCSE_quotaError = Date.now();
      global.googleCSE_quotaReset = Date.now() + 60 * 60 * 1000;
      console.log(`Google CSE API quota exceeded. Will retry after ${new Date(global.googleCSE_quotaReset).toLocaleTimeString()}`);
    }
    
    apiLogger.logError('Google Custom Search API', {
      status: 'error',
      message: error.message,
      query,
      errorCode: error.response?.status
    });
    return [];
  }
}

/**
 * Search for Goodreads book information using Google Custom Search
 * This replaces the get_goodreads_data function from the Python implementation
 * 
 * @param title The book title
 * @param author The book author
 * @returns Goodreads book data or error message
 */
export async function getGoodreadsData(title: string, author: string = ""): Promise<any> {
  // Check if we've reached API quota limits
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  if (global.googleCSE_quotaError && global.googleCSE_quotaError > oneHourAgo) {
    const resetTime = new Date(global.googleCSE_quotaReset || 0).toLocaleTimeString();
    console.log(`Skipping Goodreads search via Google CSE API due to recent quota error. Next attempt after ${resetTime}`);
    return { 
      error: `Google CSE API quota exceeded. Will retry after ${resetTime}`,
      title,
      author
    };
  }
  
  try {
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      return { 
        error: "Google Custom Search API key or engine ID not configured",
        title,
        author
      };
    }
    
    const searchQuery = encodeURIComponent(`${title} ${author} site:goodreads.com/book/show`);
    const url = `https://www.googleapis.com/customsearch/v1?q=${searchQuery}&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}`;
    
    apiLogger.logRequest('Goodreads Search', { title, author });
    
    const response = await axios.get(url);
    const items = response.data.items || [];
    
    // Find first Goodreads URL
    const goodreadsUrl = items.find((item: any) => 
      item.link && item.link.includes('goodreads.com/book/show')
    )?.link;
    
    if (!goodreadsUrl) {
      return { error: "Goodreads URL not found", title, author };
    }
    
    // We're not scraping the Goodreads page directly as in the Python version
    // Instead, returning the search result metadata which contains useful information
    const goodreadsResult = items.find((item: any) => item.link === goodreadsUrl);
    
    // Extract useful data from the search result
    const result = {
      title: goodreadsResult.title.split(' by ')[0]?.trim() || "",
      author: goodreadsResult.title.split(' by ')[1]?.trim() || "",
      description: goodreadsResult.snippet,
      rating: extractRatingFromSnippet(goodreadsResult.snippet),
      url: goodreadsUrl,
      source: "Goodreads"
    };
    
    apiLogger.logResponse('Goodreads Search', {
      status: 'success',
      goodreadsUrl
    });
    
    // Reset quota error tracking on success
    if (global.googleCSE_quotaError > 0) {
      global.googleCSE_quotaError = 0;
      global.googleCSE_quotaReset = 0;
      console.log('Google CSE API quota error cleared after successful Goodreads request');
    }
    
    return result;
  } catch (error: any) {
    apiLogger.logError('Goodreads Search', {
      status: 'error',
      message: error.message,
      title,
      author
    });
    return { error: error.message };
  }
}

/**
 * Verify book data across multiple sources
 * This replaces the verify_book_data function from the Python implementation
 * 
 * @param book Partial book data
 * @returns Verified book data with source information
 */
export async function verifyBookData(book: Partial<Book>): Promise<any> {
  // Ensure we have the minimum required data
  if (!book.title) {
    return { 
      status: "error", 
      message: "Book title is required for verification" 
    };
  }
  
  // Step 1: Book data is already provided from previous sources
  // (Google Books API + DNB in bookService.ts)
  
  // Step 2: Get Goodreads data for verification
  const goodreadsData = await getGoodreadsData(book.title, book.author || "");
  
  // Step 3: Search Google Custom Search for additional verification
  const searchQuery = `${book.title} ${book.author || ""} book`;
  const googleSearchResults = await googleBookSearch(searchQuery);
  
  // Compare data across sources to verify
  const verificationStatus = analyzeVerificationResults(book, goodreadsData, googleSearchResults);
  
  // Add verification status to the book data
  // Prepare the list of actual sources used
  const sourcesArray: string[] = [];
  if (!goodreadsData.error) sourcesArray.push('Goodreads');
  if (googleSearchResults.length > 0) sourcesArray.push('Google Search');
  
  // Add a message based on verification status
  let message: string | undefined;
  if (verificationStatus.status === 'high') {
    message = 'Multiple sources confirm this book data';
  } else if (verificationStatus.status === 'medium') {
    message = 'Some sources partially confirm this book data';
  } else if (verificationStatus.status === 'low') {
    message = 'Limited verification available for this book data';
  } else if (verificationStatus.status === 'unverified') {
    message = 'Unable to verify this book data with external sources';
  } else if (verificationStatus.status === 'error') {
    message = 'Verification service error';
  }
  
  return {
    ...book,
    verification: {
      status: verificationStatus.status,
      confidence: verificationStatus.confidence,
      message,
      sources: sourcesArray,
      // Include detailed source data for debugging if needed
      _sourcesDetail: {
        goodreads: goodreadsData.error ? null : goodreadsData,
        googleSearch: googleSearchResults.length > 0 ? googleSearchResults : null
      }
    }
  };
}

/**
 * Analyze verification results to determine confidence level
 * 
 * @param book Original book data
 * @param goodreadsData Goodreads data
 * @param googleSearchResults Google search results
 * @returns Verification status and confidence
 */
function analyzeVerificationResults(
  book: Partial<Book>, 
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
    if (isSimilarTitle(book.title || "", goodreadsData.title)) {
      confidenceScore += 1;
      matches++;
    }
    
    // Check author similarity if available
    if (book.author && goodreadsData.author) {
      checks++;
      if (isSimilarAuthor(book.author, goodreadsData.author)) {
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
      isSimilarTitle(book.title || "", result.title)
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

// Helper functions

/**
 * Extract the domain from a URL
 */
function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(1).join('.');
    }
    return hostname;
  } catch (e) {
    return url;
  }
}

/**
 * Extract rating from Goodreads snippet
 */
function extractRatingFromSnippet(snippet: string): string | null {
  const ratingMatch = snippet.match(/(\d\.\d+)\s*out of 5/i);
  return ratingMatch ? ratingMatch[1] : null;
}

/**
 * Check if two titles are similar
 */
function isSimilarTitle(title1: string, title2: string): boolean {
  if (!title1 || !title2) return false;
  
  const normalizedTitle1 = title1.toLowerCase().replace(/[\s:,?!.-]+/g, ' ').trim();
  const normalizedTitle2 = title2.toLowerCase().replace(/[\s:,?!.-]+/g, ' ').trim();
  
  // Check for exact match
  if (normalizedTitle1 === normalizedTitle2) return true;
  
  // Check if one title is contained in the other
  if (normalizedTitle1.includes(normalizedTitle2) || normalizedTitle2.includes(normalizedTitle1)) {
    return true;
  }
  
  // Check for word similarity
  const words1 = normalizedTitle1.split(' ');
  const words2 = normalizedTitle2.split(' ');
  
  // Count matching words
  const commonWords = words1.filter(word => 
    word.length > 3 && words2.includes(word)
  );
  
  // Require at least 60% of words to match for longer titles
  const minLength = Math.min(words1.length, words2.length);
  const matchPercentage = commonWords.length / minLength;
  
  return matchPercentage >= 0.6;
}

/**
 * Check if two author names are similar
 */
function isSimilarAuthor(author1: string, author2: string): boolean {
  if (!author1 || !author2) return false;
  
  const normalizedAuthor1 = author1.toLowerCase().replace(/[\s,.-]+/g, ' ').trim();
  const normalizedAuthor2 = author2.toLowerCase().replace(/[\s,.-]+/g, ' ').trim();
  
  // Check for exact match
  if (normalizedAuthor1 === normalizedAuthor2) return true;
  
  // Check for name variations (first/last name order, initials, etc.)
  const names1 = normalizedAuthor1.split(' ');
  const names2 = normalizedAuthor2.split(' ');
  
  // Check if last names match
  const lastName1 = names1[names1.length - 1];
  const lastName2 = names2[names2.length - 1];
  
  if (lastName1 === lastName2) {
    // If last names match, check if first initials match
    const firstInitial1 = names1[0][0];
    const firstInitial2 = names2[0][0];
    
    if (firstInitial1 === firstInitial2) {
      return true;
    }
  }
  
  // Check for name reversal (e.g., "John Doe" vs "Doe, John")
  const reversedAuthor1 = names1.length > 1 
    ? `${names1[names1.length - 1]} ${names1.slice(0, -1).join(' ')}` 
    : normalizedAuthor1;
  
  const reversedAuthor2 = names2.length > 1
    ? `${names2[names2.length - 1]} ${names2.slice(0, -1).join(' ')}`
    : normalizedAuthor2;
    
  if (reversedAuthor1 === normalizedAuthor2 || normalizedAuthor1 === reversedAuthor2) {
    return true;
  }
  
  return false;
}