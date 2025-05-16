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
          
          {/* Data displayed as a simple list */}
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200/80 overflow-auto max-h-[500px]">
            <div className="space-y-2">
              {/* Display all fields in the desired format */}
              {Object.entries(book).map(([key, value]) => {
                // Skip coverImageData which can be very long
                if (key === 'coverImageData') return null;
                
                // Handle different types of values
                let displayValue = null;
                
                if (value === null || value === undefined) {
                  displayValue = <span className="text-neutral-500">null</span>;
                } else if (Array.isArray(value)) {
                  if (value.length === 0) {
                    displayValue = <span className="text-neutral-500">[]</span>;
                  } else {
                    displayValue = (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {value.map((item, idx) => (
                          <Badge key={idx} className="bg-secondary/10 hover:bg-secondary/20 text-secondary-dark">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    );
                  }
                } else if (typeof value === 'object') {
                  displayValue = <pre className="text-xs text-neutral-700 mt-1 overflow-auto max-h-[100px]">{JSON.stringify(value, null, 2)}</pre>;
                } else {
                  displayValue = <p className="text-sm text-neutral-700 mt-1 whitespace-pre-line">{String(value)}</p>;
                }
                
                return (
                  <div key={key} className="pb-2 border-b border-neutral-200 last:border-b-0">
                    <h4 className="text-sm font-medium text-primary-dark/70 capitalize">{key}:</h4>
                    {displayValue}
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
          <div>
            <Button onClick={() => exportBookToPDF(book)} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t('exportPdf')}
            </Button>
          </div>
          <div>
            <Button onClick={() => onSave(book)} variant="default" className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {t('saveToArchive')}
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
                          <div>
                            <div className="flex items-center gap-2 mb-1 bg-blue-50 p-2 rounded border border-blue-200">
                              <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                              <h5 className="font-bold">Step 1: Google Books Data</h5>
                            </div>
                            <div className="pl-5 text-xs mb-2">
                              <p>Basic metadata retrieved from Google Books API</p>
                            </div>
                            <pre className="text-neutral-700 p-2 border border-neutral-300 rounded bg-white">
                              {JSON.stringify({
                                id: book.id,
                                googleBooksId: book.googleBooksId,
                                title: book.title,
                                subtitle: book.subtitle,
                                author: book.author,
                                mainAuthor: book.mainAuthor,
                                isbn: book.isbn,
                                publisher: book.publisher,
                                publicationYear: book.publicationYear || book.publishedYear,
                                publicationPlace: book.publicationPlace || book.location,
                                pageCount: book.pageCount,
                                categories: book.categories,
                                language: book.language,
                                coverImageUrl: book.coverImageUrl,
                                dimensions: book.dimensions,
                                binding: book.binding,
                                price: book.price,
                                edition: book.edition,
                                industryIdentifiers: book.industryIdentifiers,
                                printType: book.printType,
                                maturityRating: book.maturityRating
                              }, null, 2)}
                            </pre>
                          </div>
                          
                          {/* STEP 2: DNB Data */}
                          <div>
                            <div className="flex items-center gap-2 mb-1 bg-yellow-50 p-2 rounded border border-yellow-200">
                              <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                              <h5 className="font-bold">Step 2: DNB Data (German National Library)</h5>
                            </div>
                            <div className="pl-5 text-xs mb-2">
                              <p>Metadata from German National Library (if available)</p>
                            </div>
                            <pre className="text-neutral-700 p-2 border border-neutral-300 rounded bg-white">
                              {JSON.stringify({
                                title: book.title,
                                subtitle: book.subtitle,
                                mainAuthor: book.mainAuthor,
                                statementOfResponsibility: book.statementOfResponsibility,
                                edition: book.edition,
                                publicationPlace: book.publicationPlace,
                                publisher: book.publisher,
                                publicationYear: book.publicationYear,
                                pageCount: book.pageCount,
                                dimensions: book.dimensions,
                                binding: book.binding,
                                price: book.price,
                                language: book.language,
                                illustrations: book.illustrations,
                                dnbNumber: book.dnbNumber,
                                contributors: book.contributors,
                                isbn: book.isbn
                              }, null, 2)}
                            </pre>
                          </div>

                          {/* STEP 3: Google Custom Search Data */}
                          <div>
                            <div className="flex items-center gap-2 mb-1 bg-purple-50 p-2 rounded border border-purple-200">
                              <div className="h-3 w-3 bg-purple-500 rounded-full"></div>
                              <h5 className="font-bold">Step 3: Google Custom Search & Goodreads</h5>
                            </div>
                            <div className="pl-5 text-xs mb-2">
                              <p>Validation data from online book sources</p>
                            </div>
                            <pre className="text-neutral-700 p-2 border border-neutral-300 rounded bg-white">
                              {JSON.stringify({
                                // Google Custom Search
                                verification: book.verification,
                                // Additional fields that might come from external sources
                                rating: book.rating,
                                reviews: book.reviews,
                                source: book.verification?.sources
                              }, null, 2)}
                            </pre>
                          </div>
                          
                          {/* STEP 4: OpenAI Enhanced Data */}
                          <div>
                            <div className="flex items-center gap-2 mb-1 bg-emerald-50 p-2 rounded border border-emerald-200">
                              <div className="h-3 w-3 bg-emerald-500 rounded-full"></div>
                              <h5 className="font-bold">Step 4: OpenAI Enhanced Data</h5>
                            </div>
                            <div className="pl-5 text-xs mb-2">
                              <p>AI-generated content for summary & critical review</p>
                            </div>
                            <pre className="text-neutral-700 p-2 border border-neutral-300 rounded bg-white">
                              {JSON.stringify({
                                summary: book.summary,
                                review: book.review
                              }, null, 2)}
                            </pre>
                          </div>

                          {/* STEP 5: New Library-Specific Fields Added Today */}
                          <div>
                            <div className="flex items-center gap-2 mb-1 bg-amber-50 p-2 rounded border border-amber-200">
                              <div className="h-3 w-3 bg-amber-500 rounded-full"></div>
                              <h5 className="font-bold">Step 5: New Library-Specific Fields (Added Today)</h5>
                            </div>
                            <div className="pl-5 text-xs mb-2">
                              <p>Fields added for DNB/German RDA cataloguing standards</p>
                            </div>
                            <pre className="text-neutral-700 p-2 border border-neutral-300 rounded bg-white">
                              {JSON.stringify({
                                // Library-specific classification
                                interestCategory: book.interestCategory,
                                classificationNumber: book.classificationNumber, 
                                additionalClassifications: book.additionalClassifications,
                                ageRecommendation: book.ageRecommendation,
                                
                                // ID-Besprechung fields
                                idbInitials: book.idbInitials,
                                idbSequenceNumber: book.idbSequenceNumber,
                                idbYear: book.idbYear,
                                
                                // Reviewer information
                                reviewerName: book.reviewerName
                              }, null, 2)}
                            </pre>
                          </div>
                          
                          {/* STEP 6: Final Merged Data */}
                          <div>
                            <div className="flex items-center gap-2 mb-1 bg-neutral-100 p-2 rounded border border-neutral-300">
                              <div className="h-3 w-3 bg-neutral-500 rounded-full"></div>
                              <h5 className="font-bold">Step 6: Complete Merged Book Data</h5>
                            </div>
                            <pre className="text-neutral-700 p-2 border border-neutral-300 rounded bg-white">
                              {JSON.stringify(book, null, 2)}
                            </pre>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-xs text-neutral-500">
                          <p>This debug view shows the detailed multi-source verification process across all APIs. It includes all new fields added today for DNB/German RDA cataloguing standards, and the final merged data combining information from all sources.</p>
                          <p className="mt-1">Verification flow: Google Books → DNB → Google CSE → Goodreads → OpenAI (for summary & review only)</p>
                        </div>
                      </div>
                    </details>
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
          
          {/* Book Summary and Critical Review */}
          {(book.summary || book.review) && (
            <div>
              <h4 className="text-sm font-medium text-primary-dark/80 uppercase tracking-wider mb-3">{t('aiSummary')}</h4>
              <div className="text-sm text-neutral-700 leading-relaxed bg-neutral-50 p-4 rounded-lg border border-neutral-200/80">
                {/* Combined Summary and Review with | separator */}
                <p>
                  {book.summary || ''}
                  {book.summary && book.review && ' | '}
                  {book.review || ''}
                </p>
              </div>
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
                      {typeof theme === 'object' && theme !== null && 
                       Object.prototype.hasOwnProperty.call(theme, 'theme')
                        ? (theme as any).theme
                        : typeof theme === 'string' ? theme : `Theme ${index + 1}`}
                    </h5>
                    <p className="mt-2 text-sm text-neutral-700 leading-relaxed">
                      {typeof theme === 'object' && theme !== null && 
                       Object.prototype.hasOwnProperty.call(theme, 'description')
                        ? (theme as any).description
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
      
      <CardFooter className="bg-primary/5 justify-end border-t border-primary/10 py-4 px-6">
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
