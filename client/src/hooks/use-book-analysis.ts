import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BookAnalysisRequest, Book } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useBookAnalysis() {
  const [analysisSteps, setAnalysisSteps] = useState({
    metadata: { status: "waiting", progress: 0 },
    summary: { status: "waiting", progress: 0 },
    genres: { status: "waiting", progress: 0 },
    themes: { status: "waiting", progress: 0 },
    catalogEntry: { status: "waiting", progress: 0 },
  });
  
  const { toast } = useToast();
  
  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: async (data: {
      formData: FormData,
      options: {
        summary: boolean;
        genres: boolean;
        themes: boolean;
        readingLevel: boolean;
        catalogEntry: boolean;
      }
    }) => {
      // Reset previous analysis and update status for metadata
      setAnalysisSteps({
        metadata: { status: "in-progress", progress: 0 },
        summary: { status: "waiting", progress: 0 },
        genres: { status: "waiting", progress: 0 },
        themes: { status: "waiting", progress: 0 },
        catalogEntry: { status: "waiting", progress: 0 },
      });
      
      // Add options to form data
      data.formData.append("options", JSON.stringify(data.options));
      
      // Check if we have a title and author as a debugging log
      const hasTitle = data.formData.get('title');
      const hasAuthor = data.formData.get('author');
      const hasISBN = data.formData.get('isbn');
      const isManual = data.formData.get('isManualSubmission') === 'true';
      const isISBNSearch = data.formData.get('isISBNOnlySearch') === 'true';
      const isbnPriority = data.formData.get('isbnPriority') === 'true';
      
      console.log("Analyzing book with data:", {
        hasTitle: !!hasTitle,
        hasAuthor: !!hasAuthor,
        hasISBN: !!hasISBN,
        isManualSubmission: isManual,
        isISBNOnlySearch: isISBNSearch,
        isbnPriority,
        hasCoverImage: data.formData.has('coverImage'),
        requestTimestamp: data.formData.get('requestTimestamp')
      });
      
      // Start request - first update metadata progress
      updateStepProgress("metadata", 50);
      
      // Make API request
      const response = await fetch("/api/books/analyze", {
        method: "POST",
        body: data.formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      
      // Metadata completed
      updateStepProgress("metadata", 100);
      setAnalysisSteps(prev => ({
        ...prev,
        metadata: { status: "complete", progress: 100 }
      }));
      
      // Start other steps in sequence based on options
      if (data.options.summary) {
        updateStepProgress("summary", 50);
      }
      if (data.options.genres) {
        updateStepProgress("genres", 20);
      }
      if (data.options.themes) {
        updateStepProgress("themes", 20);
      }
      if (data.options.catalogEntry) {
        updateStepProgress("catalogEntry", 20);
      }
      
      // Get the results
      const result = await response.json();
      
      // Mark all steps as complete
      setAnalysisSteps({
        metadata: { status: "complete", progress: 100 },
        summary: { status: data.options.summary ? "complete" : "waiting", progress: data.options.summary ? 100 : 0 },
        genres: { status: data.options.genres ? "complete" : "waiting", progress: data.options.genres ? 100 : 0 },
        themes: { status: data.options.themes ? "complete" : "waiting", progress: data.options.themes ? 100 : 0 },
        catalogEntry: { status: data.options.catalogEntry ? "complete" : "waiting", progress: data.options.catalogEntry ? 100 : 0 },
      });
      
      return result;
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
      
      // Reset all steps
      setAnalysisSteps({
        metadata: { status: "waiting", progress: 0 },
        summary: { status: "waiting", progress: 0 },
        genres: { status: "waiting", progress: 0 },
        themes: { status: "waiting", progress: 0 },
        catalogEntry: { status: "waiting", progress: 0 },
      });
    }
  });
  
  // Save book mutation
  const saveBookMutation = useMutation({
    mutationFn: async (book: Partial<Book>) => {
      const response = await apiRequest("POST", "/api/books", book);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Book Saved",
        description: "The book has been saved to your archive.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Utility to update step progress
  function updateStepProgress(step: keyof typeof analysisSteps, progress: number) {
    setAnalysisSteps(prev => ({
      ...prev,
      [step]: { 
        status: progress < 100 ? "in-progress" : "complete", 
        progress 
      }
    }));
  }
  
  return {
    analysisMutation,
    saveBookMutation,
    analysisSteps,
  };
}
