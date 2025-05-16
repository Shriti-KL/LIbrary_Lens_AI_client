import React, { useState } from 'react';
import { Book } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Edit, ExternalLink, Save } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import BatchBookEditor from './BatchBookEditor';

interface BatchItemWithResult {
  id: string;
  status: string;
  result?: Partial<Book>;
  saved?: boolean;
  editing?: boolean;
}

interface BatchBookSlideshowProps {
  items: BatchItemWithResult[];
  onSave: (book: Partial<Book>) => void;
  onEdit: (itemId: string, editing: boolean) => void;
  onUpdateBook: (itemId: string, book: Partial<Book>) => void;
  onViewDetails?: (book: Partial<Book>) => void;
}

export default function BatchBookSlideshow({ 
  items, 
  onSave, 
  onEdit, 
  onUpdateBook,
  onViewDetails
}: BatchBookSlideshowProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Filter only successful, complete items that have results
  const validItems = items.filter(item => 
    item.status === 'complete' && 
    item.result && 
    !item.saved
  );
  
  // If no valid items, show message
  if (validItems.length === 0) {
    return null;
  }
  
  const currentItem = validItems[currentIndex];
  const book = currentItem?.result;
  
  if (!book) return null;
  
  const goToPrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  };
  
  const goToNext = () => {
    setCurrentIndex(prev => (prev < validItems.length - 1 ? prev + 1 : prev));
  };
  
  const handleSave = () => {
    onSave(book);
  };
  
  const handleEditComplete = (updatedBook: Partial<Book>) => {
    onUpdateBook(currentItem.id, updatedBook);
    onEdit(currentItem.id, false);
    onSave(updatedBook);
  };
  
  const fieldDisplayOrder = [
    'title', 'subtitle', 'author', 'mainAuthor', 'additionalAuthors', 
    'publisher', 'publicationYear', 'publicationPlace', 'pageCount', 
    'isbn', 'edition', 'dimensions', 'price', 'binding', 'language',
    'summary', 'review', 'interestCategory', 'classificationNumber'
  ];
  
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-primary-dark">
          {t('processedBooks')} ({currentIndex + 1}/{validItems.length})
        </h3>
        <div className="flex items-center gap-2">
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
            disabled={currentIndex === validItems.length - 1}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
      
      <Card className="border-primary/20 shadow-md overflow-hidden">
        {currentItem.editing ? (
          <BatchBookEditor 
            book={book}
            onSave={handleEditComplete}
            onCancel={() => onEdit(currentItem.id, false)}
          />
        ) : (
          <>
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-serif font-semibold text-primary-dark">
                    {book.title || t('untitled')}
                  </h2>
                  {book.subtitle && (
                    <p className="text-sm text-neutral-600 mt-1">{book.subtitle}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-1 text-primary hover:text-primary-dark hover:bg-primary/10"
                    onClick={() => onViewDetails?.(book)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('viewDetails')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6 pb-4 px-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Book Classifications */}
                {(book.interestCategory || book.classificationNumber) && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {book.interestCategory && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <h5 className="text-sm font-medium text-blue-700 mb-1">{t('interestCategory')}</h5>
                        <p className="text-blue-800">{book.interestCategory}</p>
                      </div>
                    )}
                    {book.classificationNumber && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                        <h5 className="text-sm font-medium text-amber-700 mb-1">{t('classificationNumber')}</h5>
                        <p className="text-amber-800">{book.classificationNumber}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Book Details List */}
                <div className="space-y-4">
                  {fieldDisplayOrder.map(field => {
                    const value = book[field as keyof typeof book];
                    if (!value && value !== 0) return null;
                    
                    // Skip fields that are already shown above
                    if (['title', 'subtitle', 'interestCategory', 'classificationNumber'].includes(field)) {
                      return null;
                    }
                    
                    return (
                      <div key={field} className="border-b border-gray-100 pb-3 last:border-0">
                        <h4 className="text-sm font-medium text-neutral-500 mb-1">
                          {t(field)}
                        </h4>
                        <div className="text-neutral-800 whitespace-pre-wrap">
                          {typeof value === 'object' ? JSON.stringify(value) : 
                           field === 'additionalAuthors' && Array.isArray(value) ? value.join(', ') : 
                           String(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-gray-100 bg-gray-50/50 justify-between py-4">
              <Button
                variant="outline"
                onClick={() => onEdit(currentItem.id, true)}
                className="flex items-center gap-1"
              >
                <Edit className="h-4 w-4" />
                {t('edit')}
              </Button>
              
              <Button
                onClick={handleSave}
                className="flex items-center gap-1"
              >
                <Save className="h-4 w-4" />
                {t('saveToLibrary')}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}