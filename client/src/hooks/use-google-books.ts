import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Book } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export interface GoogleBookSearchParams {
  query?: string;
  title?: string;
  author?: string;
  isbn?: string;
  maxResults?: number;
}

export function useGoogleBooks() {
  const { toast } = useToast();

  // Search books mutation
  const searchMutation = useMutation({
    mutationFn: async (params: GoogleBookSearchParams) => {
      // Build query string
      const queryParams = new URLSearchParams();
      if (params.query) queryParams.append("q", params.query);
      if (params.title) queryParams.append("title", params.title);
      if (params.author) queryParams.append("author", params.author);
      if (params.isbn) queryParams.append("isbn", params.isbn);
      if (params.maxResults) queryParams.append("maxResults", params.maxResults.toString());

      // Make API request
      const response = await apiRequest(
        "GET", 
        `/api/googlebooks/search?${queryParams.toString()}`
      );
      return await response.json();
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Search by ISBN mutation
  const searchByISBNMutation = useMutation({
    mutationFn: async (isbn: string) => {
      const response = await apiRequest("GET", `/api/googlebooks/isbn/${isbn}`);
      return await response.json();
    },
    onError: (error) => {
      toast({
        title: "ISBN Search Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Find similar books mutation
  const similarBooksMutation = useMutation({
    mutationFn: async (bookInfo: Partial<Book>) => {
      const response = await apiRequest("POST", "/api/googlebooks/similar", bookInfo);
      return await response.json();
    },
    onError: (error) => {
      toast({
        title: "Failed to Find Similar Books",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Original functions for backward compatibility
  const searchBooksMutation = searchMutation;
  const findSimilarBooksMutation = similarBooksMutation;
  const getBookByISBN = (isbn: string) => {
    return useQuery({
      queryKey: ['/api/googlebooks/isbn', isbn],
      enabled: Boolean(isbn),
      queryFn: async () => {
        const response = await apiRequest("GET", `/api/googlebooks/isbn/${isbn}`);
        return await response.json();
      },
    });
  };

  return {
    searchMutation,
    searchByISBNMutation,
    similarBooksMutation,
    // Keep original exports for compatibility
    searchBooksMutation,
    getBookByISBN,
    findSimilarBooksMutation
  };
}