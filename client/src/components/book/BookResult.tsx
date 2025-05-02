import React from 'react';
import { useLanguage } from '@/hooks/use-language';
import { Book } from '@shared/schema';
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
    const bookData = JSON.stringify(book, null, 2);
    const blob = new Blob([bookData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title || 'book'}-analysis.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // If still loading, show loading state
  if (isLoading && loadingSteps) {
    return (
      <Card className="h-full">
        <CardHeader className="bg-primary/5 border-b border-border">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-serif leading-6 font-medium text-foreground">{t('results')}</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('insights')}</p>
            </div>
            <div>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 font-medium border-yellow-200 shadow-sm">
                {t('processing')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin mx-auto h-16 w-16 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-medium text-foreground">{t('loading')}</h3>
            <p className="mt-2 text-muted-foreground">{t('insights')}</p>
            
            <div className="mt-8 max-w-xl mx-auto">
              {/* Loading progress for each step */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t('title')} & {t('author')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.metadata.status === 'complete' 
                        ? <span className="text-green-600 dark:text-green-500">{t('complete')}</span>
                        : loadingSteps.metadata.status === 'in-progress'
                          ? <span className="text-primary">{t('processing')}</span>
                          : <span className="text-muted-foreground">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.metadata.progress} className="w-full h-2.5" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t('generateSummary')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.summary.status === 'complete' 
                        ? <span className="text-green-600 dark:text-green-500">{t('complete')}</span>
                        : loadingSteps.summary.status === 'in-progress'
                          ? <span className="text-primary">{t('processing')}</span>
                          : <span className="text-muted-foreground">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.summary.progress} className="w-full h-2.5" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t('identifyGenres')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.genres.status === 'complete' 
                        ? <span className="text-green-600 dark:text-green-500">{t('complete')}</span>
                        : loadingSteps.genres.status === 'in-progress'
                          ? <span className="text-primary">{t('processing')}</span>
                          : <span className="text-muted-foreground">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.genres.progress} className="w-full h-2.5" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t('extractThemes')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.themes.status === 'complete' 
                        ? <span className="text-green-600 dark:text-green-500">{t('complete')}</span>
                        : loadingSteps.themes.status === 'in-progress'
                          ? <span className="text-primary">{t('processing')}</span>
                          : <span className="text-muted-foreground">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.themes.progress} className="w-full h-2.5" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t('generateCatalog')}</span>
                    <span className="text-sm font-medium">
                      {loadingSteps.catalogEntry.status === 'complete' 
                        ? <span className="text-green-600 dark:text-green-500">{t('complete')}</span>
                        : loadingSteps.catalogEntry.status === 'in-progress'
                          ? <span className="text-primary">{t('processing')}</span>
                          : <span className="text-muted-foreground">{t('waiting')}</span>
                      }
                    </span>
                  </div>
                  <Progress value={loadingSteps.catalogEntry.progress} className="w-full h-2.5" />
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
      <Card className="h-full flex flex-col">
        <CardHeader className="bg-primary/5 border-b border-border">
          <div>
            <h3 className="text-xl font-serif leading-6 font-medium text-foreground">{t('results')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('insights')}</p>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="text-center py-12 px-6 max-w-md mx-auto">
            <div className="mx-auto h-20 w-20 text-muted-foreground bg-muted/40 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="mt-6 text-xl font-medium text-foreground">No Book Data</h3>
            <p className="mt-3 text-muted-foreground">Upload a book cover or enter book details to analyze</p>
            <p className="mt-6 text-sm text-primary">Use the form on the left to begin your analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Book result display
  return (
    <Card>
      <CardHeader className="bg-primary/5 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-serif leading-6 font-medium text-foreground">{t('results')}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('insights')}</p>
          </div>
          <div>
            <Badge variant="outline" className="bg-green-100 text-green-800 font-medium border-green-200 shadow-sm">
              {t('complete')}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-8">
          {/* Book cover and metadata - Material Design card with elevation */}
          <div className="flex flex-col lg:flex-row gap-6 bg-card rounded-lg p-6 shadow-sm border border-border">
            <div className="lg:w-1/3 flex justify-center">
              {book.coverImageUrl ? (
                <img 
                  src={book.coverImageUrl} 
                  alt={`${book.title} cover`} 
                  className="object-cover w-full max-w-[200px] h-auto rounded-lg shadow-md" 
                />
              ) : (book as any).coverImageData ? (
                <img 
                  src={(book as any).coverImageData as string} 
                  alt={`${book.title} cover`} 
                  className="object-cover w-full max-w-[200px] h-auto rounded-lg shadow-md" 
                />
              ) : (
                <div className="w-full max-w-[200px] h-64 rounded-lg shadow-md bg-muted flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="lg:w-2/3">
              <h3 className="text-2xl font-serif font-bold text-foreground">{book.title}</h3>
              <p className="text-lg text-muted-foreground mt-1">{book.author}</p>
              
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-muted/40 p-3 rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground">{t('isbn')}</h4>
                  <p className="mt-1 text-sm text-foreground">{book.isbn || 'N/A'}</p>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground">{t('published')}</h4>
                  <p className="mt-1 text-sm text-foreground">{book.publishedYear || 'N/A'}</p>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground">{t('publisher')}</h4>
                  <p className="mt-1 text-sm text-foreground">{book.publisher || 'N/A'}</p>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground">{t('pages')}</h4>
                  <p className="mt-1 text-sm text-foreground">{book.pageCount || 'N/A'}</p>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-foreground">{t('genres')}</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.isArray(book.genres) && book.genres.length > 0 ? (
                    book.genres.map((genre, index) => (
                      <Badge key={index} className="bg-primary text-white px-3 py-1 text-sm shadow-sm">
                        {genre}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No genres identified</p>
                  )}
                </div>
              </div>
              
              {book.readingLevel && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground">{t('readingLevel')}</h4>
                  <div className="mt-2 flex items-center">
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div 
                        className="bg-secondary h-2.5 rounded-full" 
                        style={{ 
                          width: book.metadata && typeof book.metadata === 'object' && 'readingLevelScore' in book.metadata 
                            ? `${(book.metadata.readingLevelScore as number) * 10}%` 
                            : '50%'
                        }}
                      ></div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-foreground">{book.readingLevel}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Book Summary */}
          {book.summary && (
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
              <h4 className="text-md font-serif font-semibold text-foreground mb-4">{t('aiSummary')}</h4>
              <p className="text-foreground leading-relaxed">
                {book.summary}
              </p>
            </div>
          )}
          
          {/* Themes */}
          {Array.isArray(book.themes) && book.themes.length > 0 && (
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
              <h4 className="text-md font-serif font-semibold text-foreground mb-4">{t('majorThemes')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {book.themes.map((theme, index) => (
                  <div key={index} className="bg-accent/20 p-4 rounded-lg shadow-sm border border-accent/30">
                    <h5 className="font-medium text-primary text-lg">
                      {typeof theme === 'object' && theme !== null && 'theme' in theme
                        ? theme.theme as string
                        : typeof theme === 'string' ? theme : `Theme ${index + 1}`}
                    </h5>
                    <p className="mt-2 text-foreground">
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
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
              <h4 className="text-md font-serif font-semibold text-foreground mb-4">{t('catalogEntry')}</h4>
              <div className="p-4 bg-muted rounded-lg font-mono text-sm text-foreground whitespace-pre-wrap border border-border">
                {book.catalogEntry}
              </div>
            </div>
          )}
          
          {/* Similar Books */}
          {Array.isArray(book.similarBooks) && book.similarBooks.length > 0 && (
            <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
              <h4 className="text-md font-serif font-semibold text-foreground mb-4">{t('similarBooks')}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {book.similarBooks.map((similarBook, index) => (
                  <BookItem key={index} book={similarBook} />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="bg-primary/5 border-t border-border py-4 px-6 justify-between">
        <Button 
          variant="outline" 
          onClick={handleExport}
          className="flex items-center gap-2 shadow-sm"
        >
          <Download className="h-4 w-4" />
          {t('exportResults')}
        </Button>
        <Button 
          onClick={() => onSave(book)}
          className="flex items-center gap-2 shadow-sm"
        >
          <Save className="h-4 w-4" />
          {t('saveToArchive')}
        </Button>
      </CardFooter>
    </Card>
  );
}
