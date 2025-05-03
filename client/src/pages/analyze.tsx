import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { Book } from '@shared/schema';
import AnalysisForm from '@/components/book/AnalysisForm';
import AnalysisOptions from '@/components/book/AnalysisOptions';
import BookResult from '@/components/book/BookResult';

export default function Analyze() {
  const { t } = useLanguage();
  const { analysisMutation, saveBookMutation, analysisSteps } = useBookAnalysis();
  
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
  
  // Handle save to archive
  const handleSave = (book: Partial<Book>) => {
    saveBookMutation.mutate(book);
  };
  
  return (
    <div>
      {/* Page Title */}
      <div className="mb-6 border-b border-neutral-100 pb-2">
        <h1 className="text-2xl font-serif font-semibold text-primary">
          {t('bookAnalysis')}
        </h1>
      </div>
      
      <div className="md:grid md:grid-cols-6 md:gap-6">
        {/* Left Column - Upload & Analysis Options */}
        <div className="md:col-span-2 space-y-6">
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
        <div className="mt-6 md:mt-0 md:col-span-4">
          <BookResult 
            book={analysisMutation.data || {}}
            isLoading={analysisMutation.isPending}
            onSave={handleSave}
            loadingSteps={analysisSteps}
          />
        </div>
      </div>
    </div>
  );
}
