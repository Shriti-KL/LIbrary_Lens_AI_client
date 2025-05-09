// This is a minimal version of the fix for the BookResult.tsx component
// The main fix needed is in the JSON.stringify to handle the Google Books data properly

// For the JSON display section, replace it with:

{JSON.stringify({
  id: book.id,
  title: book.title,
  subtitle: book.subtitle,
  author: book.author,
  isbn: book.isbn,
  publisher: book.publisher,
  publishedYear: book.publishedYear,
  pageCount: book.pageCount,
  categories: book.categories,
  language: book.language,
  imageLinks: book.coverImageUrl,
  // Extract Google Books data from metadata safely
  googleBooksData: book.metadata && typeof book.metadata === 'object' ? 
    'googleBooksId' in book.metadata ? book.metadata.googleBooksId : null : null,
  // Other Google Books fields would be handled similarly
}, null, 2)}