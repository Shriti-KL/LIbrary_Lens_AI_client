import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Book } from '@shared/schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BookResult from '@/components/book/BookResult';
import { Search, Eye, Edit, Trash2, BookX, X } from 'lucide-react';

export default function Archives() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [viewBookId, setViewBookId] = useState<number | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Check for view parameter in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    if (viewId) {
      setViewBookId(Number(viewId));
      setDetailDialogOpen(true);
    }
  }, []);
  
  // Fetch books
  const { data: books = [], isLoading } = useQuery({
    queryKey: ['/api/books'],
  });
  
  // Delete book mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/books/${id}`);
      return id;
    },
    onSuccess: () => {
      toast({
        title: 'Book Deleted',
        description: 'The book has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      setBookToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would query the API with the search term
    // For now, we'll use client-side filtering
  };
  
  // Filter books based on search query
  const filteredBooks = searchQuery.trim() === '' 
    ? books
    : books.filter((book: Book) => 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  
  // Handle delete book
  const handleDeleteBook = (book: Book) => {
    setBookToDelete(book);
  };
  
  // Confirm deletion
  const confirmDelete = () => {
    if (bookToDelete) {
      deleteMutation.mutate(bookToDelete.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Page Title */}
      <div className="mb-8 border-b border-neutral-200 pb-3">
        <h1 className="text-2xl font-serif font-semibold text-primary-dark">
          {t('bookArchive')}
        </h1>
        <p className="text-neutral-600 mt-1">View, search, and manage your analyzed books</p>
      </div>
      
      <Card>
        
        <CardContent>
          {/* Search */}
          <form onSubmit={handleSearch} className="flex space-x-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={`${t('search')}...`}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit">{t('search')}</Button>
          </form>
          
          {/* Books Table */}
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="animate-spin mx-auto h-8 w-8 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="mt-2 text-sm text-neutral-500">{t('loading')}</p>
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '60px' }}>{/* Cover */}</TableHead>
                    <TableHead>{t('title')}</TableHead>
                    <TableHead>{t('author')}</TableHead>
                    <TableHead>{t('isbn')}</TableHead>
                    <TableHead>{t('genres')}</TableHead>
                    <TableHead style={{ width: '120px' }}>{/* Actions */}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBooks.map((book: Book) => (
                    <TableRow key={book.id}>
                      <TableCell>
                        <div className="h-12 w-9 bg-neutral-100 rounded overflow-hidden">
                          {book.coverImageUrl ? (
                            <img 
                              src={book.coverImageUrl} 
                              alt={book.title} 
                              className="h-full w-full object-cover" 
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{book.title}</TableCell>
                      <TableCell>{book.author}</TableCell>
                      <TableCell>{book.isbn || 'N/A'}</TableCell>
                      <TableCell>
                        {Array.isArray(book.genres) && book.genres.length > 0 
                          ? book.genres.slice(0, 2).join(', ') + (book.genres.length > 2 ? '...' : '')
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title={t('view')}
                            onClick={() => window.location.href = `/archives?view=${book.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive" 
                            title={t('delete')}
                            onClick={() => handleDeleteBook(book)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-20 text-center border rounded-md">
              <BookX className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 text-lg font-medium text-neutral-800">
                {t('noResults')}
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                {searchQuery.trim() !== '' 
                  ? `No books matching "${searchQuery}"`
                  : 'No books have been analyzed yet'
                }
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <div className="text-sm text-neutral-500">
            {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'} found
          </div>
        </CardFooter>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!bookToDelete} onOpenChange={(open) => !open && setBookToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm')} {t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{bookToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Book Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={(open) => {
        setDetailDialogOpen(open);
        if (!open) {
          // Remove the view parameter from URL when dialog is closed
          window.history.replaceState({}, '', '/archives');
          setViewBookId(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">
              {books.find((b: Book) => b.id === viewBookId)?.title || 'Book Details'}
            </DialogTitle>
            <div className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" onClick={() => setDetailDialogOpen(false)} />
            </div>
          </DialogHeader>
          
          {viewBookId && books.length > 0 && (
            <div className="mt-6">
              {/* Get the book object from the books array */}
              {(() => {
                const book = books.find((b: Book) => b.id === viewBookId);
                if (!book) return <div className="text-center py-10">Book not found</div>;
                
                return (
                  <div className="grid grid-cols-1 gap-6 py-4">
                    {/* Book cover and metadata */}
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className="sm:w-1/3">
                        {book.coverImageUrl ? (
                          <img 
                            src={book.coverImageUrl} 
                            alt={`${book.title} cover`} 
                            className="object-cover w-full h-64 rounded-lg shadow-md" 
                          />
                        ) : (
                          <div className="w-full h-64 rounded-lg shadow-md bg-blue-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="sm:w-2/3">
                        <h3 className="text-xl font-serif font-bold text-neutral-800">{book.title}</h3>
                        <p className="text-lg text-neutral-600 mt-1">{book.author}</p>
                        
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-neutral-500">{t('isbn')}</h4>
                            <p className="mt-1 text-sm text-neutral-800">{book.isbn || 'N/A'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-neutral-500">{t('published')}</h4>
                            <p className="mt-1 text-sm text-neutral-800">{book.publishedYear || 'N/A'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-neutral-500">{t('publisher')}</h4>
                            <p className="mt-1 text-sm text-neutral-800">{book.publisher || 'N/A'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-neutral-500">{t('pages')}</h4>
                            <p className="mt-1 text-sm text-neutral-800">{book.pageCount || 'N/A'}</p>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-neutral-500">{t('genres')}</h4>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Array.isArray(book.genres) && book.genres.length > 0 ? (
                              book.genres.map((genre, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {genre}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-neutral-500">N/A</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Summary */}
                    {book.summary && (
                      <div>
                        <h4 className="text-sm font-medium text-neutral-600 uppercase tracking-wider">{t('summary')}</h4>
                        <p className="mt-2 text-neutral-700">{book.summary}</p>
                      </div>
                    )}
                    
                    {/* Themes */}
                    {Array.isArray(book.themes) && book.themes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-neutral-600 uppercase tracking-wider">{t('themes')}</h4>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {book.themes.map((theme, index) => (
                            <div key={index} className="flex gap-1.5 items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                              <span className="text-sm">{theme.name}</span>
                              {theme.description && (
                                <span className="text-xs text-blue-500">{theme.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Reading Level */}
                    {book.readingLevel && (
                      <div>
                        <h4 className="text-sm font-medium text-neutral-600 uppercase tracking-wider">{t('readingLevel')}</h4>
                        <div className="mt-2 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-neutral-700">Age Range</p>
                              <p className="text-sm text-neutral-600">{book.readingLevel.ageRange}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-700">Grade Level</p>
                              <p className="text-sm text-neutral-600">{book.readingLevel.gradeLevel}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-700">Complexity</p>
                              <p className="text-sm text-neutral-600">{book.readingLevel.complexity}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-700">Lexile Measure</p>
                              <p className="text-sm text-neutral-600">{book.readingLevel.lexileMeasure || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Catalog Entry */}
                    {book.catalogEntry && (
                      <div>
                        <h4 className="text-sm font-medium text-neutral-600 uppercase tracking-wider">{t('catalogEntry')}</h4>
                        <div className="mt-2 p-4 bg-blue-50/80 rounded-lg font-mono text-sm whitespace-pre-wrap border border-blue-100 shadow-sm">
                          {book.catalogEntry}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setDetailDialogOpen(false)}
            >
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
