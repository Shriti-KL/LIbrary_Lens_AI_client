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
  subtitle: text("subtitle"),             // Subtitle
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
  genres: jsonb("genres").default([]).notNull(),
  themes: jsonb("themes").default([]).notNull(),
  similarBooks: jsonb("similar_books").default([]).notNull(),
  metadata: jsonb("metadata").default({}).notNull(), // Additional metadata
  
  // Physical book properties
  dimensions: text("dimensions"),         // Physical dimensions (e.g., "21 x 15 cm")
  edition: text("edition"),               // Edition information (e.g., "First Edition")
  language: text("language").default("de"), // Language of the content (de, en, fr, es, zh)
  location: text("location"),             // Library location (e.g., "Main Library, Section B")
  binding: text("binding"),               // Binding type (e.g., "Hardcover", "Paperback")
  price: text("price"),                   // Price information
  series: text("series"),                 // Series information
  
  // Contributors
  translator: text("translator"),         // Translator
  illustrator: text("illustrator"),       // Illustrator
  contributors: jsonb("contributors").default([]), // Other contributors (editors, translators, etc.)
  
  // German library catalog specific fields
  catalogNumber: text("catalog_number"),  // ASB catalog number (e.g., "103.485.0")
  categories: jsonb("categories").default([]), // Categories for the book
  secondaryClassification: text("secondary_classification"), // Secondary ASB classification (e.g., "4.3/Y", "6.1/Aax")
  reviewerName: text("reviewer_name"),    // Name of the reviewer (e.g., "Dagmar List")
  interestCategory: text("interest_category"), // Interest category (e.g., "IK: Basteln; ab 4")
  idBNumber: text("id_b_number"),         // ID-B number (e.g., "ID-B 19/25")
  
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// For book insertion validation
export const insertBookSchema = createInsertSchema(books)
  .omit({ id: true, createdAt: true, updatedAt: true });

// For book upload/analysis request
export const bookAnalysisSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  author: z.string().optional(),
  isbn: z.string().nullable().optional(),
  coverImage: z.string().optional(), // base64 encoded image for URL
  coverImageData: z.string().optional(), // base64 encoded image data with mimetype prefix
  coverImageUrl: z.string().nullable().optional(), // External URL for cover image
  publisher: z.string().nullable().optional(),
  publishedYear: z.number().nullable().optional(),
  pageCount: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
  genres: z.array(z.string()).nullable().optional(),
  themes: z.any().nullable().optional(),
  readingLevel: z.string().nullable().optional(),
  catalogEntry: z.string().nullable().optional(),
  deweyDecimal: z.string().nullable().optional(),
  metadata: z.any().optional(),
  userId: z.number().nullable().optional(),
  language: z.union([z.string(), z.array(z.string()).transform(arr => arr[0])]).optional(), // The language to generate content in (e.g. "en", "de", "es", etc.)
  isUserEntry: z.boolean().optional(), // Flag indicating if this is user-entered data (should be corrected)
  
  // Contributors
  translator: z.string().nullable().optional(),
  illustrator: z.string().nullable().optional(),
  
  // Physical book properties 
  dimensions: z.string().nullable().optional(),
  edition: z.string().nullable().optional(),
  binding: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  
  // Library catalog specific fields
  catalogNumber: z.string().nullable().optional(),
  categories: z.array(z.string()).nullable().optional(),
  secondaryClassification: z.string().nullable().optional(),
  reviewerName: z.string().nullable().optional(),
  interestCategory: z.string().nullable().optional(),
  idBNumber: z.string().nullable().optional(),
  
  options: z.object({
    summary: z.boolean().default(true),
    genres: z.boolean().default(true),
    themes: z.boolean().default(true),
    readingLevel: z.boolean().default(true),
    catalogEntry: z.boolean().default(true),
  }).optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type BookAnalysisRequest = z.infer<typeof bookAnalysisSchema> & {
  // Additional runtime properties not in the database schema
  coverImageData?: string;
};

// Analysis options
export enum AnalysisOption {
  Summary = "summary",
  Genres = "genres",
  Themes = "themes",
  ReadingLevel = "readingLevel",
  CatalogEntry = "catalogEntry",
}
