import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useBookAnalysis } from '@/hooks/use-book-analysis';
import { Book } from '@shared/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import GoogleBooksSearch from '@/components/book/GoogleBooksSearch';
import BookResult from '@/components/book/BookResult';
import RelatedBooks from '@/components/book/RelatedBooks';

export default function Search() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { saveBookMutation } = useBookAnalysis();
  
  // Selected book state
  const [selectedBook, setSelectedBook] = useState<Partial<Book> | null>(null);
  
  // Process book mutation
  const processBookMutation = useMutation({
    mutationFn: async (bookData: any) => {
      const response = await apiRequest('POST', '/api/books/analyze', bookData);
      return await response.json();
    },
    onSuccess: (data) => {
      setSelectedBook(data);
      toast({
        title: "Book Processed",
        description: "Book details have been analyzed successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle book selection from search
  const handleBookSelect = (book: any) => {
    processBookMutation.mutate(book);
  };
  
  // Handle save to archive
  const handleSave = (book: Partial<Book>) => {
    saveBookMutation.mutate(book);
  };

  return (
    <div>
      <div className="mb-6 border-b border-neutral-100">
        <Tabs defaultValue="search">
          <TabsList className="bg-transparent border-b-0">
            <TabsTrigger 
              value="search" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
            >
              {t('searchBooks')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Search Column */}
        <div className="md:col-span-2">
          <GoogleBooksSearch onBookSelect={handleBookSelect} />
        </div>
        
        {/* Selected Book & Related Column */}
        <div className="space-y-6">
          {selectedBook ? (
            <>
              <div className="p-4 bg-accent/20 rounded-lg">
                <h3 className="text-lg font-medium text-primary mb-2">{t('selectedBook')}</h3>
                <p className="text-sm">
                  <strong>{selectedBook.title}</strong> {selectedBook.author ? `by ${selectedBook.author}` : ''}
                </p>
                
                <div className="mt-4">
                  <Button 
                    onClick={() => handleSave(selectedBook)} 
                    className="w-full"
                    disabled={saveBookMutation.isPending}
                  >
                    {saveBookMutation.isPending ? t('saving') : t('saveToArchive')}
                  </Button>
                </div>
              </div>
              
              <RelatedBooks book={selectedBook} />
            </>
          ) : (
            <div className="p-6 border rounded-lg text-center">
              <h3 className="text-lg font-medium text-neutral-800 mb-2">{t('noSelection')}</h3>
              <p className="text-sm text-neutral-500">
                Search and select a book to see details and related titles
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Book Details */}
      {selectedBook && (
        <div className="mt-6">
          <BookResult 
            book={selectedBook} 
            isLoading={processBookMutation.isPending}
            onSave={handleSave}
          />
        </div>
      )}
    </div>
  );
}