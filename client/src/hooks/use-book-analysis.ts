import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Book } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

// Storage keys
const STORAGE_KEY_RESULT = 'book_analysis_result';
const STORAGE_KEY_TIMESTAMP = 'book_analysis_timestamp';

export function useBookAnalysis() {
  const { toast } = useToast();

  // Initialize state for analysis steps
  const [analysisSteps, setAnalysisSteps] = useState({
    metadata: { status: "waiting", progress: 0 },
    summary: { status: "waiting", progress: 0 },
    genres: { status: "waiting", progress: 0 },
    themes: { status: "waiting", progress: 0 },
    catalogEntry: { status: "waiting", progress: 0 },
  });

  // Storage functions
  const saveAnalysisToStorage = (data: any) => {
    try {
      if (data) {
        localStorage.setItem(STORAGE_KEY_RESULT, JSON.stringify(data));
        localStorage.setItem(STORAGE_KEY_TIMESTAMP, Date.now().toString());
      }
    } catch (err) {
      console.error('Error saving analysis to localStorage:', err);
    }
  };

  const getAnalysisFromStorage = () => {
    try {
      const savedAnalysis = localStorage.getItem(STORAGE_KEY_RESULT);
      return savedAnalysis ? JSON.parse(savedAnalysis) : null;
    } catch (err) {
      console.error('Error retrieving analysis from localStorage:', err);
      return null;
    }
  };

  const clearAnalysisFromStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_RESULT);
      localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
    } catch (err) {
      console.error('Error clearing analysis from localStorage:', err);
    }
  };

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
      console.log("Analyzing book with data:", {
        hasTitle: !!hasTitle,
        hasAuthor: !!hasAuthor,
        hasCoverImage: data.formData.has('coverImage')
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
      
      // Save result to localStorage for persistence between page navigations
      saveAnalysisToStorage(result);
      
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
      
      // Clear the stored analysis result since it's now saved in the database
      clearAnalysisFromStorage();
      
      // Invalidate queries to update the book list immediately
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      queryClient.invalidateQueries({ queryKey: ['/api/books/recent'] });
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
  
  // State to track saved analysis data
  const [savedAnalysisData, setSavedAnalysisData] = useState<any>(null);
  
  // Load saved data on first render - no longer automatically restores on component mount
  // Instead, we expose a restoreSavedAnalysis method that can be called explicitly
  const restoreSavedAnalysis = () => {
    const savedData = getAnalysisFromStorage();
    if (savedData) {
      // Initialize with data from the previous session
      console.log("Restoring previous book analysis data");
      setSavedAnalysisData(savedData);
      
      // Set all steps to complete
      setAnalysisSteps({
        metadata: { status: "complete", progress: 100 },
        summary: { status: "complete", progress: 100 },
        genres: { status: "complete", progress: 100 },
        themes: { status: "complete", progress: 100 },
        catalogEntry: { status: "complete", progress: 100 },
      });
      return true;
    }
    return false;
  };
  
  // Function to get the current analysis data (either from mutation or storage)
  const getCurrentAnalysisData = () => {
    return analysisMutation.data || savedAnalysisData;
  };
  
  // Function to clear both local storage and state
  const clearAnalysisState = () => {
    clearAnalysisFromStorage();
    setSavedAnalysisData(null);
  };
  
  return {
    analysisMutation,
    saveBookMutation,
    analysisSteps,
    clearAnalysisData: clearAnalysisState,
    getCurrentData: getCurrentAnalysisData,
    restoreSavedAnalysis,
  };
}