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
import { BookOpen } from 'lucide-react';

interface BatchUploadProps {
  onSubmit: (files: File[]) => void;
  isProcessing: boolean;
}

export default function BatchUpload({ onSubmit, isProcessing }: BatchUploadProps) {
  const { t } = useLanguage();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Handle file selection
  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
  };
  
  // Submit the batch
  const processBatch = () => {
    if (selectedFiles.length === 0) return;
    onSubmit(selectedFiles);
  };
  
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-serif font-medium text-neutral-800">
          {t('batchProcessing')}
        </h3>
        <p className="text-sm text-neutral-500">
          Upload multiple book covers for batch analysis
        </p>
      </CardHeader>
      
      <CardContent>
        <MultiFileUpload 
          onFilesSelect={handleFilesSelect}
          acceptedFileTypes="image/*"
          maxSize={10 * 1024 * 1024}
          className="mb-6"
          dropzoneText="Drag and drop multiple book covers here"
          fileTypeText="PNG, JPG, GIF up to 10MB each"
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
      </CardContent>
      
      <CardFooter className="bg-blue-50/50 justify-end border-t border-blue-100">
        <Button
          onClick={processBatch}
          disabled={selectedFiles.length === 0 || isProcessing}
        >
          {isProcessing ? t('processing') : t('batchProcessing')}
        </Button>
      </CardFooter>
    </Card>
  );
}
