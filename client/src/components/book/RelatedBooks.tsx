import React, { useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useGoogleBooks } from '@/hooks/use-google-books';
import { Book } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BookOpen } from 'lucide-react';
import BookItem from './BookItem';

interface RelatedBooksProps {
  book: Partial<Book>;
  className?: string;
  onBookClick?: (bookInfo: any) => void;
}

export default function RelatedBooks({ book, className, onBookClick }: RelatedBooksProps) {
  const { t } = useLanguage();
  const { findSimilarBooksMutation } = useGoogleBooks();
  
  // Fetch similar books when book data is available
  useEffect(() => {
    if (book && (book.title || book.author || book.genres)) {
      findSimilarBooksMutation.mutate(book);
    }
  }, [book.id, book.title, book.author, JSON.stringify(book.genres)]);
  
  // Handle book item click
  const handleBookClick = (bookInfo: any) => {
    if (onBookClick) {
      onBookClick(bookInfo);
    }
  };
  
  // If no book data, return early
  if (!book || (!book.title && !book.author && !book.genres)) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-serif">{t('similarBooks')}</CardTitle>
      </CardHeader>
      
      <CardContent>
        {findSimilarBooksMutation.isPending ? (
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm text-neutral-500">{t('loading')}</p>
          </div>
        ) : findSimilarBooksMutation.isSuccess && Array.isArray(findSimilarBooksMutation.data) ? (
          findSimilarBooksMutation.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {findSimilarBooksMutation.data.map((item: any, index: number) => {
                const volumeInfo = item.volumeInfo || {};
                return (
                  <div key={item.id || index} onClick={() => handleBookClick(item)}>
                    <BookItem
                      book={{
                        title: volumeInfo.title || 'Unknown',
                        author: volumeInfo.authors ? volumeInfo.authors[0] : 'Unknown',
                        coverImageUrl: volumeInfo.imageLinks?.thumbnail
                      }}
                      onClick={onBookClick ? () => handleBookClick(item) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <BookOpen className="h-6 w-6 mx-auto text-neutral-300 mb-2" />
              <p className="text-sm text-neutral-500">No similar books found</p>
            </div>
          )
        ) : (
          <div className="text-center py-6">
            <BookOpen className="h-6 w-6 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm text-neutral-500">Search for books to see related titles</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}