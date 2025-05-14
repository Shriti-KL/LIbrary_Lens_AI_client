import { books, type Book, type InsertBook, users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, like, desc, or, and, isNotNull, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Book operations
  getBook(id: number): Promise<Book | undefined>;
  getBooks(userId?: number): Promise<Book[]>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, book: Partial<InsertBook>): Promise<Book | undefined>;
  deleteBook(id: number): Promise<boolean>;
  clearAllBooks(): Promise<number>; // Clear all books and return count of deleted books
  searchBooks(query: string): Promise<Book[]>;
  getRecentBooks(limit: number): Promise<Book[]>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    const PostgresStore = connectPg(session);
    this.sessionStore = new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Book operations
  async getBook(id: number): Promise<Book | undefined> {
    // Use raw SQL to handle field renaming
    const result = await db.execute(
      `SELECT 
        id, isbn, title, subtitle, author, 
        author as main_author,
        statement_of_responsibility,
        edition, 
        location as publication_place,
        publisher, 
        published_year as publication_year,
        page_count, dimensions, binding, price, 
        summary, review, genres, cover_image_url as "coverImageUrl",
        language, user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM books 
      WHERE id = ${id}`
    );
    
    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as unknown as Book;
    }
    
    return undefined;
  }

  async getBooks(userId?: number): Promise<Book[]> {
    // Use raw SQL to handle field mappings
    let query = `
      SELECT 
        id, isbn, title, subtitle, author, 
        author as main_author,
        statement_of_responsibility,
        edition, 
        location as publication_place,
        publisher, 
        published_year as publication_year,
        page_count, dimensions, binding, price, 
        summary, review, genres, cover_image_url as "coverImageUrl",
        language, user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM books
    `;
    
    if (userId) {
      query += ` WHERE user_id = ${userId}`;
    }
    
    const result = await db.execute(query);
    return (result.rows || []) as unknown as Book[];
  }

  async createBook(book: InsertBook): Promise<Book> {
    // Map the fields to the database column names
    const dbBook: Record<string, any> = {
      // Core bibliographic fields
      isbn: book.isbn,
      title: book.title,
      subtitle: book.subtitle,
      main_author: book.mainAuthor, 
      statement_of_responsibility: book.statementOfResponsibility,
      edition: book.edition,
      publication_place: book.publicationPlace,
      publisher: book.publisher,
      publication_year: book.publicationYear,
      page_count: book.pageCount,
      illustrations: book.illustrations,
      dimensions: book.dimensions,
      binding: book.binding,
      price: book.price,
      
      // Classification and categorization
      interest_category: book.interestCategory, 
      age_recommendation: book.ageRecommendation,
      classification_number: book.classificationNumber, // ASB classification
      additional_classifications: book.additionalClassifications,
      
      // ID-Besprechung specific fields (ekz fields)
      idb_initials: book.idbInitials,
      idb_sequence_number: book.idbSequenceNumber,
      idb_year: book.idbYear,
      
      // Content fields
      summary: book.summary,
      review: book.review,
      reviewer_name: book.reviewerName || (book.userId ? null : null), // Will get username from session if needed
      
      // Additional fields
      genres: book.genres,
      language: book.language,
      cover_image_url: book.coverImageUrl,
      user_id: book.userId || 1, // Default to user ID 1 if not specified
    };

    // Format values safely for SQL insertion
    const formatValue = (value: any) => {
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value;
    };

    const now = new Date().toISOString();

    // Insert the book with the mapped fields using string interpolation instead of parameters
    const query = `
      INSERT INTO books (
        isbn, title, subtitle, main_author, statement_of_responsibility,
        edition, publication_place, publisher, publication_year, page_count,
        illustrations, dimensions, binding, price, 
        interest_category, age_recommendation, classification_number, additional_classifications,
        idb_initials, idb_sequence_number, idb_year,
        summary, review, reviewer_name, genres, language,
        cover_image_url, user_id, created_at, updated_at
      ) VALUES (
        ${formatValue(dbBook.isbn)}, 
        ${formatValue(dbBook.title)}, 
        ${formatValue(dbBook.subtitle)}, 
        ${formatValue(dbBook.main_author)}, 
        ${formatValue(dbBook.statement_of_responsibility)},
        ${formatValue(dbBook.edition)}, 
        ${formatValue(dbBook.publication_place)}, 
        ${formatValue(dbBook.publisher)}, 
        ${formatValue(dbBook.publication_year)}, 
        ${formatValue(dbBook.page_count)},
        ${formatValue(dbBook.illustrations)}, 
        ${formatValue(dbBook.dimensions)}, 
        ${formatValue(dbBook.binding)}, 
        ${formatValue(dbBook.price)},
        ${formatValue(dbBook.interest_category)},
        ${formatValue(dbBook.age_recommendation)},
        ${formatValue(dbBook.classification_number)},
        ${formatValue(dbBook.additional_classifications)},
        ${formatValue(dbBook.idb_initials)},
        ${formatValue(dbBook.idb_sequence_number)},
        ${formatValue(dbBook.idb_year)},
        ${formatValue(dbBook.summary)}, 
        ${formatValue(dbBook.review)},
        ${formatValue(dbBook.reviewer_name)},
        ${formatValue(dbBook.genres)}, 
        ${formatValue(dbBook.language)},
        ${formatValue(dbBook.cover_image_url)}, 
        ${formatValue(dbBook.user_id)}, 
        '${now}', 
        '${now}'
      ) RETURNING 
        id, isbn, title, subtitle, main_author as "mainAuthor",
        statement_of_responsibility as "statementOfResponsibility",
        edition, 
        publication_place as "publicationPlace",
        publisher, 
        publication_year as "publicationYear",
        page_count as "pageCount", 
        illustrations,
        dimensions, binding, price, 
        interest_category as "interestCategory",
        age_recommendation as "ageRecommendation",
        classification_number as "classificationNumber",
        additional_classifications as "additionalClassifications",
        idb_initials as "idbInitials",
        idb_sequence_number as "idbSequenceNumber",
        idb_year as "idbYear",
        summary, review, reviewer_name as "reviewerName",
        genres, cover_image_url as "coverImageUrl",
        language, user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    
    // Execute the query without parameters
    const result = await db.execute(query);
    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as unknown as Book;
    }
    throw new Error("Failed to create book record");
  }

  async updateBook(id: number, updates: Partial<InsertBook>): Promise<Book | undefined> {
    // Map new field names to database column names
    const dbUpdates: Record<string, any> = {};
    
    // Copy simple fields that need no transformation
    ['isbn', 'title', 'subtitle', 'edition', 'publisher', 
     'dimensions', 'binding', 'price', 'summary', 'review', 'genres', 
     'language', 'illustrations'].forEach(field => {
      if (field in updates) {
        dbUpdates[field] = updates[field as keyof typeof updates];
      }
    });
    
    // User ID needs special handling
    if ('userId' in updates) dbUpdates['user_id'] = updates.userId;
    
    // Map renamed fields with underscores in database
    if ('mainAuthor' in updates) dbUpdates['main_author'] = updates.mainAuthor;
    if ('publicationPlace' in updates) dbUpdates['publication_place'] = updates.publicationPlace;
    if ('publicationYear' in updates) dbUpdates['publication_year'] = updates.publicationYear;
    if ('pageCount' in updates) dbUpdates['page_count'] = updates.pageCount;
    if ('statementOfResponsibility' in updates) dbUpdates['statement_of_responsibility'] = updates.statementOfResponsibility;
    if ('coverImageUrl' in updates) dbUpdates['cover_image_url'] = updates.coverImageUrl;
    
    // New classification fields
    if ('interestCategory' in updates) dbUpdates['interest_category'] = updates.interestCategory;
    if ('ageRecommendation' in updates) dbUpdates['age_recommendation'] = updates.ageRecommendation;
    if ('classificationNumber' in updates) dbUpdates['classification_number'] = updates.classificationNumber;
    if ('additionalClassifications' in updates) dbUpdates['additional_classifications'] = updates.additionalClassifications;
    
    // ID-Besprechung specific fields
    if ('idbInitials' in updates) dbUpdates['idb_initials'] = updates.idbInitials;
    if ('idbSequenceNumber' in updates) dbUpdates['idb_sequence_number'] = updates.idbSequenceNumber;
    if ('idbYear' in updates) dbUpdates['idb_year'] = updates.idbYear;
    
    // Reviewer information
    if ('reviewerName' in updates) dbUpdates['reviewer_name'] = updates.reviewerName;
    
    // Add updated timestamp
    dbUpdates['updated_at'] = new Date().toISOString();
    
    // Format values safely for SQL insertion
    const formatValue = (value: any) => {
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value;
    };
    
    // Build the update query dynamically
    let query = 'UPDATE books SET ';
    const setClauses: string[] = [];
    
    // Add SET clauses for each field using string interpolation
    for (const [field, value] of Object.entries(dbUpdates)) {
      setClauses.push(`${field} = ${formatValue(value)}`);
    }
    
    query += setClauses.join(', ');
    query += ` WHERE id = ${id} RETURNING 
      id, isbn, title, subtitle, main_author as "mainAuthor",
      statement_of_responsibility as "statementOfResponsibility",
      edition, 
      publication_place as "publicationPlace",
      publisher, 
      publication_year as "publicationYear",
      page_count as "pageCount", 
      illustrations,
      dimensions, binding, price, 
      interest_category as "interestCategory",
      age_recommendation as "ageRecommendation",
      classification_number as "classificationNumber",
      additional_classifications as "additionalClassifications",
      idb_initials as "idbInitials",
      idb_sequence_number as "idbSequenceNumber",
      idb_year as "idbYear",
      summary, review, reviewer_name as "reviewerName",
      genres, cover_image_url as "coverImageUrl",
      language, user_id as "userId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `;
    
    const result = await db.execute(query);
    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as unknown as Book;
    }
    return undefined;
  }

  async deleteBook(id: number): Promise<boolean> {
    const result = await db.execute(`DELETE FROM books WHERE id = ${id} RETURNING id`);
    return result.rows && result.rows.length > 0;
  }
  
  async clearAllBooks(): Promise<number> {
    try {
      console.log("Executing clearAllBooks operation...");
      const { rows } = await db.execute(
        'DELETE FROM books RETURNING id;'
      );
      console.log(`Successfully deleted ${rows.length} books`);
      return rows ? rows.length : 0;
    } catch (error) {
      console.error("Error in clearAllBooks:", error);
      throw error;
    }
  }

  async searchBooks(query: string): Promise<Book[]> {
    const searchTerm = `%${query.replace(/'/g, "''")}%`;
    
    // Use raw SQL to handle field mappings while searching
    const searchQuery = `
      SELECT 
        id, isbn, title, subtitle, main_author as "mainAuthor",
        statement_of_responsibility as "statementOfResponsibility",
        edition, 
        publication_place as "publicationPlace",
        publisher, 
        publication_year as "publicationYear",
        page_count as "pageCount", 
        illustrations,
        dimensions, binding, price, 
        interest_category as "interestCategory",
        age_recommendation as "ageRecommendation",
        classification_number as "classificationNumber",
        additional_classifications as "additionalClassifications",
        idb_initials as "idbInitials",
        idb_sequence_number as "idbSequenceNumber",
        idb_year as "idbYear",
        summary, review, reviewer_name as "reviewerName",
        genres, cover_image_url as "coverImageUrl",
        language, user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM books
      WHERE 
        title ILIKE '${searchTerm}' OR
        author ILIKE '${searchTerm}' OR
        (isbn IS NOT NULL AND isbn ILIKE '${searchTerm}')
    `;
    
    const result = await db.execute(searchQuery);
    return (result.rows || []) as unknown as Book[];
  }

  async getRecentBooks(limit: number): Promise<Book[]> {
    // Use raw SQL to handle field mappings
    const query = `
      SELECT 
        id, isbn, title, subtitle, author, 
        author as main_author,
        statement_of_responsibility,
        edition, 
        location as publication_place,
        publisher, 
        published_year as publication_year,
        page_count, dimensions, binding, price, 
        summary, review, genres, cover_image_url as "coverImageUrl",
        language, user_id as "userId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM books
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    const result = await db.execute(query);
    return (result.rows || []) as unknown as Book[];
  }
}

export const storage = new DatabaseStorage();
