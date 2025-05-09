import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Book } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export interface BookSearchParams {
  query?: string;
  title?: string;
  author?: string;
  isbn?: string;
  maxResults?: number;
}

export function useBookInfo() {
  const { toast } = useToast();

  // Search books mutation
  const searchBooksMutation = useMutation({
    mutationFn: async (params: BookSearchParams) => {
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
        `/api/books/lookup?${queryParams.toString()}`
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

  // Get book by ISBN query
  const getBookByISBN = (isbn: string) => {
    return useQuery({
      queryKey: ['/api/books/isbn', isbn],
      enabled: Boolean(isbn),
      queryFn: async () => {
        const response = await apiRequest("GET", `/api/books/isbn/${isbn}`);
        return await response.json();
      },
    });
  };

  // Find similar books mutation
  const findSimilarBooksMutation = useMutation({
    mutationFn: async (bookInfo: Partial<Book>) => {
      const response = await apiRequest("POST", "/api/books/similar", bookInfo);
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

  return {
    searchBooksMutation,
    getBookByISBN,
    findSimilarBooksMutation
  };
}