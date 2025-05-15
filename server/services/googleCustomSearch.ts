/**
 * Google Custom Search service for book verification
 * 
 * This service provides Goodreads and other book metadata lookups
 * using Google Custom Search API, following the Python implementation
 */

import axios from "axios";
import { apiLogger } from "../utils/logger";

/**
 * Search Goodreads for a book via Google Custom Search
 * 
 * This replicates the get_goodreads_data function from Python
 * 
 * @param title Book title to search for
 * @param author Book author (optional)
 * @param apiKey Google CSE API key (optional)
 * @param cseId Google Custom Search Engine ID (optional)
 * @returns Book data from Goodreads or error
 */
export async function searchGoodreads(
  title: string, 
  author: string = "", 
  apiKey?: string,
  cseId?: string
): Promise<any> {
  if (!title) {
    console.log(`[API] Goodreads search skipped: No title provided`);
    return { error: "No title provided for Goodreads search" };
  }

  try {
    // Log the request parameters
    console.log(`[API] Request to Goodreads Search: ${JSON.stringify({
      title,
      author
    })}`);

    // Only use provided keys, no fallback to environment variables
    const googleCSEKey = apiKey;
    const googleCSEId = cseId;

    // Check if we have the required credentials
    if (!googleCSEKey || !googleCSEId) {
      console.log(`[API] Goodreads search skipped: Missing Google CSE credentials`);
      return { 
        error: "Missing Google CSE credentials"
      };
    }

    // Prepare the search query (following Python implementation)
    const query = encodeURIComponent(`${title} ${author} site:goodreads.com`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleCSEKey}&cx=${googleCSEId}&q=${query}`;

    // Fetch data from Goodreads via Google CSE
    const response = await axios.get(url);
    const data = response.data;

    // Process and format the response
    if (data.items && data.items.length > 0) {
      // Extract the first result (most relevant)
      const firstResult = data.items[0];
      
      // Parse book details from search results
      return {
        title: firstResult.title.split(' by ')[0].trim() || title,
        author: (firstResult.title.includes(' by ') ? firstResult.title.split(' by ')[1].trim() : author),
        url: firstResult.link,
        snippet: firstResult.snippet,
        source: "Goodreads",
        rating: 4.2, // Placeholder, would extract from snippet in a real implementation
        reviews: 158, // Placeholder, would extract from snippet in a real implementation
      };
    } else {
      return { error: "No Goodreads results found", title, author };
    }
  } catch (error: any) {
    // Log the error
    console.log(`[API] Error in Goodreads search: ${error.message}`);
    apiLogger.logError("Goodreads", {
      status: "error",
      message: error.message,
      title,
      author
    });

    // Return an error response
    return { 
      error: `Goodreads search failed: ${error.message}`
    };
  }
}

/**
 * Search for books via Google using a general query
 * 
 * This replicates the google_book_search function from Python
 * 
 * @param query Search query text
 * @param apiKey Google CSE API key (optional)
 * @param cseId Google Custom Search Engine ID (optional)
 * @returns Array of book search results
 */
export async function searchGoogleBooks(
  query: string,
  apiKey?: string,
  cseId?: string
): Promise<any[]> {
  if (!query) {
    console.log(`[API] Google CSE Books search skipped: No query provided`);
    return [];
  }

  try {
    // Log the request
    console.log(`[API] Request to Google CSE Books: ${JSON.stringify({
      query
    })}`);

    // Only use provided keys, no fallback to environment variables
    const googleCSEKey = apiKey;
    const googleCSEId = cseId;

    // Check if we have the required credentials
    if (!googleCSEKey || !googleCSEId) {
      console.log(`[API] Google CSE Books search skipped: Missing Google CSE credentials`);
      // Return an empty array if credentials are missing
      return [];
    }

    const encodedQuery = encodeURIComponent(`${query} book review OR author OR isbn`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleCSEKey}&cx=${googleCSEId}&q=${encodedQuery}`;

    // Fetch data from Google CSE
    const response = await axios.get(url);
    const data = response.data;

    // Extract and format search results
    if (data.items && data.items.length > 0) {
      return data.items.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        source: "Google Custom Search"
      }));
    } else {
      console.log(`[API] Google CSE Books: No results found for query "${query}"`);
      return [];
    }
  } catch (error: any) {
    // Log the error
    console.log(`[API] Error in Google Books search: ${error.message}`);
    apiLogger.logError("GoogleCSE", {
      status: "error",
      message: error.message,
      query
    });

    // Return an empty array if there's an error
    return [];
  }
}