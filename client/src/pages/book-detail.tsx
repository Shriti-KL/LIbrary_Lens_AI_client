import React, { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { parseErrorMessage, formatISBN } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
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
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedBook, setEditedBook] = useState<Partial<Book>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Fetch book data
  const { data: book, isLoading, error } = useQuery<Book>({
    queryKey: [`/api/books/${bookId}`],
    enabled: !!bookId,
  });
  
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
    const { name, value, type } = e.target;
    
    // For number fields, convert the string value to a number or null for empty strings
    const processedValue = type === 'number' && value !== '' ? parseInt(value, 10) : value;
    
    setEditedBook(prev => ({
      ...prev,
      [name]: processedValue,
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
  
  if (isLoading) {
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
      
      {/* Book content in ekz-Informationsdienst format */}
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="p-6">
            {isEditing ? (
              <div className="space-y-4">
                {/* Book details form in the ekz-Informationsdienst layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <label className="text-sm font-medium text-neutral-700">{t('isbn')}</label>
                    <Input 
                      name="isbn"
                      value={editedBook.isbn || ''}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('publisher')}</label>
                    <Input 
                      name="publisher"
                      value={editedBook.publisher || ''}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('publishedYear')}</label>
                    <Input 
                      name="publishedYear"
                      type="number"
                      value={editedBook.publishedYear || ''}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('pages')}</label>
                    <Input 
                      name="pageCount"
                      type="number"
                      value={editedBook.pageCount || ''}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('dimensions')}</label>
                    <Input 
                      name="dimensions"
                      value={editedBook.dimensions || ''}
                      onChange={handleInputChange}
                      className="w-full"
                      placeholder="e.g. 21 x 15 cm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('binding')}</label>
                    <Input 
                      name="binding"
                      value={editedBook.binding || ''}
                      onChange={handleInputChange}
                      className="w-full"
                      placeholder="e.g. Festeinband, Taschenbuch"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('edition')}</label>
                    <Input 
                      name="edition"
                      value={editedBook.edition || ''}
                      onChange={handleInputChange}
                      className="w-full"
                      placeholder="e.g. 1. Auflage"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">{t('location')}</label>
                    <Input 
                      name="location"
                      value={editedBook.location || ''}
                      onChange={handleInputChange}
                      className="w-full"
                      placeholder="e.g. München, Berlin"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">{t('illustrator')}</label>
                  <Input 
                    name="illustrator"
                    value={
                      editedBook.contributors && 
                      Array.isArray(editedBook.contributors) && 
                      editedBook.contributors.length > 0
                        ? editedBook.contributors
                            .filter(c => 
                              typeof c === 'object' && 
                              c !== null && 
                              'role' in c && 
                              typeof c.role === 'string' && 
                              c.role.toLowerCase().includes('illustr')
                            )
                            .map(c => (typeof c === 'object' && c !== null && 'name' in c && typeof c.name === 'string') ? c.name : '')
                            .filter(Boolean)
                            .join(', ')
                        : ''
                    }
                    onChange={(e) => {
                      const illustratorName = e.target.value;
                      let contributors: Array<{role: string, name: string}> = [];
                      
                      // If we have existing contributors, filter out illustrators and keep others
                      if (editedBook.contributors && Array.isArray(editedBook.contributors)) {
                        contributors = editedBook.contributors
                          .filter(c => 
                            typeof c === 'object' && 
                            c !== null && 
                            'role' in c && 
                            typeof c.role === 'string' && 
                            !c.role.toLowerCase().includes('illustr')
                          ) as Array<{role: string, name: string}>;
                      }
                      
                      // Add new illustrator if provided
                      if (illustratorName.trim()) {
                        contributors.push({
                          role: 'illustrator',
                          name: illustratorName.trim()
                        });
                      }
                      
                      setEditedBook(prev => ({
                        ...prev,
                        contributors
                      }));
                    }}
                    className="w-full"
                    placeholder="e.g. Maria Schmidt"
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
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">{t('review')}</label>
                  <Textarea 
                    name="review"
                    value={editedBook.review || ''}
                    onChange={handleInputChange}
                    className="w-full min-h-[150px]"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* ASB Classification and catalog numbers at top */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col items-start">
                    {book.secondaryClassification && (
                      <span className="text-sm font-bold">
                        ASB: {book.secondaryClassification}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end">
                    {book.catalogNumber && (
                      <span className="text-sm font-bold">
                        {book.catalogNumber}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Main book information section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {/* Left column - Cover image */}
                  <div className="md:col-span-1">
                    {book.coverImageUrl ? (
                      <div className="aspect-[2/3] overflow-hidden rounded-md">
                        <img 
                          src={book.coverImageUrl} 
                          alt={book.title} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[2/3] flex items-center justify-center bg-neutral-100 rounded-md">
                        <Bookmark className="h-12 w-12 text-neutral-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Right column - Formatted bibliographic information */}
                  <div className="md:col-span-2">
                    {/* Author and Title Line */}
                    <div className="mb-4">
                      <p className="font-bold mb-1">
                        {book.author && book.author.includes(',') ? 
                          book.author : 
                          book.author?.split(' ').length > 1 ? 
                            `${book.author?.split(' ').pop()}, ${book.author?.split(' ').slice(0, -1).join(' ')}` : 
                            book.author}:
                      </p>
                      
                      <p className="font-medium">
                        {book.title} / {book.author}
                        {book.contributors && 
                          Array.isArray(book.contributors) && 
                          book.contributors.length > 0 && 
                          book.contributors.some(c => 
                            typeof c === 'object' && 
                            c !== null && 
                            'role' in c && 
                            typeof c.role === 'string' && 
                            c.role.toLowerCase().includes('illustr')
                          ) ? 
                          `; ${book.contributors
                            .filter(c => 
                              typeof c === 'object' && 
                              c !== null && 
                              'role' in c && 
                              typeof c.role === 'string' && 
                              c.role.toLowerCase().includes('illustr')
                            )
                            .map(c => (typeof c === 'object' && c !== null && 'name' in c) ? c.name : '')
                            .filter(Boolean)
                            .join(', ')
                          }` : ''}
                        .
                      </p>
                    </div>
                    
                    {/* Publication Information */}
                    <p className="mb-4">
                      {book.edition ? `${book.edition}. ` : ''}
                      {book.location ? `- ${book.location}: ` : '- '}
                      {book.publisher ? book.publisher : ''}
                      {book.publishedYear ? `, ${book.publishedYear}` : ''}
                      {book.pageCount ? `. - ${book.pageCount} ${t('pages')}` : ''}
                      {book.dimensions ? ` ; ${book.dimensions}` : ''}
                      {book.series ? ` (${book.series})` : ''}
                    </p>
                    
                    {/* ISBN, Binding, Price */}
                    <p className="mb-6">
                      {book.isbn ? `ISBN ${formatISBN(book.isbn)}` : ''}
                      {book.binding ? ` : ${book.binding}` : ''}
                      {book.price ? ` : EUR ${book.price}` : ''}
                    </p>
                    
                    {/* Summary and Review */}
                    <div className="mb-6">
                      <div className="prose prose-neutral max-w-none">
                        {/* Combined Summary and Review with | separator */}
                        {(book.summary || book.review) ? (
                          <p className="text-neutral-700 whitespace-pre-line">
                            {book.summary || ''}
                            {book.summary && book.review && ' | '}
                            {book.review || ''}
                          </p>
                        ) : (
                          <p className="text-neutral-700 whitespace-pre-line">
                            {t('noSummaryAvailable')}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Genres and Themes */}
                    {(Array.isArray(book.genres) && book.genres.length > 0) || (Array.isArray(book.themes) && book.themes.length > 0) ? (
                      <div className="mb-6">
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(book.genres) && book.genres.map((genre: string, index: number) => (
                            <Badge key={`genre-${index}`} variant="outline" className="bg-primary/10">
                              {genre}
                            </Badge>
                          ))}
                          
                          {Array.isArray(book.themes) && book.themes.map((theme: any, index: number) => {
                            // Handle both string and object themes
                            const themeText = typeof theme === 'string' 
                              ? theme 
                              : (theme.theme || theme.description || JSON.stringify(theme));
                            
                            return (
                              <Badge key={`theme-${index}`} variant="secondary" className="bg-secondary/10">
                                {themeText}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                
                {/* Bottom section with ID categories and reviewer */}
                <div className="flex flex-wrap justify-between items-end mt-4 border-t pt-4">
                  <div className="flex flex-col items-start">
                    {book.interestCategory && (
                      <p className="font-bold mb-1">{book.interestCategory}</p>
                    )}
                    
                    {book.idBNumber && (
                      <p className="text-sm">{book.idBNumber}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end">
                    {book.reviewerName && (
                      <p className="text-sm">{book.reviewerName}</p>
                    )}
                  </div>
                </div>
                
                {/* Barcode placeholder and footer */}
                <div className="flex flex-col items-center mt-8">
                  <div className="w-64 h-12 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 mx-auto mb-1 flex items-center justify-center">
                    {/* This is where a barcode would appear */}
                    <span className="text-xs text-gray-500">{book.catalogNumber || book.isbn}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">ekz-Informationsdienst</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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