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

// Form schema
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  isbn: z.string().optional(),
});

interface AnalysisFormProps {
  onSubmit: (formData: FormData, options: any) => void;
  isLoading: boolean;
}

export default function AnalysisForm({ onSubmit, isLoading }: AnalysisFormProps) {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
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
    const formData = new FormData();
    
    // Add form values
    formData.append('title', values.title);
    formData.append('author', values.author);
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
