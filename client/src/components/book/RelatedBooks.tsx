import React from 'react';
import { useLanguage } from '@/hooks/use-language';
import { useGoogleBooks } from '@/hooks/use-google-books';
import { cn } from '@/lib/utils';
import { Book as BookType } from '@shared/schema';
import { Book, Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatedBooksProps {
  book: Partial<BookType>;
  className?: string;
  onBookClick?: (bookInfo: any) => void;
}

export default function RelatedBooks({ book, className, onBookClick }: RelatedBooksProps) {
  const { t } = useLanguage();
  
  const { similarBooksMutation } = useGoogleBooks();
  
  // Fetch similar books when book changes
  React.useEffect(() => {
    if (book && (book.title || book.author)) {
      similarBooksMutation.mutate({
        title: book.title || '',
        author: book.author || ''
      });
    }
  }, [book]);
  
  // Handle book selection
  const handleBookClick = (relatedBook: any) => {
    if (onBookClick) {
      onBookClick(relatedBook);
    }
  };
  
  if (!book || !(book.title || book.author)) {
    return null;
  }
  
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {t('similarBooks')}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {similarBooksMutation.isPending ? (
          <div className="flex items-center justify-center p-6">
            <Loader className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ) : similarBooksMutation.data && similarBooksMutation.data.length > 0 ? (
          <div className="divide-y divide-border">
            {similarBooksMutation.data.slice(0, 5).map((relatedBook: any) => (
              <div 
                key={relatedBook.id}
                className="flex p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => handleBookClick(relatedBook)}
              >
                {relatedBook.thumbnailUrl ? (
                  <div className="mr-3 flex-shrink-0">
                    <img 
                      src={relatedBook.thumbnailUrl} 
                      alt={relatedBook.title} 
                      className="w-10 h-auto object-cover rounded-sm"
                    />
                  </div>
                ) : (
                  <div className="mr-3 flex-shrink-0 w-10 h-14 bg-muted flex items-center justify-center rounded-sm">
                    <Book className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                
                <div className="min-w-0">
                  <h4 className="text-xs font-medium line-clamp-2">{relatedBook.title}</h4>
                  {relatedBook.author && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{relatedBook.author}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t('noResults')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}