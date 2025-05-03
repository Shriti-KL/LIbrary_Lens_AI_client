import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { Book } from '@shared/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    analysisMutation.mutate({ formData, options });
  };
  
  // Handle save to archive
  const handleSave = (book: Partial<Book>) => {
    saveBookMutation.mutate(book);
  };
  
  return (
    <div>
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-neutral-100">
        <Tabs defaultValue="single">
          <TabsList className="bg-transparent border-b-0">
            <TabsTrigger 
              value="single" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
            >
              {t('bookAnalysis')}
            </TabsTrigger>
            <TabsTrigger 
              value="batch" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
              disabled
            >
              {t('batchProcessing')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
