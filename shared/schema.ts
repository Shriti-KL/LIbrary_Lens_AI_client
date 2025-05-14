import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema (required for authentication)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isLibrarian: boolean("is_librarian").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isLibrarian: true,
});

// Book schema for storing analyzed books - standardized to match Python service fields
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  
  // Core bibliographic fields from Python service
  isbn: text("isbn"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  author: text("author").notNull(),
  statementOfResponsibility: text("statement_of_responsibility"),
  publisher: text("publisher"),
  publishedYear: integer("published_year"),
  pageCount: integer("page_count"),
  language: text("language").default("de"),
  edition: text("edition"),
  location: text("location"),
  dimensions: text("dimensions"),
  binding: text("binding"),
  price: text("price"),
  summary: text("summary"),
  genres: jsonb("genres").default([]).notNull(),
  coverImageUrl: text("cover_image_url"),
  
  // Required for database operations
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// For book insertion validation
export const insertBookSchema = createInsertSchema(books)
  .omit({ id: true, createdAt: true, updatedAt: true });

// For book upload/analysis request - standardized to match Python service fields
export const bookAnalysisSchema = z.object({
  // Core bibliographic fields from Python service
  isbn: z.string().nullable().optional(),
  title: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  author: z.string().optional(),
  statementOfResponsibility: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  publishedYear: z.number().nullable().optional(),
  pageCount: z.number().nullable().optional(),
  language: z.union([z.string(), z.array(z.string()).transform(arr => arr[0])]).optional().default("de"),
  edition: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  binding: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  genres: z.array(z.string()).nullable().optional(),
  
  // Cover image fields
  coverImage: z.string().optional(), // base64 encoded image for URL
  coverImageData: z.string().optional(), // base64 encoded image data with mimetype prefix
  coverImageUrl: z.string().nullable().optional(), // External URL for cover image
  
  // Required for database operations
  userId: z.number().nullable().optional(),
  
  // Options for analysis
  options: z.object({
    summary: z.boolean().default(true),
    genres: z.boolean().default(true),
  }).optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Base types
export type Book = typeof books.$inferSelect & {
  // Additional virtual fields that are not stored in the database directly
  themes?: string[];
  readingLevel?: string;
  interestCategory?: string;
  ASB?: string;
  error?: string;
  // Verification information from multi-source validation
  verification?: {
    status: string;
    confidence: number;
    message?: string;
    sources: string[];
    note?: string; // Additional information about the verification process
  };
  // Allow additional string indexer for dynamic OpenAI response fields
  [key: string]: any;
};
export type InsertBook = z.infer<typeof insertBookSchema>;
export type BookAnalysisRequest = z.infer<typeof bookAnalysisSchema> & {
  // Additional runtime properties not in the database schema
  coverImageData?: string;
  themes?: string[];
  readingLevel?: string;
  interestCategory?: string;
  ASB?: string;
  error?: string;
  // Allow dynamic properties for OpenAI analysis
  [key: string]: any;
};

// Analysis options - simplified to match Python service
export enum AnalysisOption {
  Summary = "summary",
  Genres = "genres",
}
