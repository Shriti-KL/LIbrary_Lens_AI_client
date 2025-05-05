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

// Book schema for storing analyzed books
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  isbn: text("isbn"),
  coverImageUrl: text("cover_image_url"),
  publisher: text("publisher"),
  publishedYear: integer("published_year"),
  pageCount: integer("page_count"),
  summary: text("summary"),
  readingLevel: text("reading_level"),
  deweyDecimal: text("dewey_decimal"),
  catalogEntry: text("catalog_entry"),
  
  // Additional bibliographic fields
  dimensions: text("dimensions"),           // Physical dimensions (e.g., "22 cm")
  edition: text("edition"),                 // Edition information (e.g., "1. Auflage")
  language: text("language"),               // Language of the book (e.g., "German")
  location: text("location"),               // Publication location (e.g., "München")
  contributors: jsonb("contributors").default([]).notNull(), // Additional contributors (illustrators, etc.)
  binding: text("binding"),                 // Binding type (e.g., "Festeinb.", "Hardcover")
  price: text("price"),                     // Price information (e.g., "EUR 19.95")
  series: text("series"),                   // Series information
  
  // Arrays of data
  genres: jsonb("genres").default([]).notNull(),
  themes: jsonb("themes").default([]).notNull(),
  similarBooks: jsonb("similar_books").default([]).notNull(),
  
  // Catch-all field for any additional metadata
  metadata: jsonb("metadata").default({}).notNull(),
  
  // Relations and timestamps
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// For book insertion validation
export const insertBookSchema = createInsertSchema(books)
  .omit({ id: true, createdAt: true, updatedAt: true });

// For book upload/analysis request
export const bookAnalysisSchema = z.object({
  // Basic book information
  title: z.string().optional(),
  author: z.string().optional(),
  isbn: z.string().nullable().optional(),
  
  // Cover image related fields
  coverImage: z.string().optional(), // base64 encoded image for URL
  coverImageData: z.string().optional(), // base64 encoded image data with mimetype prefix
  coverImageUrl: z.string().nullable().optional(), // External URL for cover image
  
  // Standard bibliographic data
  publisher: z.string().nullable().optional(),
  publishedYear: z.number().nullable().optional(),
  pageCount: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
  
  // Classification data
  genres: z.array(z.string()).nullable().optional(),
  themes: z.any().nullable().optional(),
  readingLevel: z.string().nullable().optional(),
  catalogEntry: z.string().nullable().optional(),
  deweyDecimal: z.string().nullable().optional(),
  
  // Extended bibliographic data for complete catalog entries
  dimensions: z.string().nullable().optional(),       // Physical dimensions (e.g., "22 cm")
  edition: z.string().nullable().optional(),          // Edition information (e.g., "1. Auflage")
  language: z.string().nullable().optional(),         // Language of the book
  location: z.string().nullable().optional(),         // Publication location (e.g., "München")
  contributors: z.array(z.object({                   // Additional contributors like illustrators
    role: z.string(),
    name: z.string()
  })).nullable().optional(),
  binding: z.string().nullable().optional(),          // Binding type (e.g., "Festeinb.", "Hardcover")
  price: z.string().nullable().optional(),            // Price information (e.g., "EUR 19.95")
  series: z.string().nullable().optional(),           // Series information
  
  // System fields
  metadata: z.any().optional(),
  userId: z.number().nullable().optional(),
  isUserEntry: z.boolean().optional(), // Flag indicating if this is user-entered data (should be corrected)
  
  // Analysis options
  options: z.object({
    summary: z.boolean().default(true),
    genres: z.boolean().default(true),
    themes: z.boolean().default(true),
    readingLevel: z.boolean().default(true),
    catalogEntry: z.boolean().default(true),
    // Added extended options
    extendedBibliography: z.boolean().default(true), // Get complete bibliographic data
  }).optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type BookAnalysisRequest = z.infer<typeof bookAnalysisSchema>;

// Analysis options
export enum AnalysisOption {
  Summary = "summary",
  Genres = "genres",
  Themes = "themes",
  ReadingLevel = "readingLevel",
  CatalogEntry = "catalogEntry",
}
