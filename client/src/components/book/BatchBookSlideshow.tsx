import React, { useState } from 'react';
import { Book } from '@shared/schema';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Save, Edit, X, AlertTriangle, Check } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import BookCoverPlaceholder from './BookCoverPlaceholder';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import BatchBookEditor from './BatchBookEditor';

interface BatchBookSlideshowProps {
  batchResults: any[];
  onSave: (book: Partial<Book>) => void;
  onEdit: (itemId: string, editing: boolean) => void;
}

export default function BatchBookSlideshow({ 
  batchResults,
  onSave,
  onEdit
}: BatchBookSlideshowProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Filter out already saved books
  const displayableBooks = batchResults.filter(item => !item.saved || item.status === 'error');
  
  // If no books to display
  if (displayableBooks.length === 0) {
    return (
      <Card className="shadow-sm border border-neutral-200">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-serif leading-6 font-medium text-primary-dark">
                {t('batchResults')}
              </h3>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <Check className="h-10 w-10 text-green-500 p-2 bg-green-50 rounded-full" />
            <h3 className="text-lg font-medium">{t('allBooksSaved')}</h3>
            <p className="text-sm text-gray-500">
              {t('allBooksHaveBeenSavedToLibrary')}
            </p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => window.location.href = '/archives'}
            >
              {t('viewArchives')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentBook = displayableBooks[currentIndex];
  const totalBooks = displayableBooks.length;
  
  // Navigation functions
  const goToNext = () => {
    if (currentIndex < totalBooks - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Handle save for the current book
  const handleSaveBook = (book: Partial<Book>) => {
    onSave(book);
    
    // If this was the last book, stay on same index (which will now show the completed message)
    // Otherwise, move to the next book
    if (currentIndex < totalBooks - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <Card className="shadow-sm border border-neutral-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-serif leading-6 font-medium text-primary-dark">
              {t('batchResults')}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">
              {t('book')} {currentIndex + 1} {t('of')} {totalBooks}
            </p>
          </div>
          <div className="flex gap-2">
            {currentBook.status === 'error' ? (
              <Badge variant="destructive" className="px-3">
                {t('error')}
              </Badge>
            ) : currentBook.editing ? (
              <Badge variant="outline" className="bg-blue-100 text-blue-700 font-medium px-3">
                {t('editing')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-green-100 text-green-700 font-medium px-3">
                {t('ready')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <Separator className="m-0" />
      
      <CardContent className="px-6 pt-5 pb-6">
        {currentBook.status === 'error' ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-3" />
            <h3 className="text-lg font-medium text-red-700">{t('processingError')}</h3>
            <p className="mt-2 text-sm text-gray-600 max-w-md">
              {currentBook.error || t('couldNotProcessBook')}
            </p>
          </div>
        ) : currentBook.editing ? (
          <BatchBookEditor 
            book={currentBook.result}
            onSave={(editedBook) => {
              handleSaveBook(editedBook);
              onEdit(currentBook.id, false);
            }}
            onCancel={() => onEdit(currentBook.id, false)}
          />
        ) : (
          <div className="space-y-6">
            {/* Book cover and basic info */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/3 flex justify-center">
                <div className="w-[200px]">
                  {currentBook.result?.coverImageUrl ? (
                    <img 
                      src={currentBook.result.coverImageUrl} 
                      alt={`${currentBook.result.title} cover`}
                      className="object-cover w-full rounded-lg shadow-md border border-neutral-200" 
                    />
                  ) : (currentBook.result?.coverImageData) ? (
                    <img 
                      src={currentBook.result.coverImageData} 
                      alt={`${currentBook.result.title} cover`}
                      className="object-cover w-full rounded-lg shadow-md border border-neutral-200" 
                    />
                  ) : (
                    <div className="w-full">
                      <BookCoverPlaceholder 
                        title={currentBook.result?.title || ''} 
                        author={currentBook.result?.author || ''}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-full md:w-2/3">
                {/* Book Details */}
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-medium text-primary-dark">
                      {currentBook.result?.title}
                    </h2>
                    {currentBook.result?.subtitle && (
                      <p className="text-md text-gray-700 mt-1">
                        {currentBook.result.subtitle}
                      </p>
                    )}
                    <p className="text-md text-gray-600 mt-1">
                      {currentBook.result?.author}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Publication details */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">{t('publication')}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {currentBook.result?.publisher ? currentBook.result.publisher : t('unknownPublisher')}
                        {currentBook.result?.publicationYear && `, ${currentBook.result.publicationYear}`}
                      </p>
                    </div>
                    
                    {/* ISBN */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">ISBN</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {currentBook.result?.isbn}
                      </p>
                    </div>
                    
                    {/* Pages */}
                    {currentBook.result?.pageCount && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700">{t('pages')}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {currentBook.result.pageCount}
                        </p>
                      </div>
                    )}
                    
                    {/* Language */}
                    {currentBook.result?.language && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700">{t('language')}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {currentBook.result.language}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Summary section */}
                  {currentBook.result?.summary && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-700">{t('summary')}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-5">
                        {currentBook.result.summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Review section */}
            {currentBook.result?.review && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">{t('review')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {currentBook.result.review}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <Separator className="m-0" />
      
      <CardFooter className="flex justify-between p-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNext}
            disabled={currentIndex === totalBooks - 1}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          {!currentBook.editing && !currentBook.saved && currentBook.status !== 'error' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => onEdit(currentBook.id, true)}
              >
                <Edit className="h-4 w-4" />
                {t('edit')}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-1 bg-primary hover:bg-primary-dark"
                onClick={() => handleSaveBook(currentBook.result)}
              >
                <Save className="h-4 w-4" />
                {t('saveToLibrary')}
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}