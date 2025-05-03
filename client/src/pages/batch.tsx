import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Book } from '@shared/schema';
import BatchUpload from '@/components/book/BatchUpload';
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
import { BookOpen, AlertCircle } from 'lucide-react';

export default function Batch() {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // State for batch processing
  const [batchResults, setBatchResults] = useState<Array<{
    id: string;
    file: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    progress: number;
    result?: Partial<Book>;
    error?: string;
  }>>([]);
  
  // Batch processing mutation
  const batchMutation = useMutation({
    mutationFn: async (files: File[]) => {
      // Create FormData for batch upload
      const formData = new FormData();
      
      // Add all files
      files.forEach((file, index) => {
        formData.append(`coverImages`, file);
        
        // Initialize batch results
        setBatchResults(prev => [
          ...prev,
          {
            id: `batch-${Date.now()}-${index}`,
            file: file.name,
            status: 'pending',
            progress: 0
          }
        ]);
      });
      
      // Make API request using the standardized apiRequest utility
      const response = await apiRequest('POST', '/api/books/batch', formData);
      return await response.json();
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
      // Update batch results with success data
      if (Array.isArray(data.results)) {
        setBatchResults(prev => 
          prev.map((item, index) => ({
            ...item,
            status: 'complete',
            progress: 100,
            result: data.results[index] || {}
          }))
        );
      }
      
      toast({
        title: 'Batch Processing Complete',
        description: `Processed ${data.processed || 0} books successfully.`,
      });
      
      // Invalidate books query to refresh archives
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
    },
    onError: (error) => {
      // Mark all as error
      setBatchResults(prev => 
        prev.map(item => ({
          ...item,
          status: 'error',
          error: error.message
        }))
      );
      
      toast({
        title: 'Batch Processing Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Handle batch submission
  const handleBatchSubmit = (files: File[]) => {
    // Clear previous results
    setBatchResults([]);
    
    // Process the batch
    batchMutation.mutate(files);
  };
  
  return (
    <div className="space-y-6">
      <BatchUpload 
        onSubmit={handleBatchSubmit}
        isProcessing={batchMutation.isPending}
      />
      
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchResults.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.result?.title || item.file}
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
        <Card className="mt-6">
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
