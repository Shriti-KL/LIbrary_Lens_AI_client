// This module is deprecated - imported only for backwards compatibility
// Please use use-book-info.ts for new implementations

import { useBookInfo, BookSearchParams } from "./use-book-info";
import { Book } from "@shared/schema";

// Keep the old interface for backwards compatibility
export interface GoogleBookSearchParams extends BookSearchParams {}

// Provide the same interface but using the new implementation behind the scenes
export function useGoogleBooks() {
  // Use the new hook internally
  const { 
    searchBooksMutation,
    getBookByISBN,
    findSimilarBooksMutation 
  } = useBookInfo();

  // Return the same API so existing code works
  return {
    searchBooksMutation,
    getBookByISBN,
    findSimilarBooksMutation
  };
}