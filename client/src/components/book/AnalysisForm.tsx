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

// Form schema - all fields optional now
const formSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  isbn: z.string().optional(),
});

interface AnalysisFormProps {
  onSubmit: (formData: FormData, options: any) => void;
  isLoading: boolean;
  results?: any; // Results from the API for auto-fill
}

export default function AnalysisForm({ onSubmit, isLoading, results }: AnalysisFormProps) {
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

  // Update form when results change
  useEffect(() => {
    if (results) {
      if (results.title) form.setValue('title', results.title);
      if (results.author) form.setValue('author', results.author);
      if (results.isbn) form.setValue('isbn', results.isbn || '');
      setExtracting(false);
    }
  }, [results, form]);

  // Handle form submission
  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const formData = new FormData();
    
    // Add form values - handle undefined values properly
    if (values.title) formData.append('title', values.title);
    if (values.author) formData.append('author', values.author);
    if (values.isbn) formData.append('isbn', values.isbn);
    
    // Add file if selected
    if (selectedFile) {
      formData.append('coverImage', selectedFile);
    }
    
    // Submit with analysis options
    onSubmit(formData, {
      summary: true,
      genres: true,
      themes: true,
      readingLevel: true,
      catalogEntry: true,
    });
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // If auto-extract is enabled, automatically submit for analysis
    if (autoExtract && !isLoading) {
      setExtracting(true);
      // Create a formData with just the file
      const formData = new FormData();
      formData.append('coverImage', file);
      
      // Submit for analysis
      onSubmit(formData, {
        summary: true,
        genres: true,
        themes: true,
        readingLevel: true,
        catalogEntry: true,
      });
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
        
        {/* Auto-extract switch */}
        <div className="flex items-center justify-between mt-4 mb-2">
          <div className="flex items-center space-x-2">
            <Switch 
              id="auto-extract" 
              checked={autoExtract}
              onCheckedChange={setAutoExtract}
            />
            <label
              htmlFor="auto-extract"
              className="text-sm font-medium text-neutral-700 cursor-pointer"
            >
              {t('autoExtract')}
            </label>
          </div>

          {isLoading && extracting && (
            <div className="flex items-center text-primary text-sm">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {t('extracting')}
            </div>
          )}
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium text-neutral-800 flex items-center justify-between">
            {selectedFile && autoExtract ? t('autoExtractedDetails') : t('enterDetails')}
            {isLoading && !extracting && (
              <div className="flex items-center text-primary text-sm">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {t('processing')}
              </div>
            )}
          </h4>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-2 space-y-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('title')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={autoExtract ? "Will be auto-detected" : "Book title"} 
                        {...field} 
                      />
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
                      <Input 
                        placeholder={autoExtract ? "Will be auto-detected" : "Author name"} 
                        {...field} 
                      />
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
                      <Input 
                        placeholder={autoExtract ? "Will be auto-detected if available" : "ISBN (optional)"} 
                        {...field} 
                      />
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
