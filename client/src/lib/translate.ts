import { Language } from "@/hooks/use-language";
import { Book } from "@shared/schema";

// Regular expression to detect language (simplified approach)
// Checks for common patterns in different languages
const LANGUAGE_DETECTION = {
  de: /[äöüßÄÖÜ]|(\b(und|der|die|das|ist|ein|eine|zu|von|für|mit|auf|im|bei|nach|über|unter|vor|zwischen|durch|gegen)\b)/gi,
  en: /\b(the|and|is|a|to|of|for|with|on|in|at|by|about|under|over|between|through|against)\b/gi,
  es: /[áéíóúñÁÉÍÓÚÑ]|(\b(el|la|los|las|un|una|unos|unas|y|es|por|para|con|en|sobre|bajo|entre|contra)\b)/gi,
  fr: /[àâçéèêëîïôùûüÿÀÂÇÉÈÊËÎÏÔÙÛÜŸ]|(\b(le|la|les|un|une|des|et|est|pour|avec|sur|dans|sous|entre|contre)\b)/gi,
  zh: /[\u4e00-\u9fff\u3400-\u4dbf]/
};

// Book fields that can be translated
type TranslatableField = 'summary' | 'catalogEntry' | 'genres' | 'themes';

/**
 * Detect the most likely language of a text
 * @param text Text to analyze
 * @returns Detected language code or null if can't determine
 */
export function detectLanguage(text: string): Language | null {
  if (!text || text.length < 10) return null;
  
  // Count matches for each language
  const scores: Record<Language, number> = {
    de: 0,
    en: 0,
    es: 0,
    fr: 0,
    zh: 0
  };
  
  // Test each language pattern
  for (const [lang, pattern] of Object.entries(LANGUAGE_DETECTION)) {
    const matches = text.match(pattern);
    scores[lang as Language] = matches ? matches.length : 0;
  }
  
  // Find language with highest score
  let maxLang: Language = "en";
  let maxScore = 0;
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxLang = lang as Language;
    }
  }
  
  // Return detected language if score is significant
  return maxScore > 3 ? maxLang : null;
}

/**
 * Translate text using API
 * @param text Text to translate
 * @param fromLanguage Source language 
 * @param toLanguage Target language
 * @returns Promise with translated text
 */
export async function translateText(text: string, fromLanguage: Language, toLanguage: Language): Promise<string> {
  // If languages are the same, no translation needed
  if (fromLanguage === toLanguage || !text) {
    return text;
  }
  
  // Create a cache key for this specific translation
  const cacheKey = `translate_${fromLanguage}_${toLanguage}_${text.substring(0, 50)}`;
  
  // Check if we have this translation in localStorage cache
  const cachedTranslation = localStorage.getItem(cacheKey);
  if (cachedTranslation) {
    return cachedTranslation;
  }
  
  try {
    // Make API call to backend translation endpoint
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        fromLanguage,
        toLanguage
      }),
    });
    
    if (!response.ok) {
      throw new Error('Translation failed');
    }
    
    const result = await response.json();
    const translatedText = result.translatedText;
    
    // Cache the result in localStorage for future use
    localStorage.setItem(cacheKey, translatedText);
    
    return translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    // If translation fails, return original text
    return text;
  }
}

/**
 * Translate book data to target language
 * @param book Book object to translate
 * @param targetLanguage Target language
 * @returns Promise with translated book
 */
export async function translateBookData(book: Partial<Book>, targetLanguage: Language): Promise<Partial<Book>> {
  if (!book) return book;
  
  // Create a copy to avoid mutating the original
  const translatedBook: Partial<Book> = { ...book };
  
  // Default source language (assume content is in original book language or English)
  // This will force translation even if language detection fails
  const defaultSourceLanguage: Language = (book.language as Language) || "en";
  
  // Fields that need translation and their detected source language
  const fieldsToTranslate: Record<TranslatableField, Language> = {
    summary: defaultSourceLanguage,
    catalogEntry: defaultSourceLanguage,
    genres: defaultSourceLanguage,
    themes: defaultSourceLanguage
  };
  
  // Try to detect language of AI-generated fields, fallback to default if detection fails
  if (book.summary) {
    const detectedLang = detectLanguage(book.summary);
    if (detectedLang) fieldsToTranslate.summary = detectedLang;
  }
  
  if (book.catalogEntry) {
    const detectedLang = detectLanguage(book.catalogEntry);
    if (detectedLang) fieldsToTranslate.catalogEntry = detectedLang;
  }
  
  // Handle arrays
  if (Array.isArray(book.genres) && book.genres.length > 0) {
    const detectedLang = detectLanguage(book.genres.join(' '));
    if (detectedLang) fieldsToTranslate.genres = detectedLang;
  }
  
  if (Array.isArray(book.themes) && book.themes.length > 0) {
    // For themes which is an array of objects with theme and description
    const themesText = book.themes.map(t => 
      typeof t === 'object' && t !== null ? 
        `${(t as any).theme || ''} ${(t as any).description || ''}` : 
        String(t)
    ).join(' ');
    
    const detectedLang = detectLanguage(themesText);
    if (detectedLang) fieldsToTranslate.themes = detectedLang;
  }

  console.log('Detected languages for book fields:', fieldsToTranslate);

  // Perform translations
  const translationPromises: Promise<any>[] = [];
  
  // Always attempt translation for all fields if target language is different
  // Handle simple string fields
  if (book.summary && fieldsToTranslate.summary !== targetLanguage) {
    translationPromises.push(
      translateText(book.summary, fieldsToTranslate.summary, targetLanguage)
        .then(translated => {
          translatedBook.summary = translated;
        })
    );
  }
  
  if (book.catalogEntry && fieldsToTranslate.catalogEntry !== targetLanguage) {
    translationPromises.push(
      translateText(book.catalogEntry, fieldsToTranslate.catalogEntry, targetLanguage)
        .then(translated => {
          translatedBook.catalogEntry = translated;
        })
    );
  }
  
  // Handle genres array - always translate if target language is different
  if (Array.isArray(book.genres) && book.genres.length > 0 && fieldsToTranslate.genres !== targetLanguage) {
    translationPromises.push(
      Promise.all(
        book.genres.map(genre => 
          translateText(genre, fieldsToTranslate.genres, targetLanguage)
        )
      ).then(translatedGenres => {
        translatedBook.genres = translatedGenres;
      })
    );
  }
  
  // Handle themes array - always translate if target language is different
  if (Array.isArray(book.themes) && book.themes.length > 0 && fieldsToTranslate.themes !== targetLanguage) {
    translationPromises.push(
      Promise.all(
        book.themes.map(async themeObj => {
          if (typeof themeObj === 'object' && themeObj !== null) {
            const typedTheme = themeObj as { theme?: string; description?: string; [key: string]: any };
            
            const theme = typedTheme.theme ? 
              await translateText(typedTheme.theme, fieldsToTranslate.themes, targetLanguage) : 
              typedTheme.theme;
            
            const description = typedTheme.description ? 
              await translateText(typedTheme.description, fieldsToTranslate.themes, targetLanguage) : 
              typedTheme.description;
            
            return { ...typedTheme, theme, description };
          }
          return themeObj;
        })
      ).then(translatedThemes => {
        translatedBook.themes = translatedThemes;
      })
    );
  }
  
  // Wait for all translations to complete
  await Promise.all(translationPromises);
  
  return translatedBook;
}