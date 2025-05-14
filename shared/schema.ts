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

// Book schema for storing analyzed books - standardized to match DNB/German RDA cataloguing standards
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  
  // Core bibliographic fields based on DNB/German RDA cataloguing standards
  isbn: text("isbn"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  mainAuthor: text("main_author"), // The primary author according to DNB
  statementOfResponsibility: text("statement_of_responsibility"), // Complete statement including authors, illustrators, etc.
  edition: text("edition"), // Edition statement
  publicationPlace: text("publication_place"), // Place of publication
  publisher: text("publisher"), // Publisher name
  publicationYear: integer("publication_year"), // Year of publication
  pageCount: integer("page_count"), // Number of pages
  dimensions: text("dimensions"), // Height/dimensions
  binding: text("binding"), // Type of binding
  price: text("price"), // Book price
  
  // Additional fields
  summary: text("summary"),
  genres: jsonb("genres").default([]).notNull(),
  language: text("language").default("de"),
  coverImageUrl: text("cover_image_url"),
  
  // Required for database operations
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// For book insertion validation
export const insertBookSchema = createInsertSchema(books)
  .omit({ id: true, createdAt: true, updatedAt: true });

// For book upload/analysis request - standardized to match DNB/German RDA cataloguing standards
export const bookAnalysisSchema = z.object({
  // Core bibliographic fields based on DNB/German RDA standards
  isbn: z.string().nullable().optional(),
  title: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  mainAuthor: z.string().nullable().optional(), // The primary author according to DNB
  statementOfResponsibility: z.string().nullable().optional(), // Complete statement including authors, illustrators, etc.
  edition: z.string().nullable().optional(), // Edition statement
  publicationPlace: z.string().nullable().optional(), // Place of publication
  publisher: z.string().nullable().optional(), // Publisher name
  publicationYear: z.number().nullable().optional(), // Year of publication
  pageCount: z.number().nullable().optional(), // Number of pages
  dimensions: z.string().nullable().optional(), // Height/dimensions
  binding: z.string().nullable().optional(), // Type of binding
  price: z.string().nullable().optional(), // Book price
  
  // Additional fields
  summary: z.string().nullable().optional(),
  genres: z.array(z.string()).nullable().optional(),
  language: z.union([z.string(), z.array(z.string()).transform(arr => arr[0])]).optional().default("de"),
  
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
  // Professional review content
  review?: string;
  // Contributors for different roles (similar to Python implementation)
  contributors?: {[role: string]: string[]};
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
  contributors?: {[role: string]: string[]};  // Added contributors field
  error?: string;
  // Professional review content
  review?: string;
  // New fields for improved OpenAI analysis
  description?: string;             // Authentic book description from reliable sources
  genres?: string[];                // Genres from authentic sources
  sourcesInfo?: string;             // Information about where the data came from
  // Allow dynamic properties for OpenAI analysis
  [key: string]: any;
};

// Analysis options - simplified to match Python service
export enum AnalysisOption {
  Summary = "summary",
  Genres = "genres",
}
