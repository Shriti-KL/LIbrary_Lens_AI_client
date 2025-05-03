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
  const [manualEntryMode, setManualEntryMode] = useState(false);
  
  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      author: '',
      isbn: '',
    },
  });

  // Monitor form changes to detect manual entry
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // If user types in any field and we're not already in manual mode, switch to it
      if ((value.title || value.author || value.isbn) && !manualEntryMode) {
        console.log("Manual entry detected, switching to manual mode");
        setManualEntryMode(true);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, manualEntryMode]);
  
  // Handle form submission
  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // Create a unique ID for this form submission for tracking
    const submissionId = Date.now().toString();
    console.log(`Book analysis form submission ${submissionId} - Manual submission with values:`, values);
    
    // Check if we have actual values (not just empty strings)
    const hasTitle = values.title && values.title.trim().length > 0;
    const hasAuthor = values.author && values.author.trim().length > 0;
    const hasISBN = values.isbn && values.isbn.trim().length > 0;
    
    // If this is a manual entry (title, author, or ISBN entered)
    // and we still have a previously uploaded file, ask if they want to clear it
    if ((hasTitle || hasAuthor || hasISBN) && !manualEntryMode && selectedFile) {
      setManualEntryMode(true);
    }

    const formData = new FormData();
    
    // Always explicitly add form values, even if empty
    // This ensures we're passing the user's exact input to the server
    formData.append('title', values.title || '');
    formData.append('author', values.author || '');
    formData.append('isbn', values.isbn || '');
    
    // For manual submission with ISBN only, we need to flag it specially to ensure
    // Google Books API is used for lookup
    if (!hasTitle && !hasAuthor && hasISBN) {
      formData.append('isISBNOnlySearch', 'true');
      console.log(`Book analysis form submission ${submissionId} - ISBN-only search: ${values.isbn}`);
    }
    
    // Only include the book cover if in auto-extract mode or explicitly requested
    if (selectedFile && (!manualEntryMode || confirm("Keep using the uploaded cover image with your manual entry?"))) {
      formData.append('coverImage', selectedFile);
      console.log(`Book analysis form submission ${submissionId} - Including file: ${selectedFile.name}`);
    } else if (manualEntryMode && selectedFile) {
      // User chose not to use the cover, so clear it
      setSelectedFile(null);
    }
    
    // Add a unique timestamp to force the server to treat this as a new request
    formData.append('requestTimestamp', submissionId);
    
    // Explicitly mark this as a manual submission
    formData.append('isManualSubmission', 'true');
    formData.append('forceNewAnalysis', submissionId);
    
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

  // Create a function to clear the uploaded file
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setManualEntryMode(false);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-serif font-medium text-neutral-800 mb-4">{t('uploadCover')}</h3>
        
        {/* File display and management */}
        {selectedFile && (
          <div className={`mb-3 p-2 ${manualEntryMode ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'} border rounded-md text-sm ${manualEntryMode ? 'text-yellow-800' : 'text-blue-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {manualEntryMode ? '⚠️' : '📷'}
                </span>
                <span>
                  {manualEntryMode 
                    ? `"${selectedFile.name}" will be ignored for manual search.` 
                    : `Using "${selectedFile.name}" for auto-extraction`}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearSelectedFile}
                className={`text-xs hover:${manualEntryMode ? 'bg-yellow-100' : 'bg-blue-100'}`}
              >
                Clear File
              </Button>
            </div>
          </div>
        )}
        
        <FileUpload 
          onFileSelect={handleFileSelect}
          acceptedFileTypes="image/*"
          maxSize={10 * 1024 * 1024}
          dropzoneText={t('dragDrop')}
          fileTypeText="PNG, JPG, GIF up to 10MB"
        />
        
        <div className="mt-4">
          <h4 className="text-sm font-medium text-neutral-800">{t('enterDetails')}</h4>
          <p className="text-xs text-neutral-500 mb-2">
            {manualEntryMode 
              ? "Enter book details manually. ISBN lookup can automatically fill in information."
              : "Either upload a cover image for automatic extraction or manually enter book details below."}
          </p>
          
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
                    <div className="flex justify-between">
                      <FormLabel>{t('isbn')}</FormLabel>
                      {manualEntryMode && field.value && (
                        <span className="text-xs text-blue-600 font-medium">ISBN lookup enabled</span>
                      )}
                    </div>
                    <FormControl>
                      <Input 
                        placeholder="ISBN (optional)" 
                        {...field} 
                        className={field.value && manualEntryMode ? "border-blue-200 focus-visible:ring-blue-300" : ""}
                        onChange={(e) => {
                          field.onChange(e);
                          // When ISBN is entered and we're in manual mode, 
                          // make it visually clear this will be used for lookup
                          if (e.target.value && !manualEntryMode) {
                            setManualEntryMode(true);
                            console.log("ISBN entry detected, switching to manual mode");
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value && manualEntryMode && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Enter ISBN-10 or ISBN-13 for automatic Google Books lookup
                      </p>
                    )}
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
