import React, { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import { Language, useLanguage, LANGUAGE_CHANGE_EVENT } from '@/hooks/use-language';
import { Book } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

// Type for callbacks when language changes
type LanguageChangeCallback = (language: Language) => void;

// Context interface
interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string) => string;
  translateBook: (book: Partial<Book>) => Promise<Partial<Book>>;
  isTranslating: boolean;
  registerTranslationCallback: (id: string, callback: LanguageChangeCallback) => void;
  unregisterTranslationCallback: (id: string) => void;
}

// Create context with a default value
const LanguageContext = createContext<LanguageContextType | null>(null);

// Provider component
export function LanguageProvider({ children }: { children: ReactNode }) {
  const languageService = useLanguage();
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCallbacks, setTranslationCallbacks] = useState<Record<string, LanguageChangeCallback>>({});

  // Register a callback to be executed when language changes
  const registerTranslationCallback = (id: string, callback: LanguageChangeCallback) => {
    setTranslationCallbacks(prev => ({
      ...prev,
      [id]: callback
    }));
  };

  // Unregister a callback
  const unregisterTranslationCallback = (id: string) => {
    setTranslationCallbacks(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Function to translate a book's AI-generated content to the current language
  const translateBook = async (book: Partial<Book>): Promise<Partial<Book>> => {
    if (!book?.id || !book?.title) {
      return book;
    }

    setIsTranslating(true);
    try {
      // Call the API to translate the book content
      const response = await apiRequest('POST', '/api/books/translate', {
        bookId: book.id,
        language: languageService.language
      });
      
      if (!response.ok) {
        throw new Error('Failed to translate book content');
      }
      
      const translatedBook = await response.json();
      setIsTranslating(false);
      return translatedBook;
    } catch (error) {
      console.error('Error translating book:', error);
      setIsTranslating(false);
      return book;
    }
  };

  // Listen for language change events and notify callbacks
  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ language: Language }>;
      const newLanguage = customEvent.detail.language;
      
      // Execute all registered callbacks with the new language
      Object.values(translationCallbacks).forEach(callback => {
        try {
          callback(newLanguage);
        } catch (error) {
          console.error('Error in language change callback:', error);
        }
      });
    };

    document.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    return () => {
      document.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    };
  }, [translationCallbacks]);

  // Create the context value
  const contextValue: LanguageContextType = {
    ...languageService,
    translateBook,
    isTranslating,
    registerTranslationCallback,
    unregisterTranslationCallback
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

// Custom hook to use the language context
export function useLanguageContext() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  return context;
}