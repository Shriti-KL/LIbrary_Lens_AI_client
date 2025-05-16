import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Book } from '@shared/schema';
import BatchUpload from '@/components/book/BatchUpload';
import BatchBookEditor from '@/components/book/BatchBookEditor';
import BatchBookSlideshow from '@/components/book/BatchBookSlideshow';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BookOpen, AlertCircle, ExternalLink, Save, Edit, Check } from 'lucide-react';

export default function Batch() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // State for batch processing
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Handle adding ISBNs for batch processing
  const handleAddISBNs = (isbns: string[]) => {
    // First, map ISBNs to a batch format with unique IDs
    const batchItems = isbns.map((isbn, index) => ({
      id: `isbn-${Date.now()}-${index}`,
      name: isbn,
      type: 'isbn',
      status: 'pending',
      progress: 0,
      saved: false,
      editing: false,
    }));
    
    // Add these items to the batch results state
    setBatchResults(prev => [...prev, ...batchItems]);
    
    // Process the batch of ISBNs
    batchMutation.mutate({ type: 'isbns', isbns });
  };
  
  // Add a mutation for saving a book
  const saveBookMutation = useMutation({
    mutationFn: async (book: Partial<Book>) => {
      // Ensure numeric fields are correctly typed
      const preparedBook = {
        ...book,
        pageCount: typeof book.pageCount === 'string' ? parseInt(book.pageCount as string) : book.pageCount,
        publicationYear: typeof book.publicationYear === 'string' ? parseInt(book.publicationYear as string) : book.publicationYear
      };
      
      const response = await apiRequest('POST', '/api/books', preparedBook);
      return await response.json();
    },
    onSuccess: (savedBook, variables) => {
      // Update the batch results to mark this book as saved
      setBatchResults(prev => prev.map(item => 
        item.result && item.result.isbn === variables.isbn
          ? { ...item, saved: true, result: savedBook }
          : item
      ));
      
      // Show success message
      toast({
        title: 'Book Saved',
        description: `Successfully saved "${savedBook.title}" to your book archive.`,
      });
      
      // Refresh book lists
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      queryClient.invalidateQueries({ queryKey: ['/api/books/recent'] });
    },
    onError: (error) => {
      console.error("Error saving book:", error);
      toast({
        title: 'Failed to Save Book',
        description: error.message || "Error saving book to database. Check numeric fields.",
        variant: 'destructive',
      });
    }
  });
  
  // Handle editing a book in the batch results
  const handleEditBook = (itemId: string, editing: boolean) => {
    setBatchResults(prev => prev.map(item => 
      item.id === itemId ? { ...item, editing } : item
    ));
  };
  
  // Handle saving a book directly (without using the editor)
  const handleSaveBook = (book: Partial<Book>) => {
    saveBookMutation.mutate(book);
  };
  
  // Mutation for batch processing
  const batchMutation = useMutation({
    mutationFn: async (data: { type: string; isbns?: string[] }) => {
      setIsUploading(true);
      
      if (data.type === 'isbns' && data.isbns) {
        // Update state to show pending status
        const isbns = data.isbns;
        setBatchResults(prev => 
          prev.map(item => {
            if (isbns.includes(item.name) && item.status === 'pending') {
              return { ...item, status: 'processing', progress: 10 };
            }
            return item;
          })
        );
        
        // Process ISBNs in batch
        const response = await apiRequest('POST', '/api/books/batch-isbn', { isbns });
        return await response.json();
      }
      
      return { error: 'Unsupported batch type' };
    },
    onSuccess: (data, variables) => {
      setIsUploading(false);
      
      if (variables.type === 'isbns' && variables.isbns && data.results) {
        // Map the API results back to our batch items
        const resultsMap = new Map();
        data.results.forEach((result: any) => {
          if (result.success && result.book && result.book.isbn) {
            resultsMap.set(result.book.isbn, result);
          }
        });
        
        // Update the batch results with API response data
        setBatchResults(prev => 
          prev.map(item => {
            if (variables.isbns!.includes(item.name)) {
              // Find the matching result by ISBN
              const result = resultsMap.get(item.name);
              
              if (result && result.success) {
                return { 
                  ...item, 
                  status: 'complete', 
                  progress: 100,
                  result: result.book 
                };
              } else {
                return { 
                  ...item, 
                  status: 'error', 
                  progress: 100,
                  error: result?.error || 'Failed to process ISBN' 
                };
              }
            }
            return item;
          })
        );
        
        // Show success message
        toast({
          title: 'Batch Processing Complete',
          description: `Successfully processed ${data.results.filter((r: any) => r.success).length} out of ${data.results.length} items.`,
        });
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast({
        title: 'Batch Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Clear all batch results
  const handleClearResults = () => {
    setBatchResults([]);
  };
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-medium text-primary-dark">
          {t('batchProcessing')}
        </h1>
        <p className="text-neutral-600 mt-1">
          {t('batchProcessingDescription')}
        </p>
      </div>
      
      {/* ISBN Batch Upload */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-serif">{t('batchISBN')}</CardTitle>
            <CardDescription>
              {t('enterISBNs')}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <BatchUpload 
              onSubmit={() => {}}
              onSubmitISBNs={handleAddISBNs}
              isProcessing={isUploading || batchMutation.isPending}
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Batch Results */}
      {batchResults.length > 0 && (
        <div className="mt-6">
          {/* New slideshow view for batch results */}
          <BatchBookSlideshow
            batchResults={batchResults}
            onSave={(book) => saveBookMutation.mutate(book)}
            onEdit={handleEditBook}
          />
          
          {/* Clear results button */}
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearResults}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {t('clearResults')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}