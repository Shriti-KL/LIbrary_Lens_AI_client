import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { Book } from '@shared/schema';
import AnalysisForm from '@/components/book/AnalysisForm';
import AnalysisOptions from '@/components/book/AnalysisOptions';
import BookResult from '@/components/book/BookResult';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default function Analyze() {
  const { t } = useLanguage();
  const { analysisMutation, saveBookMutation, analysisSteps, resetAnalysis } = useBookAnalysis();
  
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
    <div className="max-w-7xl mx-auto pb-12">
      {/* Page Title */}
      <div className="mb-8 border-b border-neutral-200 pb-3 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-dark flex items-center gap-2">
            {t('bookAnalysis')}
            {analysisMutation.data && Object.keys(analysisMutation.data).length > 0 && (
              <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Active Analysis
              </span>
            )}
          </h1>
          <p className="text-neutral-600 mt-1">AI-powered insights and classification</p>
        </div>
        
        {/* Reset Button - only show when there's analysis data */}
        {analysisMutation.data && Object.keys(analysisMutation.data).length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-neutral-600 border-neutral-300 hover:bg-neutral-100"
            onClick={() => resetAnalysis()}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        )}
      </div>
      
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