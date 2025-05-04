import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { Book } from '@shared/schema';
import AnalysisForm from '@/components/book/AnalysisForm';
import AnalysisOptions from '@/components/book/AnalysisOptions';
import BookResult from '@/components/book/BookResult';

export default function Analyze() {
  const { t } = useLanguage();
  const { 
    analysisMutation, 
    saveBookMutation, 
    analysisSteps, 
    getCurrentData,
    clearAnalysisData 
  } = useBookAnalysis();
  
  // State to track the current book data (from mutation or localStorage)
  const [bookData, setBookData] = useState<Partial<Book>>({});
  
  // Analysis options state
  const [options, setOptions] = useState({
    summary: true,
    genres: true,
    themes: true,
    readingLevel: true,
    catalogEntry: true,
  });
  
  // Handle option change
  const handleOptionChange = (id: string, checked: boolean) => {
    setOptions(prev => ({
      ...prev,
      [id]: checked
    }));
  };
  
  // Handle form submission
  const handleSubmit = (formData: FormData) => {
    // Log what data we're submitting for debugging
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const hasImage = formData.has('coverImage');
    
    console.log("Submitting analysis with form data:", {
      title: title || null,
      author: author || null,
      hasImage
    });
    
    // Add a flag to explicitly mark this as a manual submission
    formData.append('isManualSubmission', 'true');
    
    // Reset the mutation data if we already have results
    if (analysisMutation.data) {
      // Force a reset by adding a unique timestamp
      formData.append('forceNewAnalysis', Date.now().toString());
    }
    
    analysisMutation.mutate({ formData, options });
  };
  
  // Effect to sync bookData with the current state (either from mutation or localStorage)
  useEffect(() => {
    // Get data from either the active mutation or localStorage
    const currentData = getCurrentData();
    if (currentData) {
      setBookData(currentData);
    }
  }, [analysisMutation.data, getCurrentData]);
  
  // Handle save to archive
  const handleSave = (book: Partial<Book>) => {
    saveBookMutation.mutate(book);
    
    // After saving, clear the persisted data too
    clearAnalysisData();
  };
  
  return (
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
  );
}