import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Book } from '@shared/schema';
import BatchUpload from '@/components/book/BatchUpload';
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
      const response = await apiRequest('POST', '/api/books', book);
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
      toast({
        title: 'Failed to Save Book',
        description: error.message,
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
    saveBookMutation.mutate(book);
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
      
      {/* Batch Results */}
      {batchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-serif">{t('results')}</CardTitle>
            <CardDescription>
              {t('batchProcessing')} results for {batchResults.length} items
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('title')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('progress')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchResults.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.result?.title || item.name}
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
                        {item.status === 'complete' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {t('complete')}
                          </Badge>
                        )}
                        {item.status === 'error' && (
                          <Badge variant="destructive">
                            {t('error')}
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
                      <TableCell>
                        <div className="flex gap-2">
                          {/* For successfully processed items that haven't been saved */}
                          {item.status === 'complete' && !item.saved && (
                            <>
                              {/* View/Edit button */}
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex items-center gap-1 text-primary hover:text-primary-dark hover:bg-primary/10"
                                onClick={() => handleEditBook(item.id, true)}
                              >
                                <Edit className="h-4 w-4" />
                                {t('viewEdit')}
                              </Button>
                              
                              {/* Save button */}
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleSaveBook(item.result)}
                                disabled={saveBookMutation.isPending}
                              >
                                <Save className="h-4 w-4" />
                                {t('save')}
                              </Button>
                            </>
                          )}
                          
                          {/* For already saved items */}
                          {item.status === 'complete' && item.saved && item.result?.id && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex items-center gap-1 text-primary hover:text-primary-dark hover:bg-primary/10"
                              onClick={() => {
                                // Navigate to the book details page in archives
                                setLocation(`/archives?view=${item.result.id}`);
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                              {t('viewDetails')}
                            </Button>
                          )}
                          
                          {/* For error items */}
                          {item.status === 'error' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                // Show detailed error
                                toast({
                                  title: t('error'),
                                  description: item.error || t('unknownError'),
                                  variant: 'destructive'
                                });
                              }}
                            >
                              {t('viewError')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Processing Info */}
            {batchMutation.isPending && (
              <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-md flex items-start">
                <BookOpen className="h-5 w-5 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium">{t('processing')} {t('batchProcessing')}</p>
                  <p className="text-sm">{t('loading')}</p>
                </div>
              </div>
            )}
            
            {/* Error Info */}
            {batchMutation.isError && (
              <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-md flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium">{t('error')} {t('batchProcessing')}</p>
                  <p className="text-sm">{batchMutation.error.message}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {!batchMutation.isPending && batchResults.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-primary/10 rounded-full p-3">
              <BookOpen className="h-10 w-10 text-primary" />
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