import { books, type Book, type InsertBook, users, type User, type InsertUser } from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private books: Map<number, Book>;
  private userCurrentId: number;
  private bookCurrentId: number;

  constructor() {
    this.users = new Map();
    this.books = new Map();
    this.userCurrentId = 1;
    this.bookCurrentId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: now 
    };
    this.users.set(id, user);
    return user;
  }

  // Book operations
  async getBook(id: number): Promise<Book | undefined> {
    return this.books.get(id);
  }

  async getBooks(userId?: number): Promise<Book[]> {
    const allBooks = Array.from(this.books.values());
    if (userId) {
      return allBooks.filter(book => book.userId === userId);
    }
    return allBooks;
  }

  async createBook(book: InsertBook): Promise<Book> {
    const id = this.bookCurrentId++;
    const now = new Date();
    const newBook: Book = {
      ...book,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.books.set(id, newBook);
    return newBook;
  }

  async updateBook(id: number, updates: Partial<InsertBook>): Promise<Book | undefined> {
    const book = this.books.get(id);
    if (!book) return undefined;
    
    const updatedBook: Book = {
      ...book,
      ...updates,
      updatedAt: new Date(),
    };
    this.books.set(id, updatedBook);
    return updatedBook;
  }

  async deleteBook(id: number): Promise<boolean> {
    return this.books.delete(id);
  }

  async searchBooks(query: string): Promise<Book[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.books.values()).filter(book => 
      book.title.toLowerCase().includes(lowercaseQuery) ||
      book.author.toLowerCase().includes(lowercaseQuery) ||
      (book.isbn && book.isbn.toLowerCase().includes(lowercaseQuery))
    );
  }

  async getRecentBooks(limit: number): Promise<Book[]> {
    return Array.from(this.books.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
