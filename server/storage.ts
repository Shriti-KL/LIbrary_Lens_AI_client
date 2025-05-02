import { books, type Book, type InsertBook, users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, or } from "drizzle-orm";

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
  searchBooks(query: string): Promise<Book[]>;
  getRecentBooks(limit: number): Promise<Book[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Book operations
  async getBook(id: number): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book || undefined;
  }

  async getBooks(userId?: number): Promise<Book[]> {
    if (userId) {
      return db.select().from(books).where(eq(books.userId, userId));
    }
    return db.select().from(books);
  }

  async createBook(book: InsertBook): Promise<Book> {
    const [createdBook] = await db
      .insert(books)
      .values(book)
      .returning();
    return createdBook;
  }

  async updateBook(id: number, updates: Partial<InsertBook>): Promise<Book | undefined> {
    const [updatedBook] = await db
      .update(books)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(books.id, id))
      .returning();
    
    return updatedBook || undefined;
  }

  async deleteBook(id: number): Promise<boolean> {
    const result = await db
      .delete(books)
      .where(eq(books.id, id))
      .returning({ id: books.id });
    
    return result.length > 0;
  }

  async searchBooks(query: string): Promise<Book[]> {
    // Let's do a manual search to see if we're having issues with the ORM
    console.log("Searching for books with query:", query);
    
    const allBooks = await db.select().from(books);
    console.log("Total books in database:", allBooks.length);
    
    // Now let's do the search manually
    const lowercaseQuery = query.toLowerCase();
    
    const results = allBooks.filter(book => 
      (book.title && book.title.toLowerCase().includes(lowercaseQuery)) ||
      (book.author && book.author.toLowerCase().includes(lowercaseQuery)) ||
      (book.isbn && book.isbn.toLowerCase().includes(lowercaseQuery))
    );
    
    console.log("Filtered books:", results.length);
    return results;
  }

  async getRecentBooks(limit: number): Promise<Book[]> {
    return db
      .select()
      .from(books)
      .orderBy(desc(books.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
