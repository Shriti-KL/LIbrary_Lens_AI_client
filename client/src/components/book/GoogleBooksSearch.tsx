import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useGoogleBooks, GoogleBookSearchParams } from '@/hooks/use-google-books';
import { Book } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import BookItem from './BookItem';

interface GoogleBooksSearchProps {
  onBookSelect?: (book: any) => void;
  className?: string;
}

export default function GoogleBooksSearch({ onBookSelect, className }: GoogleBooksSearchProps) {
  const { t } = useLanguage();
  const { searchBooksMutation } = useGoogleBooks();
  
  const [searchParams, setSearchParams] = useState<GoogleBookSearchParams>({
    query: '',
    maxResults: 8
  });
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParams(prev => ({
      ...prev,
      query: e.target.value
    }));
  };
  
  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchParams.query) return;
    
    searchBooksMutation.mutate(searchParams);
  };
  
  // Handle book selection
  const handleBookSelect = (book: any) => {
    if (onBookSelect) {
      // Extract relevant book information
      const volumeInfo = book.volumeInfo || {};
      const bookData = {
        title: volumeInfo.title || '',
        author: volumeInfo.authors ? volumeInfo.authors[0] : '',
        publisher: volumeInfo.publisher || '',
        publishedYear: volumeInfo.publishedDate ? 
          parseInt(volumeInfo.publishedDate.substring(0, 4)) : null,
        pageCount: volumeInfo.pageCount || null,
        coverImageUrl: volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : null,
        isbn: volumeInfo.industryIdentifiers ? 
          volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13" || id.type === "ISBN_10")?.identifier : null,
        description: volumeInfo.description || '',
      };
      
      onBookSelect(bookData);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl font-serif">{t('searchBooks')}</CardTitle>
        <CardDescription>
          Search for books using Google Books API
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex space-x-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={`${t('search')}...`}
              className="pl-8"
              value={searchParams.query}
              onChange={handleSearchChange}
            />
          </div>
          <Button 
            type="submit" 
            disabled={!searchParams.query || searchBooksMutation.isPending}
          >
            {searchBooksMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t('search')}
          </Button>
        </form>
        
        {/* Search Results */}
        {searchBooksMutation.isPending ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-sm text-neutral-500">{t('loading')}</p>
          </div>
        ) : searchBooksMutation.isSuccess && searchBooksMutation.data ? (
          <div>
            <h3 className="text-sm font-medium text-neutral-500 mb-3">
              {searchBooksMutation.data.length === 0 
                ? t('noResults') 
                : `${searchBooksMutation.data.length} ${t('results')}`}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {searchBooksMutation.data.map((book: any, index: number) => {
                const volumeInfo = book.volumeInfo || {};
                return (
                  <div 
                    key={book.id || index} 
                    onClick={() => handleBookSelect(book)}
                    className="cursor-pointer"
                  >
                    <BookItem 
                      book={{
                        title: volumeInfo.title || 'Unknown',
                        author: volumeInfo.authors ? volumeInfo.authors[0] : 'Unknown',
                        coverImageUrl: volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : undefined
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        
        {/* No Search Yet Message */}
        {!searchBooksMutation.isPending && !searchBooksMutation.isSuccess && (
          <div className="text-center py-8 text-neutral-500">
            <Search className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
            <p>Enter a search term to find books</p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="text-xs text-neutral-500">
        Data provided by Google Books API
      </CardFooter>
    </Card>
  );
}