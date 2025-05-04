import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { useNavigationGuard } from '@/hooks/use-navigation-guard';
import { Book } from '@shared/schema';
import AnalysisForm from '@/components/book/AnalysisForm';
import AnalysisOptions from '@/components/book/AnalysisOptions';
import BookResult from '@/components/book/BookResult';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Analyze() {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // Get the book analysis hook functions
  const { 
    analysisMutation, 
    saveBookMutation, 
    analysisSteps, 
    getCurrentData,
    clearAnalysisData,
    restoreSavedAnalysis 
  } = useBookAnalysis();
  
  // State to track the current book data 
  const [bookData, setBookData] = useState<Partial<Book>>({});
  
  // Analysis options state
  const [options, setOptions] = useState({
    summary: true,
    genres: true,
    themes: true,
    readingLevel: true,
    catalogEntry: true,
  });
  
  // Function to check if there is unsaved data
  const hasUnsavedData = useCallback(() => {
    // If there's analysis data but it hasn't been saved
    return Object.keys(bookData).length > 0 && !bookData.id;
  }, [bookData]);
  
  // Set up navigation guard
  const { 
    showNavigationConfirmation,
    confirmNavigation,
    cancelNavigation,
    guardNavigation
  } = useNavigationGuard(() => {
    // Clear data before navigating away
    clearAnalysisData();
  });
  
  // Clear previous data when the component mounts
  useEffect(() => {
    // Clear any previous analysis data to ensure a fresh start
    clearAnalysisData();
    setBookData({});
    
    // Log this action
    console.log("Analyze page mounted: cleared previous analysis data");
  }, [clearAnalysisData]);
  
  // Effect to sync bookData with the current state (from the mutation only)
  useEffect(() => {
    if (analysisMutation.data) {
      console.log("Setting book data from new analysis result");
      setBookData(analysisMutation.data);
    }
  }, [analysisMutation.data]);
  
  // Set up the navigation protection effect
  useEffect(() => {
    // Prepare a cleanup function to handle browser navigation events
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedData()) {
        // Standard way to show a confirmation dialog when closing/navigating away
        const message = "You have unsaved changes. Are you sure you want to leave?";
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };
    
    // Add the event listener
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedData]);
  
  // Handle option change
  const handleOptionChange = (id: string, checked: boolean) => {
    setOptions(prev => ({
      ...prev,
      [id]: checked
    }));
  };
  
  // Handle form submission
  const handleSubmit = (formData: FormData) => {
    // Always clear any existing data first
    clearAnalysisData();
    setBookData({});
    
    // Log what data we're submitting for debugging
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const hasImage = formData.has('coverImage');
    
    console.log("Submitting analysis with fresh form data:", {
      title: title || null,
      author: author || null,
      hasImage
    });
    
    // Add a flag to explicitly mark this as a manual submission
    formData.append('isManualSubmission', 'true');
    
    // Add a unique timestamp to force a fresh analysis
    formData.append('forceNewAnalysis', Date.now().toString());
    
    // Submit the form data for analysis
    analysisMutation.mutate({ formData, options });
  };
  
  // Handle save to archive
  const handleSave = (book: Partial<Book>) => {
    saveBookMutation.mutate(book);
    
    // After saving, clear the persisted data too
    clearAnalysisData();
    setBookData({});
  };
  
  // Handle clearing analysis
  const handleClearAnalysis = () => {
    clearAnalysisData();
    setBookData({});
    
    toast({
      title: "Analysis Cleared",
      description: "Ready for a new book analysis",
    });
  };
  
  // Custom navigation handler that can be passed to components like the Sidebar
  const handleNavigation = useCallback((path: string) => {
    guardNavigation(path, hasUnsavedData());
  }, [guardNavigation, hasUnsavedData]);
  
  // Create a reference to this component's instance for the AppLayout to access
  useEffect(() => {
    // Add guard navigation function to the analyze-page element
    const analyzeElement = document.getElementById('analyze-page');
    if (analyzeElement) {
      (analyzeElement as any).__guardNavigation = handleNavigation;
    }
    
    return () => {
      // Clean up the reference when component unmounts
      const analyzeElement = document.getElementById('analyze-page');
      if (analyzeElement) {
        delete (analyzeElement as any).__guardNavigation;
      }
    };
  }, [handleNavigation]);

  return (
    <div id="analyze-page" className="max-w-7xl mx-auto pb-12">
      {/* Navigation Confirmation Dialog */}
      <AlertDialog 
        open={showNavigationConfirmation} 
        onOpenChange={() => cancelNavigation()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsaved Analysis
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved book analysis. If you leave now, all your analysis data will be lost.
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>
              Stay on This Page
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmNavigation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Analysis & Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Page Title */}
      <div className="mb-8 border-b border-neutral-200 pb-3 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-dark">
            {t('bookAnalysis')}
          </h1>
          <p className="text-neutral-600 mt-1">AI-powered insights and classification</p>
        </div>
        
        {/* Clear Analysis Button */}
        {Object.keys(bookData).length > 0 && (
          <Button
            variant="outline"
            onClick={handleClearAnalysis}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Analysis
          </Button>
        )}
      </div>
      
      {/* Main Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="md:grid md:grid-cols-6 md:gap-8">
          {/* Left Column - Upload & Analysis Options */}
          <div className="md:col-span-2 space-y-8">
            {/* Upload Form */}
            <AnalysisForm 
              onSubmit={handleSubmit} 
              isLoading={analysisMutation.isPending}
            />
            
            {/* Analysis Options */}
            <AnalysisOptions 
              options={options}
              onOptionChange={handleOptionChange}
            />
          </div>
          
          {/* Right Column - Results */}
          <div className="mt-8 md:mt-0 md:col-span-4">
            <BookResult 
              book={bookData}
              isLoading={analysisMutation.isPending}
              onSave={handleSave}
              loadingSteps={analysisSteps}
            />
          </div>
        </div>
      </div>
    </div>
  );
}