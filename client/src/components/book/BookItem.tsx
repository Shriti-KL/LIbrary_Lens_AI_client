import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface BookItemProps {
  book: {
    title: string;
    author: string;
    coverImageUrl?: string;
  };
  onClick?: () => void;
}

export default function BookItem({ book, onClick }: BookItemProps) {
  return (
    <Card 
      className={`overflow-hidden transition-all hover:shadow-md hover:scale-[1.02] border border-border ${onClick ? 'cursor-pointer' : ''}`} 
      onClick={onClick}
    >
      <div className="aspect-[2/3] overflow-hidden bg-muted">
        {book.coverImageUrl ? (
          <img 
            src={book.coverImageUrl} 
            alt={book.title} 
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium text-sm text-center line-clamp-1 text-foreground" title={book.title}>
          {book.title}
        </h3>
        <p className="text-xs text-muted-foreground text-center line-clamp-1 mt-1" title={book.author}>
          {book.author}
        </p>
      </CardContent>
    </Card>
  );
}
