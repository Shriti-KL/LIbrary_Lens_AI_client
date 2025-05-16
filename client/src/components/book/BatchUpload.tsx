import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { MultiFileUpload } from '@/components/ui/multi-file-upload';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Barcode } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface BatchUploadProps {
  onUpload?: (isbns: string[]) => void;  // Make this optional
  onSubmit?: (files: File[]) => void;     // Make this optional
  onSubmitISBNs?: (isbns: string[]) => void;  
  isProcessing?: boolean;
  isLoading?: boolean;
  uploadType?: string;
}

export default function BatchUpload({ 
  onSubmit, 
  onSubmitISBNs, 
  onUpload,
  isProcessing = false,
  isLoading = false,
  uploadType 
}: BatchUploadProps) {
  const { t } = useLanguage();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isbns, setIsbns] = useState<string>('');
  const [batchMode, setBatchMode] = useState<'covers' | 'isbns'>(uploadType === 'isbn' ? 'isbns' : 'covers');
  
  // Handle file selection
  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
  };
  
  // Handle ISBN input change
  const handleIsbnChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsbns(e.target.value);
  };
  
  // Process ISBNs from text input - handles comma, space, or newline separation
  const processISBNs = (): string[] => {
    if (!isbns.trim()) return [];
    
    // Split by commas, spaces, and newlines
    return isbns
      .split(/[\s,\n]+/)
      .map(isbn => isbn.trim())
      .filter(isbn => isbn.length > 0)
      .map(isbn => isbn.replace(/-/g, '')); // Remove hyphens for standardization
  };
  
  // Submit the batch
  const processBatch = () => {
    if (batchMode === 'covers' && selectedFiles.length === 0) return;
    if (batchMode === 'isbns') {
      const isbnList = processISBNs();
      if (isbnList.length === 0) return;
      
      // Try each possible callback for ISBN processing
      if (onSubmitISBNs) {
        onSubmitISBNs(isbnList);
        return;
      } else if (onUpload) {
        onUpload(isbnList);
        return;
      }
    }
    
    // Default to file processing if ISBN processing not provided
    if (selectedFiles.length > 0 && onSubmit) {
      onSubmit(selectedFiles);
    }
  };
  
  // Determine if processing based on either prop
  const isActive = isProcessing || isLoading;
  
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-serif font-medium text-neutral-800">
          {t('batchProcessing')}
        </h3>
        <p className="text-sm text-neutral-500">
          {batchMode === 'covers' 
            ? 'Upload multiple book covers for batch analysis'
            : 'Enter multiple ISBNs for batch processing'
          }
        </p>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          defaultValue={uploadType === 'isbn' ? 'isbns' : 'covers'} 
          className="w-full" 
          onValueChange={(value) => setBatchMode(value as 'covers' | 'isbns')}
        >
          <TabsList className="mb-4 w-full grid grid-cols-2">
            <TabsTrigger value="covers" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Book Covers
            </TabsTrigger>
            <TabsTrigger value="isbns" className="flex items-center gap-2">
              <Barcode className="h-4 w-4" />
              ISBNs
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="covers">
            <MultiFileUpload 
              onFilesSelect={handleFilesSelect}
              acceptedFileTypes="image/*"
              maxSize={10 * 1024 * 1024}
              className="mb-6"
              dropzoneText="Drag and drop multiple book covers here"
              fileTypeText="PNG, JPG, GIF up to 10MB each"
              isLoading={isActive}
            />
            
            {selectedFiles.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-md flex items-start">
                <BookOpen className="h-5 w-5 mr-2 mt-0.5" />
                <div>
                  <p className="font-medium">{selectedFiles.length} files selected</p>
                  <p className="text-sm">Click process to analyze these book covers</p>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="isbns">
            <div className="space-y-4">
              <div>
                <Textarea
                  placeholder="Enter multiple ISBNs separated by commas, spaces, or new lines"
                  value={isbns}
                  onChange={handleIsbnChange}
                  rows={8}
                  className="font-mono resize-y"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Example: 9783740824235, 9783103977042, 9783947857272
                </p>
              </div>
              
              {processISBNs().length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-md flex items-start">
                  <Barcode className="h-5 w-5 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium">{processISBNs().length} ISBNs detected</p>
                    <p className="text-sm">Click process to analyze these books by ISBN</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="bg-blue-50/50 justify-end border-t border-blue-100">
        <Button
          onClick={processBatch}
          disabled={(batchMode === 'covers' && selectedFiles.length === 0) || 
                   (batchMode === 'isbns' && processISBNs().length === 0) || 
                   isActive}
        >
          {isActive ? t('processing') : t('batchProcessing')}
        </Button>
      </CardFooter>
    </Card>
  );
}