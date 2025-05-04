import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/hooks/use-language';
import { Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Book, BookOpen, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BookCoverPlaceholder from '@/components/book/BookCoverPlaceholder';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

type Genre = {
  name: string;
  count: number;
  books: {
    id: number;
    title: string;
    author: string;
    coverImageUrl: string | null;
  }[];
};

export default function GenresPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  
  // Fetch genres data
  const { data: genres = [], isLoading } = useQuery<Genre[]>({
    queryKey: ['/api/books/genres'],
  });
  
  // Effect to set the first genre as active when data is loaded
  useEffect(() => {
    if (genres.length > 0 && !activeGenre) {
      setActiveGenre(genres[0].name);
    }
  }, [genres, activeGenre]);
  
  // Filter books based on search query
  const filteredBooks = (genreName: string) => {
    const genre = genres.find(g => g.name === genreName);
    if (!genre) return [];
    
    if (!searchQuery) return genre.books;
    
    return genre.books.filter(book => 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };
  
  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Page Title */}
      <div className="mb-8 border-b border-neutral-200 pb-3">
        <h1 className="text-2xl font-serif font-semibold text-primary-dark">
          Browse by Genre
        </h1>
        <p className="text-neutral-600 mt-1">Explore books organized by their genres</p>
      </div>
      
      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          </div>
        ) : genres.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-neutral-400" />
            <h3 className="mt-4 text-lg font-medium text-neutral-900">No genres found</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Add more books with genres to see them categorized here.
            </p>
          </div>
        ) : (
          <div>
            {/* Genre tabs */}
            <Tabs 
              defaultValue={genres[0]?.name} 
              value={activeGenre || undefined}
              onValueChange={setActiveGenre}
              className="w-full"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <TabsList className="bg-neutral-100 p-1 flex-wrap">
                  {genres.map(genre => (
                    <TabsTrigger 
                      key={genre.name} 
                      value={genre.name}
                      className="relative"
                    >
                      {genre.name}
                      <Badge className="ml-2 absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        {genre.count}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <Input
                    type="text"
                    placeholder="Search in genre..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 w-full sm:w-48 md:w-64"
                  />
                </div>
              </div>
              
              {genres.map(genre => (
                <TabsContent key={genre.name} value={genre.name} className="mt-0">
                  <div className="mb-4 flex justify-between items-center">
                    <h3 className="text-xl font-semibold">
                      {genre.name} <span className="text-sm font-normal text-neutral-500">({genre.count} books)</span>
                    </h3>
                  </div>
                  
                  {filteredBooks(genre.name).length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-neutral-200 rounded-md">
                      <Search className="h-8 w-8 mx-auto text-neutral-400" />
                      <p className="mt-2 text-neutral-600">No books match your search in this genre</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredBooks(genre.name).map(book => (
                        <Link key={book.id} href={`/book/${book.id}`}>
                          <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
                            <CardHeader className="p-4 pb-0 flex-grow-0">
                              <div className="h-36 flex items-center justify-center mb-2 overflow-hidden">
                                {book.coverImageUrl ? (
                                  <img
                                    src={book.coverImageUrl}
                                    alt={book.title}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <BookCoverPlaceholder
                                    title={book.title}
                                    author={book.author}
                                    className="w-full h-full"
                                  />
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 pb-1 flex-grow">
                              <CardTitle className="text-base truncate">{book.title}</CardTitle>
                              <CardDescription className="truncate">{book.author}</CardDescription>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}