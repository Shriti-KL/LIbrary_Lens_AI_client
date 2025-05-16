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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BookOpen, AlertCircle, ExternalLink, Save, Edit, Check } from 'lucide-react';

export default function Batch() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // State for batch processing
  const [batchResults, setBatchResults] = useState<Array<{
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    progress: number;
    result?: Partial<Book>;
    error?: string;
    saved?: boolean;
    editing?: boolean;
  }>>([]);
  
  // Batch processing mutations
  const batchMutation = useMutation({
    mutationFn: async (payload: { type: 'files', files: File[] } | { type: 'isbns', isbns: string[] }) => {
      if (payload.type === 'files') {
        // Create FormData for batch upload
        const formData = new FormData();
        
        // Add all files to FormData
        payload.files.forEach(file => {
          formData.append(`coverImages`, file);
        });
        
        // Initialize batch results (all at once to avoid multiple state updates)
        const initialBatchResults = payload.files.map((file, index) => ({
          id: `batch-${Date.now()}-${index}`,
          name: file.name,
          status: 'pending' as const,
          progress: 0
        }));
        
        setBatchResults(initialBatchResults);
        
        // Make API request using the standardized apiRequest utility
        const response = await apiRequest('POST', '/api/books/batch', formData);
        return await response.json();
      } else {
        // For ISBNs batch processing
        // Initialize batch results for ISBNs (all at once to avoid multiple state updates)
        const initialBatchResults = payload.isbns.map((isbn, index) => ({
          id: `batch-${Date.now()}-${index}`,
          name: isbn, // Use ISBN as the name
          status: 'pending' as const,
          progress: 0
        }));
        
        setBatchResults(initialBatchResults);
        
        // Make API request with JSON body for ISBNs
        try {
          const response = await fetch('/api/books/batch-isbn', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isbns: payload.isbns }),
            credentials: 'include'
          });
          return await response.json();
        } catch (error) {
          console.error("Error processing batch ISBNs:", error);
          // Return a standardized error response
          return {
            results: payload.isbns.map(isbn => ({
              success: false,
              error: "Server error processing ISBN batch",
              filename: isbn,
              status: 'error'
            })),
            processed: {
              success: 0,
              failed: payload.isbns.length,
              total: payload.isbns.length
            }
          };
        }
      }
    },
    onMutate: () => {
      // Update all batch items to processing status
      setBatchResults(prev => 
        prev.map(item => ({
          ...item,
          status: 'processing',
          progress: 10
        }))
      );
      
      // Simulate progress updates (in a real application, this would be based on actual progress)
      const progressInterval = setInterval(() => {
        setBatchResults(prev => {
          const allComplete = prev.every(item => 
            item.status === 'complete' || 
            item.status === 'error' || 
            item.progress >= 90
          );
          
          if (allComplete) {
            clearInterval(progressInterval);
            return prev;
          }
          
          return prev.map(item => {
            if (item.status === 'processing' && item.progress < 90) {
              return {
                ...item,
                progress: item.progress + Math.floor(Math.random() * 10) + 5
              };
            }
            return item;
          });
        });
      }, 1000);
      
      return () => clearInterval(progressInterval);
    },
    onSuccess: (data) => {
      console.log("Batch processing response:", data);
      
      // Update batch results with success data
      if (Array.isArray(data.results)) {
        setBatchResults(prev => {
          // Map each result to its corresponding file using filename
          return prev.map(item => {
            // Find matching result by filename
            const matchingResult = data.results.find(
              (r: { filename: string; status: string; book?: any; error?: string; saved?: boolean }) => 
                r.filename === item.name // Match on filename
            );
            
            if (matchingResult) {
              return {
                ...item,
                status: matchingResult.status === 'success' ? 'complete' : 'error',
                progress: 100,
                result: matchingResult.book || {},
                error: matchingResult.error,
                saved: matchingResult.saved || false, // Track if the book has been saved to the database
              };
            }
            
            // No matching result found
            return {
              ...item,
              status: 'error',
              progress: 100,
              error: 'No result returned from server'
            };
          });
        });
      }
      
      toast({
        title: 'Batch Processing Complete',
        description: `Processed ${data.processed?.success || 0} books successfully, ${data.processed?.failed || 0} failed. You can now review and save them.`,
      });
      
      // We don't automatically invalidate book queries anymore
      // since we're not saving the books to the database yet
    },
    onError: (error) => {
      toast({
        title: 'Batch Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
      
      // Update all items in processing to error
      setBatchResults(prev => 
        prev.map(item => 
          item.status === 'processing' 
            ? {
                ...item,
                status: 'error',
                progress: 100,
                error: error.message
              }
            : item
        )
      );
    }
  });
  
  // Handle batch submission for files
  const handleBatchSubmit = (files: File[]) => {
    // Reset batch results
    setBatchResults([]);
    
    // Process the batch
    batchMutation.mutate({ type: 'files', files });
  };
  
  // Handle batch submission for ISBNs
  const handleBatchISBNSubmit = (isbns: string[]) => {
    // Reset batch results
    setBatchResults([]);
    
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
      item.id === itemId
        ? { ...item, editing }
        : item
    ));
  };
  
  // Handle updating a book's data
  const handleUpdateBookData = (itemId: string, updatedData: Partial<Book>) => {
    setBatchResults(prev => prev.map(item => 
      item.id === itemId
        ? { ...item, result: { ...item.result, ...updatedData } }
        : item
    ));
  };
  
  // Handle saving a book to the database
  const handleSaveBook = (book: Partial<Book>) => {
    if (book) {
      saveBookMutation.mutate(book);
    }
  };
  
  // Helper method to count items in various states
  const getItemCount = (status: 'pending' | 'processing' | 'complete' | 'error' | 'saved') => {
    if (status === 'saved') {
      return batchResults.filter(item => item.saved).length;
    }
    return batchResults.filter(item => item.status === status).length;
  };
  
  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Page Title */}
      <div className="mb-8 border-b border-neutral-200 pb-3">
        <h1 className="text-2xl font-serif font-semibold text-primary-dark">
          {t('batchProcessing')}
        </h1>
        <p className="text-neutral-600 mt-1">Process multiple books at once</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 mb-8">
        <BatchUpload 
          onSubmit={handleBatchSubmit}
          onSubmitISBNs={handleBatchISBNSubmit}
          isProcessing={batchMutation.isPending}
        />
      </div>
      
      {/* Processing Status */}
      {batchResults.length > 0 && batchResults.some(item => item.status === 'pending' || item.status === 'processing') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-serif">{t('processingStatus')}</CardTitle>
            <CardDescription>
              {t('processingItems')}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('item')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('progress')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchResults
                    .filter(item => item.status === 'pending' || item.status === 'processing')
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' && (
                            <Badge variant="outline">{t('waiting')}</Badge>
                          )}
                          {item.status === 'processing' && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              {t('processing')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Progress value={item.progress} className="w-full h-2" />
                            <span className="text-xs text-neutral-500 w-10">
                              {item.progress}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Error items */}
      {batchResults.length > 0 && batchResults.some(item => item.status === 'error') && (
        <Card className="mb-8 border-red-100">
          <CardHeader className="bg-red-50/50 border-b border-red-100">
            <CardTitle className="text-xl font-serif text-red-800">{t('errors')}</CardTitle>
            <CardDescription className="text-red-700">
              {t('errorItems')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4">
            <div className="border border-red-100 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50/50">
                    <TableHead>{t('item')}</TableHead>
                    <TableHead>{t('error')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchResults
                    .filter(item => item.status === 'error')
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-red-600 text-sm">
                          {item.error ? (item.error.length > 50 ? item.error.substring(0, 50) + "..." : item.error) : t('unknownError')}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              toast({
                                title: 'Error Details',
                                description: item.error || t('unknownError'),
                                variant: 'destructive'
                              });
                            }}
                          >
                            {t('viewError')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Success Message - When all books are saved */}
      {batchResults.length > 0 && 
       batchResults.filter(item => !item.saved || item.status === 'error').length === 0 && (
        <Card className="mb-8 border-green-100 bg-green-50/50">
          <CardContent className="text-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Check className="h-12 w-12 text-green-500 p-2 bg-green-100 rounded-full" />
              <h3 className="text-xl font-medium text-green-800">{t('allBooksSaved')}</h3>
              <p className="text-sm text-green-700">
                {t('allBooksHaveBeenSavedToLibrary')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setLocation('/archives')}
              >
                {t('viewArchives')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Book Slideshow for Completed Items */}
      <BatchBookSlideshow
        items={batchResults}
        onSave={handleSaveBook}
        onEdit={handleEditBook}
        onUpdateBook={handleUpdateBookData}
        onViewDetails={(book) => {
          if (book && book.id) {
            window.location.href = `/archives?view=${book.id}`;
          }
        }}
      />
      
      {/* Empty State */}
      {!batchMutation.isPending && batchResults.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-primary/10 rounded-full p-3">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-neutral-800">
              {t('batchProcessing')}
            </h3>
            <p className="mt-2 text-sm text-neutral-500 text-center max-w-md">
              Upload multiple book covers to analyze them in a single batch.
              This is useful for processing large collections efficiently.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}