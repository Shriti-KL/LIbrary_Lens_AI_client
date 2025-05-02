import { books, type Book, type InsertBook, users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, like, desc, or, and, isNotNull } from "drizzle-orm";
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
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book;
  }

  async getBooks(userId?: number): Promise<Book[]> {
    if (userId) {
      return await db.select().from(books).where(eq(books.userId, userId));
    }
    return await db.select().from(books);
  }

  async createBook(book: InsertBook): Promise<Book> {
    const [newBook] = await db.insert(books).values(book).returning();
    return newBook;
  }

  async updateBook(id: number, updates: Partial<InsertBook>): Promise<Book | undefined> {
    const [updatedBook] = await db
      .update(books)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(books.id, id))
      .returning();
    
    return updatedBook;
  }

  async deleteBook(id: number): Promise<boolean> {
    const result = await db.delete(books).where(eq(books.id, id)).returning({ id: books.id });
    return result.length > 0;
  }

  async searchBooks(query: string): Promise<Book[]> {
    const searchTerm = `%${query}%`;
    return await db
      .select()
      .from(books)
      .where(
        or(
          like(books.title, searchTerm),
          like(books.author, searchTerm),
          and(isNotNull(books.isbn), like(books.isbn, searchTerm))
        )
      );
  }

  async getRecentBooks(limit: number): Promise<Book[]> {
    return await db
      .select()
      .from(books)
      .orderBy(desc(books.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
