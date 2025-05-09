# Architecture Overview

## 1. Overview

LibraryLens AI is a full-stack web application designed for library book management and analysis. It provides AI-powered book analysis capabilities, offering features like metadata extraction, summary generation, genre identification, and catalog entry creation. The application allows librarians to analyze books (individually or in batch), maintain a database of book records, and retrieve information from external sources.

The system uses a modern JavaScript/TypeScript stack with a clear separation between client and server components. It employs a PostgreSQL database for persistent storage and integrates with external services like OpenAI and Google Books API for enhanced functionality.

## 2. System Architecture

The application follows a traditional client-server architecture with the following key components:

- **Frontend**: React-based single-page application (SPA) with component-based UI architecture
- **Backend**: Express.js REST API server
- **Database**: PostgreSQL database accessed through Drizzle ORM
- **External Services**: Integration with OpenAI API for AI analysis and Google Books API for metadata enrichment

### Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│   React Client  │ ◄────► │   Express API   │ ◄────► │   PostgreSQL    │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                     ▲
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  External APIs  │
                            │                 │
                            │  - OpenAI API   │
                            │  - Google Books │
                            │                 │
                            └─────────────────┘
```

## 3. Key Components

### 3.1 Frontend Architecture

The frontend is built with React using TypeScript and employs a component-based architecture. It uses the following key technologies:

- **React**: Core UI library
- **TailwindCSS**: Utility-first CSS framework for styling
- **shadcn/ui**: UI component library built on Radix UI primitives
- **React Query**: Data fetching and state management
- **React Hook Form**: Form handling and validation
- **Wouter**: Lightweight router for React applications

#### Client Directory Structure

- `client/src/`: Root directory for client code
  - `components/`: UI components organized by feature and reusability
    - `ui/`: Reusable UI components (buttons, inputs, modals, etc.)
    - `book/`: Book-specific components
    - `layouts/`: Layout components (AppLayout)
  - `hooks/`: Custom React hooks for shared functionality
  - `lib/`: Utility functions and configuration
  - `pages/`: Page components corresponding to routes

### 3.2 Backend Architecture

The backend is built with Express.js using TypeScript and follows a modular structure:

- **Express.js**: Web server framework
- **Drizzle ORM**: Database ORM for PostgreSQL
- **Passport.js**: Authentication middleware
- **Multer**: File upload handling

#### Server Directory Structure

- `server/`: Root directory for server code
  - `index.ts`: Entry point for the Express application
  - `routes.ts`: API route definitions
  - `auth.ts`: Authentication logic
  - `db.ts`: Database connection and configuration
  - `storage.ts`: Database operations abstracted behind interfaces
  - `services/`: Domain services
    - `openai.ts`: OpenAI API integration
    - `googleBooks.ts`: Google Books API integration

### 3.3 Database Architecture

The application uses PostgreSQL with Drizzle ORM for data persistence. The database schema is defined in `shared/schema.ts` and includes:

- **Users**: Authentication and user management
- **Books**: Book metadata and analysis results

The schema design supports comprehensive book metadata storage including AI-generated content like summaries, genres, and themes.

### 3.4 Authentication System

Authentication is handled through Passport.js with a local username/password strategy. Session management is implemented using express-session with a PostgreSQL-based session store.

Key features:
- Secure password hashing with scrypt
- Session-based authentication
- User role management (librarian flag)

### 3.5 API Structure

The API follows REST principles and includes endpoints for:

- **Authentication**: User login/logout/registration
- **Books**: CRUD operations for book records
- **Analysis**: Book cover and metadata analysis using AI
- **External Services**: Integration with Google Books API

## 4. Data Flow

### 4.1 Book Analysis Flow

1. **Input Collection**: The client collects book information through:
   - Manual entry of book details
   - Book cover image uploads
   - ISBN input

2. **Processing**:
   - The server sends data to OpenAI for analysis or Google Books for metadata
   - Results are processed and enhanced

3. **Storage**:
   - Analyzed book data is stored in the PostgreSQL database
   - Images may be stored or referenced via URLs

4. **Retrieval**:
   - Users can view, search, and manage previously analyzed books

### 4.2 Authentication Flow

1. User submits credentials
2. Server validates credentials against stored data
3. On success, a session is created and maintained
4. Protected routes check for valid session

## 5. External Dependencies

### 5.1 Core Dependencies

- **React**: Frontend UI library
- **Express**: Backend web framework
- **PostgreSQL/Neon Database**: Relational database
- **Drizzle ORM**: Database ORM
- **TailwindCSS**: CSS utility framework
- **Vite**: Build tool and development server

### 5.2 External Services

- **OpenAI API**: Provides AI capabilities for book analysis
- **Google Books API**: Provides book metadata and search capabilities

## 6. Deployment Strategy

The application is configured for deployment on the Replit platform with:

- **Build Process**: Vite for frontend, esbuild for backend
- **Database**: Neon Serverless PostgreSQL
- **Environment Configuration**: Environment variables for services

The deployment configuration includes:

1. **Build Step**: `npm run build` - builds both client and server
2. **Start Command**: `npm run start` - runs the built application
3. **Development Environment**: `npm run dev` - starts development servers

## 7. Development Considerations

### 7.1 Project Structure

The project follows a monorepo approach with:
- `/client`: Frontend code
- `/server`: Backend code
- `/shared`: Shared types and schemas

### 7.2 Code Organization

- **Component-based UI**: UI elements are organized into reusable components
- **Service Pattern**: Backend logic is organized into services
- **Repository Pattern**: Database operations are abstracted through interfaces

### 7.3 Security Considerations

- CSRF protection through same-site cookies
- Secure password hashing
- Session management with secure configurations
- Input validation through Zod schemas

## 8. Future Considerations

Potential areas for enhancement include:

- Implementing more comprehensive error handling
- Adding more sophisticated authentication features like OAuth
- Improving test coverage
- Adding offline capabilities
- Implementing real-time updates using WebSockets