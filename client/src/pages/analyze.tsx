import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { Book } from '@shared/schema';
import AnalysisForm from '@/components/book/AnalysisForm';
import AnalysisOptions from '@/components/book/AnalysisOptions';
import BookResult from '@/components/book/BookResult';
import { useLocation } from 'wouter';
import { useNavigationGuard } from '@/lib/navigation-guard';
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
  
  // State to show language change confirmation dialog
  const [showLanguageChangeConfirm, setShowLanguageChangeConfirm] = useState(false);
  const [previousLanguage, setPreviousLanguage] = useState<string | null>(null);
  
  // Effect to handle component mount
  useEffect(() => {
    // Attempt to restore saved analysis first
    const success = restoreSavedAnalysis();
    
    if (success) {
      // If we successfully restored data, grab it and set to state
      const savedData = getCurrentData();
      setBookData(savedData || {});
      
      // Check if the saved analysis was in a different language
      if (savedData?.analyzerLanguage && savedData.analyzerLanguage !== language) {
        console.log(`Detected language mismatch: UI language ${language}, book analyzed in ${savedData.analyzerLanguage}`);
        setPreviousLanguage(savedData.analyzerLanguage);
        setShowLanguageChangeConfirm(true);
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
  
  // Effect to monitor language changes and potentially show reanalysis prompt
  useEffect(() => {
    // Skip on first render
    if (!bookData || Object.keys(bookData).length === 0) {
      return;
    }
    
    // If we have book data and language has changed, show the dialog
    if (bookData.language && bookData.language !== language) {
      console.log(`UI language changed to ${language}, book was analyzed in ${bookData.language}`);
      setPreviousLanguage(bookData.language);
      setShowLanguageChangeConfirm(true);
    }
  }, [language, bookData]);
  
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
  
  // Function to regenerate analysis with current language
  const regenerateWithCurrentLanguage = () => {
    // First get the current book data
    const currentData = getCurrentData();
    if (!currentData || !currentData.title || !currentData.author) {
      return;
    }
    
    // Create a new FormData object and populate it with current data
    const formData = new FormData();
    formData.append('title', currentData.title);
    formData.append('author', currentData.author);
    if (currentData.isbn) formData.append('isbn', currentData.isbn);
    
    // Add a flag to force regeneration
    formData.append('forceNewAnalysis', Date.now().toString());
    formData.append('language', language);
    
    console.log(`Regenerating analysis in language: ${language}`);
    
    // Submit for analysis
    analysisMutation.mutate({ formData, options });
    
    // Close dialog
    setShowLanguageChangeConfirm(false);
  };
  
  return (
    <>
      {/* Language Change Confirmation Dialog */}
      <AlertDialog open={showLanguageChangeConfirm} onOpenChange={setShowLanguageChangeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              {language === 'de' ? 'Sprache geändert' : 'Language Changed'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'de' 
                ? `Die Analyse wurde zuvor auf ${previousLanguage === 'de' ? 'Deutsch' : 'Englisch'} durchgeführt. Möchten Sie die Analyse auf Deutsch neu generieren?`
                : `The analysis was previously performed in ${previousLanguage === 'de' ? 'German' : 'English'}. Would you like to regenerate the analysis in English?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLanguageChangeConfirm(false)}>
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={regenerateWithCurrentLanguage}
              className="bg-primary hover:bg-primary-dark"
            >
              {language === 'de' ? 'Neu generieren' : 'Regenerate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
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