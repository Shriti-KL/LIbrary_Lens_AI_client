import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { FileUpload } from '@/components/ui/file-upload';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BatchFile {
  id: string;
  file: File;
  name: string;
  preview?: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  error?: string;
}

interface BatchUploadProps {
  onSubmit: (files: File[]) => void;
  isProcessing: boolean;
}

export default function BatchUpload({ onSubmit, isProcessing }: BatchUploadProps) {
  const { t } = useLanguage();
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  
  // Handle file selection
  const handleFileSelect = (file: File) => {
    // Create preview for the image
    const reader = new FileReader();
    reader.onload = () => {
      const newFile: BatchFile = {
        id: Date.now().toString(),
        file,
        name: file.name,
        preview: reader.result as string,
        status: 'pending',
      };
      
      setBatchFiles(prev => [...prev, newFile]);
    };
    reader.readAsDataURL(file);
  };
  
  // Remove a file from the batch
  const removeFile = (id: string) => {
    setBatchFiles(prev => prev.filter(file => file.id !== id));
  };
  
  // Process the batch
  const processBatch = () => {
    if (batchFiles.length === 0) return;
    
    // Set all files to processing status
    setBatchFiles(prev => 
      prev.map(file => ({
        ...file,
        status: 'processing'
      }))
    );
    
    // Extract the actual File objects
    const files = batchFiles.map(batchFile => batchFile.file);
    
    // Submit the batch
    onSubmit(files);
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
        <FileUpload 
          onFileSelect={handleFileSelect}
          acceptedFileTypes="image/*"
          maxSize={10 * 1024 * 1024}
          className="mb-6"
        />
        
        {batchFiles.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">
              {t('batchProcessing')} ({batchFiles.length} items)
            </h4>
            
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '60px' }}>{t('preview')}</TableHead>
                    <TableHead>{t('title')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead style={{ width: '60px' }}></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchFiles.map(file => (
                    <TableRow key={file.id}>
                      <TableCell>
                        {file.preview && (
                          <div className="h-10 w-10 rounded overflow-hidden">
                            <img 
                              src={file.preview} 
                              alt={file.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>
                        {file.status === 'pending' && <span className="text-neutral-500">{t('waiting')}</span>}
                        {file.status === 'processing' && <span className="text-blue-500">{t('processing')}</span>}
                        {file.status === 'complete' && <span className="text-green-500">{t('complete')}</span>}
                        {file.status === 'error' && (
                          <span className="text-red-500" title={file.error}>
                            {t('error')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeFile(file.id)}
                          disabled={isProcessing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="bg-blue-50/50 justify-end border-t border-blue-100">
        <Button
          onClick={processBatch}
          disabled={batchFiles.length === 0 || isProcessing}
        >
          {isProcessing ? t('processing') : t('batchProcessing')}
        </Button>
      </CardFooter>
    </Card>
  );
}
