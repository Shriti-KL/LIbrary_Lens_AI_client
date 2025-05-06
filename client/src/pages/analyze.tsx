import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Book } from '@shared/schema';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { useLanguage } from '@/hooks/use-language';
import { useNavigationGuard } from '@/lib/navigation-guard';
import AnalysisForm from '@/components/book/AnalysisForm';
import AnalysisOptions from '@/components/book/AnalysisOptions';
import BookResult from '@/components/book/BookResult';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle } from 'lucide-react';

export default function Analyze() {
  const { t, language } = useLanguage();
  const [location, navigate] = useLocation();
  const { registerGuard, unregisterGuard } = useNavigationGuard();
  
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
  
  // State for navigation confirmation dialog
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  
  // Analysis options state
  const [options, setOptions] = useState({
    summary: true,
    genres: true,
    themes: true,
    readingLevel: true,
    catalogEntry: true,
  });
  
  // Effect to handle component mount
  useEffect(() => {
    // Attempt to restore saved analysis first
    const success = restoreSavedAnalysis();
    
    if (success) {
      // If we successfully restored data, grab it and set to state
      const savedData = getCurrentData();
      setBookData(savedData || {});
      
      // If the language has changed, automatically trigger a reanalysis
      if (savedData?.language && savedData.language !== language) {
        console.log(`Language change detected: UI language ${language}, book analyzed in ${savedData.language}`);
        console.log("Auto-regenerating content to match UI language...");
        
        // Set a short timeout to allow the component to fully initialize
        setTimeout(() => {
          if (savedData.title && (savedData.author || savedData.isbn)) {
            // Create a new FormData object and populate it with current data
            const formData = new FormData();
            formData.append('title', savedData.title);
            if (savedData.author) formData.append('author', savedData.author);
            if (savedData.isbn) formData.append('isbn', savedData.isbn);
            
            // Add necessary flags
            formData.append('forceNewAnalysis', Date.now().toString());
            formData.append('language', language);
            formData.append('autoTranslate', 'true');
            
            // Submit for new analysis in current language
            analysisMutation.mutate({ formData, options });
          }
        }, 100);
      }
    } else {
      // No saved data, ensure we're starting fresh
      clearAnalysisData();
      setBookData({});
      console.log("Analyze page mounted: no saved data found, starting fresh");
    }
  }, []);
  
  // Effect to sync bookData with the current state (from the mutation only)
  useEffect(() => {
    if (analysisMutation.data) {
      console.log("Setting book data from new analysis result");
      setBookData(analysisMutation.data);
    }
  }, [analysisMutation.data]);
  
  // Track previous language to avoid infinite loops
  const [previousUILanguage, setPreviousUILanguage] = useState(language);
  
  // Effect to monitor language changes and trigger reanalysis once
  useEffect(() => {
    // Skip if language hasn't changed or if we don't have book data
    if (language === previousUILanguage || !bookData || Object.keys(bookData).length === 0) {
      return;
    }
    
    console.log(`UI language changed from ${previousUILanguage} to ${language}, translating content`);
    setPreviousUILanguage(language); // Update previous language to avoid multiple triggers
    
    // We have book data and detected a real language change, not a book data update
    if (bookData.title && (bookData.author || bookData.isbn)) {
      // Create a form with minimal data needed for the reanalysis
      const formData = new FormData();
      formData.append('title', bookData.title);
      if (bookData.author) formData.append('author', bookData.author);
      if (bookData.isbn) formData.append('isbn', bookData.isbn);
      
      // Add necessary flags
      formData.append('forceNewAnalysis', Date.now().toString());
      formData.append('language', language);
      formData.append('autoTranslate', 'true');
      
      console.log(`Submitting translation request for "${bookData.title}" to ${language}`);
      
      // Submit for translation
      analysisMutation.mutate({ formData, options });
    }
  }, [language]);
  
  // Before unload handler for browser navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if there's unsaved analysis data
      if (Object.keys(bookData).length > 0 && !saveBookMutation.isSuccess) {
        // Standard browser dialog
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [bookData, saveBookMutation.isSuccess]);
  
  // Register navigation guard
  useEffect(() => {
    // Function to check if navigation should be prevented
    const navigationGuard = (to: string) => {
      if (Object.keys(bookData).length > 0 && !saveBookMutation.isSuccess) {
        // Show the confirmation dialog
        setShowLeaveConfirm(true);
        setPendingNavigation(to);
        return false; // Prevent navigation
      }
      return true; // Allow navigation
    };
    
    // Register the guard
    registerGuard('analyze-page', navigationGuard);
    
    // Clean up function to unregister the guard
    return () => unregisterGuard('analyze-page');
  }, [bookData, saveBookMutation.isSuccess, registerGuard, unregisterGuard]);
  
  // Confirm navigation handler
  const confirmNavigation = () => {
    if (pendingNavigation) {
      clearAnalysisData();
      navigate(pendingNavigation);
    }
    setShowLeaveConfirm(false);
    setPendingNavigation(null);
  };
  
  // Cancel navigation handler
  const cancelNavigation = () => {
    setShowLeaveConfirm(false);
    setPendingNavigation(null);
  };
  
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
    
    // Add current language to ensure content is generated in the correct language
    formData.append('language', language);
    
    console.log(`Submitting analysis in language: ${language}`);
    
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
  
  return (
    <>
      {/* Navigation Confirmation Dialog */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Unsaved Analysis
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your current book analysis hasn't been saved to the archive. 
              Leaving this page will discard all analysis results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>
              Stay on Page
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmNavigation}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Discard and Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="max-w-7xl mx-auto pb-12">
        {/* Page Title */}
        <div className="mb-8 border-b border-neutral-200 pb-3">
          <h1 className="text-2xl font-serif font-semibold text-primary-dark">
            {t('bookAnalysis')}
          </h1>
          <p className="text-neutral-600 mt-1">AI-powered insights and classification</p>
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
    </>
  );
}