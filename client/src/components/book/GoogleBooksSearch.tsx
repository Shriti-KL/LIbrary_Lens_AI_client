import React, { useState, useCallback } from 'react';
import { useGoogleBooks } from '@/hooks/use-google-books';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { Search, BookOpen, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { debounce } from 'lodash';

interface GoogleBooksSearchProps {
  onBookSelect?: (book: any) => void;
  className?: string;
}

export default function GoogleBooksSearch({ onBookSelect, className }: GoogleBooksSearchProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'general' | 'isbn' | 'title' | 'author'>('general');
  
  // Get search mutations
  const { searchMutation, searchByISBNMutation, searchBooksMutation } = useGoogleBooks();
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value) {
      debouncedSearch(e.target.value, searchType);
    }
  };
  
  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
  };
  
  // Handle search tab change
  const handleSearchTypeChange = (value: string) => {
    setSearchType(value as 'general' | 'isbn' | 'title' | 'author');
    if (searchTerm) {
      debouncedSearch(searchTerm, value as 'general' | 'isbn' | 'title' | 'author');
    }
  };
  
  // Execute search based on type
  const executeSearch = useCallback((term: string, type: 'general' | 'isbn' | 'title' | 'author') => {
    if (!term.trim()) return;
    
    switch (type) {
      case 'isbn':
        searchByISBNMutation.mutate(term.trim());
        break;
      case 'title':
        searchMutation.mutate({ title: term.trim() });
        break;
      case 'author':
        searchMutation.mutate({ author: term.trim() });
        break;
      default:
        searchMutation.mutate({ query: term.trim() });
        break;
    }
  }, [searchMutation, searchByISBNMutation]);
  
  // Debounced search to prevent too many requests
  const debouncedSearch = useCallback(
    debounce((term: string, type: 'general' | 'isbn' | 'title' | 'author') => {
      executeSearch(term, type);
    }, 500),
    [executeSearch]
  );
  
  // Handle book selection
  const handleBookSelect = (book: any) => {
    if (onBookSelect) {
      onBookSelect(book);
    }
  };
  
  // Determine if searching
  const isSearching = searchMutation.isPending || searchByISBNMutation.isPending;
  
  // Get search results based on the active search type
  const searchResults = searchType === 'isbn' 
    ? (searchByISBNMutation.data ? [searchByISBNMutation.data] : [])
    : searchMutation.data || [];
  
  return (
    <div className={cn("space-y-4", className)}>
      <Tabs defaultValue="general" onValueChange={handleSearchTypeChange}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="general">{t('search')}</TabsTrigger>
          <TabsTrigger value="title">{t('title')}</TabsTrigger>
          <TabsTrigger value="author">{t('author')}</TabsTrigger>
          <TabsTrigger value="isbn">{t('isbn')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={t('search')}
              className="pr-10"
            />
            {searchTerm && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="title" className="space-y-4">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={t('title')}
              className="pr-10"
            />
            {searchTerm && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="author" className="space-y-4">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={t('author')}
              className="pr-10"
            />
            {searchTerm && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="isbn" className="space-y-4">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={t('isbn')}
              className="pr-10"
            />
            {searchTerm && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Search Results */}
      <div className="min-h-[300px]">
        {isSearching ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Search className="h-12 w-12 text-muted-foreground animate-pulse mx-auto mb-4" />
              <p className="text-muted-foreground">{t('searching')}</p>
            </div>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-neutral-500">
                {searchResults.length} {t('resultCount')}
              </h3>
            </div>
            
            <div className="space-y-3">
              {searchResults.map((book: any) => (
                <Card 
                  key={book.id} 
                  className="overflow-hidden hover:border-primary transition-colors cursor-pointer"
                  onClick={() => handleBookSelect(book)}
                >
                  <CardContent className="p-0">
                    <div className="flex p-3">
                      {book.thumbnailUrl ? (
                        <div className="mr-4 flex-shrink-0">
                          <img 
                            src={book.thumbnailUrl} 
                            alt={book.title} 
                            className="w-16 h-auto object-cover rounded-sm"
                          />
                        </div>
                      ) : (
                        <div className="mr-4 flex-shrink-0 w-16 h-24 bg-muted flex items-center justify-center rounded-sm">
                          <BookOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-foreground line-clamp-2">{book.title}</h3>
                        {book.author && (
                          <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                        )}
                        {book.publisher && (
                          <p className="text-xs text-muted-foreground mt-1">{book.publisher}</p>
                        )}
                        {book.publishedYear && (
                          <p className="text-xs text-muted-foreground mt-1">{book.publishedYear}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : searchTerm && !isSearching ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-muted-foreground">{t('noResults')}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 border border-dashed rounded-md">
            <div className="text-center px-4">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Search for books to analyze and catalog
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}