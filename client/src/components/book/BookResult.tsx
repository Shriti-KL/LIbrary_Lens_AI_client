import React from 'react';
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
import { Download, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import BookItem from './BookItem';
import BookCoverPlaceholder from './BookCoverPlaceholder';
import { formatISBN } from '@/lib/utils';

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

  // Handle export results
  const handleExport = () => {
    // Use the same PDF export function used in Archives page
    exportBookToPDF(book as Book);
  };

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

  // Book result display
  return (
    <Card className="shadow-sm border border-neutral-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-serif leading-6 font-medium text-primary-dark">{t('results')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600">{t('insights')}</p>
          </div>
          <div>
            <Badge variant="secondary" className="bg-green-100 text-green-700 font-medium px-3">
              {t('complete')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <Separator className="m-0" />

      <CardContent className="px-6 pt-5 pb-6">
        <div className="grid grid-cols-1 gap-8">
          {/* Book cover and metadata */}
          <div className="flex flex-col sm:flex-row gap-8">
            <div className="sm:w-1/3">
              {book.coverImageUrl ? (
                <img 
                  src={book.coverImageUrl} 
                  alt={`${book.title} cover`} 
                  className="object-cover w-full h-64 rounded-lg shadow-md border border-neutral-200" 
                />
              ) : book.coverImageData ? (
                <img 
                  src={book.coverImageData as string} 
                  alt={`${book.title} cover`} 
                  className="object-cover w-full h-64 rounded-lg shadow-md border border-neutral-200" 
                />
              ) : (
                <div className="w-full h-64">
                  <BookCoverPlaceholder 
                    title={book.title || ''} 
                    author={book.author || ''}
                  />
                </div>
              )}
            </div>
            
            <div className="sm:w-2/3">
              <h3 className="text-xl font-serif font-semibold text-primary-dark">{book.title}</h3>
              <p className="text-lg text-neutral-700 mt-1 font-medium">{book.author}</p>
              
              {/* Book Details Section */}
              <div className="mt-5">
                <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('bookDetails')}</h4>
                <div className="grid grid-cols-2 gap-5 bg-neutral-50 p-4 rounded-lg border border-neutral-200/80">
                  {/* Basic Information */}
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('isbn')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.isbn ? formatISBN(book.isbn) : 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('pages')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.pageCount || 'N/A'}</p>
                  </div>
                  
                  {/* Publication Information */}
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('published')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.publishedYear || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('publisher')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.publisher || 'N/A'}</p>
                  </div>
                  
                  {/* Edition and Location */}
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('edition')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.edition || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('location')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.location || 'N/A'}</p>
                  </div>
                  
                  {/* Physical Characteristics */}
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('dimensions')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.dimensions || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-primary-dark/70">{t('binding')}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{book.binding || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              {/* Contributors section (illustrators, editors, etc.) */}
              <div className="mt-5">
                <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('contributors')}</h4>
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200/80">
                  {book.contributors && Array.isArray(book.contributors) && book.contributors.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {book.contributors.map((contributor: any, index: number) => (
                        <div key={index} className="flex items-center">
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full mr-2">
                            {contributor.role}
                          </span>
                          <span className="text-sm text-neutral-700">{contributor.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-600 italic">No contributor information available</p>
                  )}
                </div>
              </div>
              
              <div className="mt-5">
                <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('genres')}</h4>
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200/80">
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(book.genres) && book.genres.length > 0 ? (
                      book.genres.map((genre, index) => (
                        <Badge key={index} variant="outline" className="bg-primary-light/20 text-primary-dark border-primary/30 px-3 py-1 font-medium">
                          {genre}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-600 italic">No genres identified</p>
                    )}
                  </div>
                </div>
              </div>
              
              {book.readingLevel && (
                <div className="mt-5">
                  <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('readingLevel')}</h4>
                  <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200/80">
                    <div className="flex items-center">
                      <div className="w-full bg-primary/10 rounded-full h-2.5">
                        <div 
                          className="bg-secondary-light h-2.5 rounded-full" 
                          style={{ 
                            width: book.metadata && typeof book.metadata === 'object' && 'readingLevelScore' in book.metadata 
                              ? `${(book.metadata.readingLevelScore as number) * 10}%` 
                              : '50%'
                          }}
                        ></div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-neutral-700">{book.readingLevel}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Book Summary */}
          {book.summary && (
            <div>
              <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('aiSummary')}</h4>
              <p className="text-sm text-neutral-700 leading-relaxed bg-neutral-50 p-4 rounded-lg border border-neutral-200/80">
                {book.summary}
              </p>
            </div>
          )}
          
          {/* Themes */}
          {Array.isArray(book.themes) && book.themes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('majorThemes')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {book.themes.map((theme, index) => (
                  <div key={index} className="bg-accent/10 p-4 rounded-lg border border-accent/30 shadow-sm">
                    <h5 className="font-medium text-secondary-dark">
                      {typeof theme === 'object' && theme !== null && 'theme' in theme
                        ? theme.theme as string
                        : typeof theme === 'string' ? theme : `Theme ${index + 1}`}
                    </h5>
                    <p className="mt-2 text-sm text-neutral-700 leading-relaxed">
                      {typeof theme === 'object' && theme !== null && 'description' in theme
                        ? theme.description as string
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Catalog Entry */}
          {book.catalogEntry && (
            <div>
              <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('catalogEntry')}</h4>
              <div className="p-5 bg-primary/5 rounded-lg font-mono text-sm whitespace-pre-wrap border border-primary/10 shadow-sm">
                {book.catalogEntry}
              </div>
            </div>
          )}
          
          {/* Similar Books */}
          {Array.isArray(book.similarBooks) && book.similarBooks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('similarBooks')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {book.similarBooks.map((similarBook, index) => (
                  <BookItem key={index} book={similarBook} />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="bg-primary/5 justify-between border-t border-primary/10 py-4 px-6">
        <Button 
          variant="outline" 
          onClick={handleExport}
          className="flex items-center gap-2 border-primary/30 text-primary-dark hover:bg-primary/10"
        >
          <Download className="h-4 w-4" />
          {t('exportResults')}
        </Button>
        <Button 
          onClick={() => onSave(book)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5"
        >
          <Save className="h-4 w-4" />
          {t('saveToArchive')}
        </Button>
      </CardFooter>
    </Card>
  );
}
