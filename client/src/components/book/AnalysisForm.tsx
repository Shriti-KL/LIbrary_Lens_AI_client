import React, { useState, useEffect } from 'react';
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
  const [isDragDropping, setIsDragDropping] = useState(false);
  
  // Store the previous loading state to detect transitions
  const previousLoadingRef = React.useRef(isLoading);
  
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
    setIsDragDropping(false);
    
    // Reset the form values when a new file is uploaded
    form.reset({
      title: '',
      author: '',
      isbn: '',
    });
    
    // If auto-extract is enabled, automatically submit for analysis
    if (autoExtract && !isLoading) {
      setExtracting(true);
      // Create a unique ID for this auto submission
      const submissionId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      console.log(`Book analysis form submission ${submissionId} - Auto-extract with file: ${file.name}`);
      
      // Create a formData with just the file
      const formData = new FormData();
      formData.append('coverImage', file);
      formData.append('requestTimestamp', submissionId);
      
      // Add a null title and author to indicate we need backend extraction
      formData.append('title', '');
      formData.append('author', '');
      console.log(`Submitting analysis with form data:`, {
        title: null,
        author: null,
        hasImage: true
      });
      
      // Log analysis parameters for debugging
      console.log(`Analyzing book with data:`, {
        hasTitle: false,
        hasAuthor: false,
        hasCoverImage: true
      });
      
      // Explicitly mark this as NOT a manual submission (auto-extraction)
      formData.append('isManualSubmission', 'false');
      
      // If we had previous results, force a new analysis
      formData.append('forceNewAnalysis', submissionId);
      
      try {
        // Submit for analysis
        onSubmit(formData, {
          summary: true,
          genres: true,
          themes: true,
          readingLevel: true,
          catalogEntry: true,
        });
      } catch (error) {
        console.error("Error submitting file for analysis:", error);
        setExtracting(false);
      }
    }
  };
  
  // Effect to detect when analysis completes and reset the form
  useEffect(() => {
    // If loading state transitions from true to false (operation completed)
    if (previousLoadingRef.current && !isLoading) {
      console.log("Analysis complete, resetting form for next entry");
      
      // Reset the form to empty
      form.reset({
        title: '',
        author: '',
        isbn: '',
      });
      
      // Clear the selected file
      setSelectedFile(null);
      
      // If we were in extracting mode, clear that state
      if (extracting) {
        setExtracting(false);
      }
    }
    
    // Update the reference for the next render
    previousLoadingRef.current = isLoading;
  }, [isLoading, form, extracting]);

  return (
    <Card className="shadow-sm border border-neutral-200">
      <CardContent className="pt-6 px-6">
        <h3 className="text-lg font-serif font-medium text-primary-dark mb-5">{t('uploadCover')}</h3>
        
        <FileUpload 
          onFileSelect={handleFileSelect}
          acceptedFileTypes="image/*"
          maxSize={10 * 1024 * 1024}
          dropzoneText={t('dragDrop')}
          fileTypeText="PNG, JPG, GIF up to 10MB"
          className="border-2 border-dashed border-primary/30"
          isLoading={(isLoading || extracting) && !!selectedFile}
          selectedFile={selectedFile}
        />
        
        <div className="mt-6">
          <h4 className="text-sm font-medium text-primary-dark mb-3">{t('enterDetails')}</h4>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-3 space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="mb-1">
                    <FormLabel className="text-sm font-medium">{t('title')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Book title" {...field} className="border-neutral-300" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem className="mb-1">
                    <FormLabel className="text-sm font-medium">{t('author')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Author name" {...field} className="border-neutral-300" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isbn"
                render={({ field }) => (
                  <FormItem className="mb-1">
                    <FormLabel className="text-sm font-medium">{t('isbn')}</FormLabel>
                    <FormControl>
                      <Input placeholder="ISBN (optional)" {...field} className="border-neutral-300" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
      </CardContent>
      
      <CardFooter className="bg-neutral-50 px-6 py-6 border-t border-neutral-200">
        <div className="w-full flex justify-end">
          <Button 
            type="submit" 
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isLoading}
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-medium"
          >
            {isLoading ? t('processing') : t('analyzeBook')}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}