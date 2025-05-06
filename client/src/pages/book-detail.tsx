import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { parseErrorMessage, formatISBN } from '@/lib/utils';
import { useLanguage, Language } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { Book } from '@shared/schema';
import { ChevronLeft, Bookmark, Check, Pencil, Trash, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';

export default function BookDetail() {
  const [, setLocation] = useLocation();
  const [_, params] = useRoute('/book/:id');
  const bookId = params?.id;
  const { t, language, translateBook, isTranslating: isLanguageTranslating, registerTranslationCallback, unregisterTranslationCallback } = useLanguage();
  const { toast } = useToast();
  // Add local loading state for content regeneration
  const [isContentRegenerating, setIsContentRegenerating] = useState(false);
  
  // Language-specific fields that need translation
  const [translatedFields, setTranslatedFields] = useState<{
    summary: string | null;
    genres: string[] | null;
    themes: any[] | null;
    catalogEntry: string | null;
  }>({
    summary: null,
    genres: null,
    themes: null,
    catalogEntry: null,
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedBook, setEditedBook] = useState<Partial<Book>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Fetch book data
  const { data: book, isLoading, error } = useQuery<Book>({
    queryKey: [`/api/books/${bookId}`],
    enabled: !!bookId,
  });
  
  // Function to handle content regeneration when language changes
  const handleLanguageChange = async (newLanguage: Language, oldLanguage: Language) => {
    if (!book) return;
    
    // Show the loading state immediately
    setIsContentRegenerating(true);

    // Set the original content first to avoid empty content during regeneration
    setTranslatedFields({
      summary: book.summary,
      genres: book.genres as string[] | null,
      themes: book.themes as any[] | null,
      catalogEntry: book.catalogEntry,
    });
    
    try {
      console.log(`Regenerating book content from ${oldLanguage} to ${newLanguage}`);
      
      // Call the new API endpoint to regenerate content in the selected language
      const response = await fetch(`/api/books/${bookId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: newLanguage,
          options: {
            summary: true,
            genres: true,
            themes: true,
            catalogEntry: true
          }
        }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      
      // Get the updated book with regenerated content
      const updatedBook = await response.json();
      
      console.log("Content regeneration complete, updating UI");
      
      // Update the book in the cache
      queryClient.setQueryData([`/api/books/${bookId}`], updatedBook);
      
      // Update translated fields with the regenerated content
      setTranslatedFields({
        summary: updatedBook.summary || null,
        genres: Array.isArray(updatedBook.genres) ? updatedBook.genres : null,
        themes: Array.isArray(updatedBook.themes) ? updatedBook.themes : null,
        catalogEntry: updatedBook.catalogEntry || null,
      });
      
      toast({
        title: t('contentRegenerated'),
        description: t('contentRegeneratedSuccess'),
      });
    } catch (error) {
      console.error('Content regeneration error:', error);
      toast({
        title: t('regenerationFailed'),
        description: parseErrorMessage(error),
        variant: 'destructive',
      });
      // Fallback to original content is already set above
    } finally {
      setIsContentRegenerating(false);
    }
  };
  
  // Register for language changes
  useEffect(() => {
    const translationCallbackId = 'book-detail-' + bookId;
    registerTranslationCallback(translationCallbackId, handleLanguageChange);
    
    // Initial translation if needed
    if (book) {
      handleLanguageChange(language, language);
    }
    
    return () => {
      unregisterTranslationCallback(translationCallbackId);
    };
  }, [book, bookId, language, registerTranslationCallback, unregisterTranslationCallback]);
  
  // Update book mutation
  const updateBookMutation = useMutation({
    mutationFn: async (updatedBook: Partial<Book>) => {
      const response = await apiRequest('PUT', `/api/books/${bookId}`, updatedBook);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/books/${bookId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      queryClient.invalidateQueries({ queryKey: ['/api/books/recent'] });
      
      toast({
        title: t('bookUpdated'),
        description: t('bookUpdatedSuccess'),
      });
      
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: t('updateFailed'),
        description: parseErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
  
  // Delete book mutation
  const deleteBookMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/books/${bookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      queryClient.invalidateQueries({ queryKey: ['/api/books/recent'] });
      
      toast({
        title: t('bookDeleted'),
        description: t('bookDeletedSuccess'),
      });
      
      setLocation('/archives');
    },
    onError: (error) => {
      toast({
        title: t('deleteFailed'),
        description: parseErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
  
  // Start editing mode
  const handleEdit = () => {
    setEditedBook(book || {});
    setIsEditing(true);
  };
  
  // Cancel editing mode
  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  // Save edited book
  const handleSave = () => {
    if (editedBook) {
      updateBookMutation.mutate(editedBook);
    }
  };
  
  // Handle input change for edited fields
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedBook(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Handle delete confirmation
  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };
  
  // Confirm delete and execute deletion
  const confirmDelete = () => {
    deleteBookMutation.mutate();
    setIsDeleteDialogOpen(false);
  };
  
  // Go back to archives page
  const handleBack = () => {
    setLocation('/archives');
  };
  
  // Show loading state when fetching book data or during active content regeneration
  if (isLoading || isLanguageTranslating || isContentRegenerating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Skeleton className="w-full h-80" />
          </div>
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !book) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">
          {t('bookNotFound')}
        </h2>
        <p className="text-neutral-600 mb-6">
          {error ? parseErrorMessage(error) : t('bookNotFoundDesc')}
        </p>
        <Button onClick={handleBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          {t('backToArchives')}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with back button and actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" onClick={handleBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          {t('back')}
        </Button>
        
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelEdit}
                disabled={updateBookMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                {t('cancel')}
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSave}
                disabled={updateBookMutation.isPending}
              >
                {updateBookMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('saving')}
                  </span>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('save')}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEdit}
              >
                <Pencil className="h-4 w-4 mr-2" />
                {t('edit')}
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDelete}
                disabled={deleteBookMutation.isPending}
              >
                <Trash className="h-4 w-4 mr-2" />
                {t('delete')}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Book content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Cover image & metadata */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-4">
              {book.coverImageUrl ? (
                <div className="aspect-[2/3] overflow-hidden rounded-md mb-4">
                  <img 
                    src={book.coverImageUrl} 
                    alt={book.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[2/3] flex items-center justify-center bg-neutral-100 rounded-md mb-4">
                  <Bookmark className="h-12 w-12 text-neutral-400" />
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-neutral-500">{t('isbn')}</h4>
                  <p className="text-sm">{book.isbn ? formatISBN(book.isbn) : t('notAvailable')}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500">{t('publisher')}</h4>
                  <p className="text-sm">{book.publisher || t('notAvailable')}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500">{t('publishedYear')}</h4>
                  <p className="text-sm">{book.publishedYear || t('notAvailable')}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500">{t('pageCount')}</h4>
                  <p className="text-sm">{book.pageCount || t('notAvailable')}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500">{t('readingLevel')}</h4>
                  <p className="text-sm">{book.readingLevel || t('notAvailable')}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-neutral-500">{t('deweyDecimal')}</h4>
                  <p className="text-sm">{book.deweyDecimal || t('notAvailable')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right column - Book details */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('title')}</label>
                    <Input 
                      name="title"
                      value={editedBook.title || ''}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('author')}</label>
                    <Input 
                      name="author"
                      value={editedBook.author || ''}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('summary')}</label>
                    <Textarea 
                      name="summary"
                      value={editedBook.summary || ''}
                      onChange={handleInputChange}
                      className="w-full min-h-[150px]"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-serif font-semibold text-neutral-900 mb-2">
                    {book.title}
                  </h1>
                  <p className="text-lg text-neutral-700 mb-4">
                    {t('by')} {book.author}
                  </p>
                  
                  {/* Genres - use translated version if available */}
                  {((Array.isArray(translatedFields.genres) && translatedFields.genres.length > 0) || 
                   (Array.isArray(book.genres) && book.genres.length > 0)) && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {/* Show loading indicator during content regeneration */}
                      {isContentRegenerating && (
                        <div className="w-full flex items-center justify-center py-2">
                          <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-sm text-neutral-500">{t('regeneratingContent')}</span>
                        </div>
                      )}
                      
                      {/* Render genres */}
                      {Array.isArray(translatedFields.genres) && translatedFields.genres.length > 0 ? (
                        // Use translated genres
                        translatedFields.genres.map((genre: string, index: number) => (
                          <Badge key={index} variant="outline" className="bg-primary/10">
                            {genre}
                          </Badge>
                        ))
                      ) : (
                        // Use original genres
                        Array.isArray(book.genres) && book.genres.map((genre: string, index: number) => (
                          <Badge key={index} variant="outline" className="bg-primary/10">
                            {genre}
                          </Badge>
                        ))
                      )}
                    </div>
                  )}
                  
                  {/* Summary - use translated version if available */}
                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-neutral-900 mb-3">
                      {t('summary')}
                    </h3>
                    <div className="prose prose-neutral">
                      {isContentRegenerating ? (
                        <div className="flex items-center py-2">
                          <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-sm text-neutral-500">{t('regeneratingContent')}</span>
                        </div>
                      ) : (
                        <p className="text-neutral-700 whitespace-pre-line">
                          {translatedFields.summary || book.summary || t('noSummaryAvailable')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Themes - use translated version if available */}
                  {((Array.isArray(translatedFields.themes) && translatedFields.themes.length > 0) || 
                   (Array.isArray(book.themes) && book.themes.length > 0)) && (
                    <div className="mb-8">
                      <h3 className="text-lg font-medium text-neutral-900 mb-3">
                        {t('themes')}
                      </h3>
                      {isContentRegenerating ? (
                        <div className="flex items-center py-2">
                          <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-sm text-neutral-500">{t('regeneratingContent')}</span>
                        </div>
                      ) : (
                        <ul className="list-disc pl-5 space-y-1">
                          {Array.isArray(translatedFields.themes) && translatedFields.themes.length > 0 ? (
                            // Use translated themes
                            translatedFields.themes.map((theme: any, index: number) => {
                              // Handle both string and object themes
                              const themeText = typeof theme === 'string' 
                                ? theme 
                                : (theme.theme || theme.description || JSON.stringify(theme));
                                
                              return (
                                <li key={index} className="text-neutral-700">
                                  {themeText}
                                </li>
                              );
                            })
                          ) : (
                            // Use original themes
                            Array.isArray(book.themes) && book.themes.map((theme: any, index: number) => {
                              // Handle both string and object themes
                              const themeText = typeof theme === 'string' 
                                ? theme 
                                : (theme.theme || theme.description || JSON.stringify(theme));
                                
                              return (
                                <li key={index} className="text-neutral-700">
                                  {themeText}
                                </li>
                              );
                            })
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                  
                  {/* Catalog Entry - use translated version if available */}
                  {(translatedFields.catalogEntry || book.catalogEntry) && (
                    <div>
                      <h3 className="text-lg font-medium text-neutral-900 mb-3">
                        {t('catalogEntry')}
                      </h3>
                      <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                        {isContentRegenerating ? (
                          <div className="flex items-center py-2">
                            <svg className="animate-spin h-4 w-4 text-primary mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm text-neutral-500">{t('regeneratingContent')}</span>
                          </div>
                        ) : (
                          <p className="text-neutral-700 whitespace-pre-line font-mono text-sm">
                            {translatedFields.catalogEntry || book.catalogEntry}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmDelete')}</DialogTitle>
            <DialogDescription>
              {`${t('deleteBookConfirmation')} "${book.title}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteBookMutation.isPending}
            >
              {deleteBookMutation.isPending ? t('deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}