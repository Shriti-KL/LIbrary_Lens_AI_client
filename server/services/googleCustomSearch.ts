/**
 * Google Custom Search service for book verification
 * 
 * This service provides Goodreads and other book metadata lookups
 * using Google Custom Search API, following the Python implementation
 */

import axios from 'axios';
import { apiLogger } from '../utils/logger';

/**
 * Search Goodreads for a book via Google Custom Search
 * 
 * This replicates the get_goodreads_data function from Python
 * 
 * @param title Book title to search for
 * @param author Book author (optional)
 * @returns Book data from Goodreads or error
 */
export async function searchGoodreads(title: string, author: string = ""): Promise<any> {
  try {
    // Log API request
    apiLogger.logRequest("Goodreads Search", { title, author });
    
    // Check for Google CSE credentials
    const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const googleCseId = process.env.GOOGLE_CSE_ID;
    
    if (!googleApiKey || !googleCseId) {
      return {
        error: "Google Custom Search API credentials not configured"
      };
    }
    
    // Build search query in the same way as Python implementation
    // Search Goodreads via Google (avoids Goodreads API limitations)
    const searchQuery = encodeURIComponent(`${title} ${author} site:goodreads.com/book/show`);
    const googleUrl = `https://www.googleapis.com/customsearch/v1?q=${searchQuery}&key=${googleApiKey}&cx=${googleCseId}`;
    
    // Make the request
    const response = await axios.get(googleUrl);
    const data = response.data;
    
    // Check if we got any results
    if (!data.items || data.items.length === 0) {
      apiLogger.logError("Goodreads Search", {
        status: "error",
        message: "No search results found",
        title,
        author
      });
      return { error: "No Goodreads search results found" };
    }
    
    // Get the first Goodreads URL from the results
    const goodreadsUrl = data.items.find((item: any) => 
      item.link && item.link.includes('goodreads.com/book/show')
    )?.link;
    
    if (!goodreadsUrl) {
      apiLogger.logError("Goodreads Search", {
        status: "error",
        message: "No Goodreads URL found in search results",
        title,
        author
      });
      return { error: "Goodreads URL not found" };
    }
    
    // Extract relevant data from the search results
    // Since we can't scrape Goodreads directly, we'll use the search snippet
    const firstResult = data.items[0];
    
    const result = {
      title: firstResult.title?.split(' by ')[0] || title,
      author: firstResult.title?.split(' by ')[1] || author,
      rating: firstResult.pagemap?.aggregaterating?.[0]?.ratingvalue || 
              firstResult.pagemap?.book?.[0]?.averagerating || "Unknown",
      published: firstResult.pagemap?.book?.[0]?.datepublished || "Unknown",
      genres: Array.isArray(firstResult.pagemap?.book?.[0]?.genre) 
        ? firstResult.pagemap?.book?.[0]?.genre 
        : firstResult.pagemap?.book?.[0]?.genre 
          ? [firstResult.pagemap?.book?.[0]?.genre] 
          : [],
      source: "Goodreads",
      url: goodreadsUrl
    };
    
    // Log successful response
    apiLogger.logResponse("Goodreads Search", {
      status: "success",
      fields: Object.keys(result),
      title,
      author
    });
    
    return result;
  } catch (error: any) {
    console.error("Error in Goodreads search:", error.message);
    
    // Log error response with details
    apiLogger.logError("Goodreads Search", {
      status: "error",
      message: error.message || "Unknown error",
      title,
      author
    });
    
    return {
      error: `Goodreads search failed: ${error.message}`,
      title,
      author
    };
  }
}

/**
 * Search for books via Google using a general query
 * 
 * This replicates the google_book_search function from Python
 * 
 * @param query Search query text
 * @returns Array of book search results
 */
export async function searchGoogleBooks(query: string): Promise<any[]> {
  try {
    // Log API request
    apiLogger.logRequest("Google CSE Books", { query });
    
    // Check for Google CSE credentials
    const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const googleCseId = process.env.GOOGLE_CSE_ID;
    
    if (!googleApiKey || !googleCseId) {
      console.error("Google Custom Search API credentials not configured");
      return [];
    }
    
    // Build URL with query + intitle:book to focus on book results
    const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}+intitle:book&key=${googleApiKey}&cx=${googleCseId}`;
    
    // Make the request
    const response = await axios.get(searchUrl);
    const data = response.data;
    
    // Check if we got any results
    if (!data.items || data.items.length === 0) {
      apiLogger.logResponse("Google CSE Books", {
        status: "success",
        itemCount: 0,
        query
      });
      return [];
    }
    
    // Process results to match Python implementation
    const results = data.items.slice(0, 3).map((item: any) => ({
      title: item.title || "",
      source: "Google",
      metadata: item.pagemap?.book?.[0] || {}
    }));
    
    // Log successful response
    apiLogger.logResponse("Google CSE Books", {
      status: "success",
      itemCount: results.length,
      query
    });
    
    return results;
  } catch (error: any) {
    console.error("Error in Google Books search:", error.message);
    
    // Log error response
    apiLogger.logError("Google CSE Books", {
      status: "error",
      message: error.message,
      query
    });
    
    return [];
  }
}