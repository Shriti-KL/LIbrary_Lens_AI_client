import React, { useState } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Book } from '@shared/schema';
import { exportBookToPDF } from '@/lib/utils';
import { 
  Card, 
  CardContent, 
  CardFooter,
  CardHeader
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Save, Edit, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import BookCoverPlaceholder from './BookCoverPlaceholder';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface BookResultProps {
  book: Partial<Book>;
  isLoading: boolean;
  onSave: (book: Partial<Book>) => void;
  loadingSteps?: {
    metadata: { status: string; progress: number };
    summary: { status: string; progress: number };
    genres: { status: string; progress: number };
    themes: { status: string; progress: number };
    catalogEntry: { status: string; progress: number };
  };
}

export default function BookResult({ 
  book, 
  isLoading, 
  onSave,
  loadingSteps
}: BookResultProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editedBook, setEditedBook] = useState<Partial<Book>>(book || {});
  
  // Update editedBook when book changes or edit mode is toggled on
  React.useEffect(() => {
    setEditedBook(book || {});
  }, [book, isEditing]);

  // If still loading, show loading state
  if (isLoading && loadingSteps) {
    return (
      <Card className="h-full shadow-sm border border-neutral-200">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-serif leading-6 font-medium text-primary-dark">{t('results')}</h3>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">{t('insights')}</p>
            </div>
            <div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 font-medium px-3">
                {t('processing')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6">
          <div className="text-center py-6">
            <div className="animate-spin mx-auto h-12 w-12 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-primary-dark">{t('loading')}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t('insights')}</p>
            
            <div className="mt-8 max-w-xl mx-auto">
              {/* Loading progress for each step */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">{t('title')} & {t('author')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.metadata.status === 'complete' 
                        ? <span className="text-green-600">{t('complete')}</span>
                        : loadingSteps.metadata.status === 'in-progress'
                          ? <span className="text-amber-600">{t('processing')}</span>
                          : <span className="text-neutral-500">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.metadata.progress} className="w-full h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">{t('generateSummary')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.summary.status === 'complete' 
                        ? <span className="text-green-600">{t('complete')}</span>
                        : loadingSteps.summary.status === 'in-progress'
                          ? <span className="text-amber-600">{t('processing')}</span>
                          : <span className="text-neutral-500">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.summary.progress} className="w-full h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">{t('identifyGenres')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.genres.status === 'complete' 
                        ? <span className="text-green-600">{t('complete')}</span>
                        : loadingSteps.genres.status === 'in-progress'
                          ? <span className="text-amber-600">{t('processing')}</span>
                          : <span className="text-neutral-500">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.genres.progress} className="w-full h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">{t('extractThemes')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.themes.status === 'complete' 
                        ? <span className="text-green-600">{t('complete')}</span>
                        : loadingSteps.themes.status === 'in-progress'
                          ? <span className="text-amber-600">{t('processing')}</span>
                          : <span className="text-neutral-500">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.themes.progress} className="w-full h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">{t('generateCatalog')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.catalogEntry.status === 'complete' 
                        ? <span className="text-green-600">{t('complete')}</span>
                        : loadingSteps.catalogEntry.status === 'in-progress'
                          ? <span className="text-amber-600">{t('processing')}</span>
                          : <span className="text-neutral-500">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.catalogEntry.progress} className="w-full h-2" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no book data yet
  if (!book || !book.title) {
    return (
      <Card className="h-full flex flex-col shadow-sm border border-neutral-200">
        <CardHeader className="pb-2">
          <div>
            <h3 className="text-lg font-serif leading-6 font-medium text-primary-dark">{t('results')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">{t('insights')}</p>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center px-6">
          <div className="text-center py-10">
            <div className="mx-auto h-16 w-16 text-primary/30">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-medium text-primary-dark">Upload a Book Cover</h3>
            <p className="mt-2 text-sm text-neutral-600">Enter book details or upload a cover to get AI-powered analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // The ordered list of fields we want to display
  const orderedFields = [
    'classificationNumber', // ASB number
    'secondaryClassification', // Secondary classification
    'additionalClassificationNumbers', // Additional classification numbers
    'title',
    'subtitle',
    'author',
    'mainAuthor',
    'additionalAuthors',
    'statementOfResponsibility', // other contributors
    'edition',
    'publicationPlace',
    'publisher',
    'publicationYear',
    'pageCount', // Number of pages
    'illustrations',
    'dimensions',
    'isbn',
    'binding',
    'price',
    'summary',
    'review',
    'genres',
    'reviewerName', // name of reviewer
    'interestCategory', // IK (Interest Categories)
    'id', // ID
  ];

  // Fields we want to hide from display
  const fieldsToHide = ['publicationDate', 'coverImageUrl', 'preview', 'coverImageData'];
  
  // Get all remaining fields that aren't in orderedFields or fieldsToHide
  const remainingFields = Object.keys(book).filter(key => 
    !orderedFields.includes(key) && !fieldsToHide.includes(key)
  );

  // Final ordered fields, including essential fields that may not exist in the book object
  const finalOrderedFields = [
    ...orderedFields,
    ...remainingFields
  ];

  // Function to handle input change with data type conversion
  const handleInputChange = (key: string, value: any) => {
    // Convert certain fields to their proper types
    let processedValue = value;
    
    // Convert number fields
    if (['publicationYear', 'pageCount', 'id'].includes(key) && value !== null && value !== '') {
      processedValue = Number(value);
    }
    
    // Update the edited book
    setEditedBook(prev => ({
      ...prev,
      [key]: processedValue
    }));
  };

  // Function to save edited changes
  const handleSaveEdits = () => {
    // Save the edited book data
    onSave(editedBook);
    setIsEditing(false);
  };

  // Function to toggle edit mode
  const toggleEditMode = () => {
    if (isEditing) {
      // If we're exiting edit mode without saving, revert changes
      setEditedBook(book || {});
    } 
    setIsEditing(!isEditing);
  };

  // Book result display - Simple list of all data
  return (
    <Card className="shadow-sm border border-neutral-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-serif leading-6 font-medium text-primary-dark">{t('results')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">{t('insights')}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-700 font-medium px-3">
              {t('complete')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <Separator className="m-0" />

      <CardContent className="px-6 pt-5 pb-6">
        <div className="grid grid-cols-1 gap-8">
          {/* Book cover at the top */}
          <div className="flex justify-center">
            <div className="w-[200px]">
              {book.coverImageUrl ? (
                <img 
                  src={book.coverImageUrl} 
                  alt={`${book.title} cover`} 
                  className="object-cover w-full rounded-lg shadow-md border border-neutral-200" 
                />
              ) : (book as any).coverImageData ? (
                <img 
                  src={(book as any).coverImageData} 
                  alt={`${book.title} cover`} 
                  className="object-cover w-full rounded-lg shadow-md border border-neutral-200" 
                />
              ) : (
                <div className="w-full">
                  <BookCoverPlaceholder 
                    title={book.title || ''} 
                    author={book.author || ''}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Data displayed as a simple list or edit form depending on mode */}
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200/80">
            <div className="space-y-2">
              {finalOrderedFields.map(key => {
                // For essential fields, always show them even if they don't exist in the book object
                const essentialFields = ['reviewerName', 'interestCategory', 'id', 'classificationNumber', 'secondaryClassification'];
                const shouldDisplay = key in book || essentialFields.includes(key);
                
                if (!shouldDisplay) return null;
                
                // Skip ID from editing, as it's a system field
                const isEditable = key !== 'id';
                
                // Get the value (from the edited book when in edit mode)
                const sourceObject = isEditing ? editedBook : book;
                const displayValue = key in sourceObject ? sourceObject[key as keyof typeof sourceObject] : null;
                
                // Render edit fields or display values based on edit mode
                let renderedValue = null;
                
                if (isEditing && isEditable) {
                  // Render edit fields based on value type
                  if (Array.isArray(displayValue)) {
                    // For arrays, join with commas for editing
                    const arrayValue = displayValue.join(', ');
                    renderedValue = (
                      <Input
                        value={arrayValue}
                        onChange={(e) => handleInputChange(key, e.target.value.split(',').map(item => item.trim()))}
                        className="mt-1"
                        placeholder={`Enter ${key}`}
                      />
                    );
                  } else if (typeof displayValue === 'object' && displayValue !== null) {
                    // Complex objects aren't easily editable, show as JSON
                    renderedValue = <pre className="text-xs text-neutral-700 mt-1 overflow-auto max-h-[100px]">{JSON.stringify(displayValue, null, 2)}</pre>;
                  } else if (key === 'summary' || key === 'review') {
                    // Use textarea for long text fields
                    renderedValue = (
                      <Textarea
                        value={displayValue || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        className="mt-1 h-24"
                        placeholder={`Enter ${key}`}
                      />
                    );
                  } else {
                    // Use regular input for all other fields
                    renderedValue = (
                      <Input
                        value={displayValue || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        className="mt-1"
                        placeholder={`Enter ${key}`}
                        type={typeof displayValue === 'number' ? 'number' : 'text'}
                      />
                    );
                  }
                } else {
                  // Non-edit mode display
                  if (displayValue === null || displayValue === undefined) {
                    renderedValue = <span className="text-neutral-500">null</span>;
                  } else if (Array.isArray(displayValue)) {
                    if (displayValue.length === 0) {
                      renderedValue = <span className="text-neutral-500">[]</span>;
                    } else {
                      renderedValue = (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {displayValue.map((item, idx) => (
                            <Badge key={idx} className="bg-secondary/10 hover:bg-secondary/20 text-secondary-dark">
                              {String(item)}
                            </Badge>
                          ))}
                        </div>
                      );
                    }
                  } else if (typeof displayValue === 'object') {
                    renderedValue = <pre className="text-xs text-neutral-700 mt-1 overflow-auto max-h-[100px]">{JSON.stringify(displayValue, null, 2)}</pre>;
                  } else {
                    renderedValue = <p className="text-sm text-neutral-700 mt-1 whitespace-pre-line">{String(displayValue)}</p>;
                  }
                }
                
                // Get translated field label
                let displayLabel = key;
                
                // Handle special cases
                if (key === 'classificationNumber') {
                  displayLabel = 'ASB-Nummer';
                } else {
                  // Try to get a translation from the translations file
                  displayLabel = t(key) !== key ? t(key) : key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                }
                
                return (
                  <div key={key} className="pb-2 border-b border-neutral-200 last:border-b-0">
                    <h4 className="text-sm font-medium text-primary-dark/70 capitalize">{displayLabel}:</h4>
                    {renderedValue}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
      
      <Separator className="m-0" />
      
      <CardFooter className="px-6 py-4">
        <div className="flex justify-between w-full">
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                try {
                  exportBookToPDF(book as Book);
                } catch (error) {
                  console.error("PDF export error:", error);
                }
              }} 
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t('exportPdf')}
            </Button>
            
            <Button onClick={toggleEditMode} variant="outline" className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {t('cancel')}
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  {t('edit')}
                </>
              )}
            </Button>
          </div>
          
          <div>
            {isEditing ? (
              <Button onClick={handleSaveEdits} variant="default" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {t('saveChanges')}
              </Button>
            ) : (
              <Button onClick={() => onSave(book)} variant="default" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {t('saveToArchive')}
              </Button>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}