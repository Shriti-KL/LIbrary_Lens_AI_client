import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLanguage } from '@/hooks/use-language';
import { FileUpload } from '@/components/ui/file-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

// Form schema
const formSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  isbn: z.string().optional(),
});

interface AnalysisFormProps {
  onSubmit: (formData: FormData, options: any) => void;
  isLoading: boolean;
}

export default function AnalysisForm({ onSubmit, isLoading }: AnalysisFormProps) {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoExtract, setAutoExtract] = useState(true);
  const [extracting, setExtracting] = useState(false);
  
  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      author: '',
      isbn: '',
    },
  });

  // Handle form submission
  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // Create a unique ID for this form submission for tracking
    const submissionId = Date.now().toString();
    console.log(`Book analysis form submission ${submissionId} - Manual submission with values:`, values);
    
    const formData = new FormData();
    
    // Always explicitly add form values, even if empty
    // This ensures we're passing the user's exact input to the server
    formData.append('title', values.title || '');
    formData.append('author', values.author || '');
    formData.append('isbn', values.isbn || '');
    
    // Add file if selected
    if (selectedFile) {
      formData.append('coverImage', selectedFile);
      console.log(`Book analysis form submission ${submissionId} - Including file: ${selectedFile.name}`);
    }
    
    // Add a unique timestamp to force the server to treat this as a new request
    formData.append('requestTimestamp', submissionId);
    
    // Submit with analysis options
    onSubmit(formData, {
      summary: true,
      genres: true,
      themes: true,
      readingLevel: true,
      catalogEntry: true,
    });
  };

  // Auto-submit form when a file is selected
  const handleAutoSubmit = () => {
    if (selectedFile && autoExtract) {
      // Create a unique ID for this auto submission
      const submissionId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      console.log(`Book analysis form submission ${submissionId} - Auto-extract triggered`);
      
      // Create form data with the file only to auto-extract information
      const formData = new FormData();
      formData.append('coverImage', selectedFile);
      formData.append('requestTimestamp', submissionId);
      
      // This is NOT a manual submission
      formData.append('isManualSubmission', 'false');
      
      onSubmit(formData, {
        summary: true,
        genres: true,
        themes: true,
        readingLevel: true,
        catalogEntry: true,
      });
    }
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // Reset the form values when a new file is uploaded
    form.reset({
      title: '',
      author: '',
      isbn: '',
    });
    
    // If auto-extract is enabled, automatically submit for analysis
    if (autoExtract && !isLoading) {
      setExtracting(true);
      // Use a small timeout to allow UI to update
      setTimeout(() => {
        // Create a unique ID for this auto submission
        const submissionId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        console.log(`Book analysis form submission ${submissionId} - Auto-extract with file: ${file.name}`);
        
        // Create a formData with just the file
        const formData = new FormData();
        formData.append('coverImage', file);
        formData.append('requestTimestamp', submissionId);
        
        // Explicitly mark this as NOT a manual submission (auto-extraction)
        formData.append('isManualSubmission', 'false');
        
        // If we had previous results, force a new analysis
        formData.append('forceNewAnalysis', submissionId);
        
        // Submit for analysis
        onSubmit(formData, {
          summary: true,
          genres: true,
          themes: true,
          readingLevel: true,
          catalogEntry: true,
        });
      }, 100);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-serif font-medium text-neutral-800 mb-4">{t('uploadCover')}</h3>
        
        <FileUpload 
          onFileSelect={handleFileSelect}
          acceptedFileTypes="image/*"
          maxSize={10 * 1024 * 1024}
          dropzoneText={t('dragDrop')}
          fileTypeText="PNG, JPG, GIF up to 10MB"
        />
        
        <div className="mt-4">
          <h4 className="text-sm font-medium text-neutral-800">{t('enterDetails')}</h4>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-2 space-y-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('title')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Book title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('author')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Author name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isbn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('isbn')}</FormLabel>
                    <FormControl>
                      <Input placeholder="ISBN (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
      </CardContent>
      
      <CardFooter className="bg-neutral-50">
        <Button 
          type="submit" 
          className="ml-auto"
          onClick={form.handleSubmit(handleSubmit)}
          disabled={isLoading}
        >
          {isLoading ? t('processing') : t('analyzeBook')}
        </Button>
      </CardFooter>
    </Card>
  );
}
