import { useState } from 'react';
import { Switch, Route, Link } from 'wouter';

const Header = () => (
  <header className="bg-blue-700 text-white p-4 shadow-md">
    <div className="container mx-auto flex justify-between items-center">
      <h1 className="text-xl font-bold">LibraryLens AI</h1>
      <span className="text-sm">Book Analysis Platform</span>
    </div>
  </header>
);

const Navigation = () => (
  <nav className="bg-white border-b border-gray-200">
    <div className="container mx-auto px-4">
      <ul className="flex space-x-6">
        <li>
          <Link href="/">
            <a className="py-3 px-2 inline-block border-b-2 border-blue-700 text-blue-700">Home</a>
          </Link>
        </li>
        <li>
          <Link href="/analyze">
            <a className="py-3 px-2 inline-block">Analyze</a>
          </Link>
        </li>
        <li>
          <Link href="/archives">
            <a className="py-3 px-2 inline-block">Archives</a>
          </Link>
        </li>
      </ul>
    </div>
  </nav>
);

const Footer = () => (
  <footer className="bg-gray-50 border-t py-6 mt-auto">
    <div className="container mx-auto px-4">
      <p className="text-sm text-gray-600 text-center">
        LibraryLens AI - Book Analysis Platform
      </p>
    </div>
  </footer>
);

// Simple page components
const HomePage = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <h2 className="text-2xl font-bold mb-4">Welcome to LibraryLens AI</h2>
    <p className="mb-4">
      This application helps librarians analyze and catalog books using AI technology.
      Upload a book cover or enter details to get started.
    </p>
    <div className="mt-8 flex justify-center">
      <Link href="/analyze">
        <a className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Analyze a Book
        </a>
      </Link>
    </div>
  </div>
);

const AnalyzePage = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <h2 className="text-2xl font-bold mb-4">Book Analysis</h2>
    <p className="mb-4">Upload a book cover or enter details to analyze.</p>
    
    <form className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Book Title</label>
        <input 
          type="text" 
          className="w-full p-2 border border-gray-300 rounded-md" 
          placeholder="Enter book title"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Author</label>
        <input 
          type="text" 
          className="w-full p-2 border border-gray-300 rounded-md" 
          placeholder="Enter author name"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Book Cover (optional)</label>
        <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
          <p className="text-gray-500">Drag and drop a book cover image or click to upload</p>
        </div>
      </div>
      
      <button 
        type="submit" 
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Analyze Book
      </button>
    </form>
  </div>
);

const ArchivesPage = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <h2 className="text-2xl font-bold mb-4">Book Archives</h2>
    <p className="mb-4">Your analyzed books will appear here.</p>
    
    <div className="mt-6 space-y-4">
      <div className="p-4 border rounded-md">
        <h3 className="font-bold">The Great Gatsby</h3>
        <p className="text-sm text-gray-600">F. Scott Fitzgerald</p>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 flex-grow">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/analyze" component={AnalyzePage} />
          <Route path="/archives" component={ArchivesPage} />
          <Route>
            <div className="text-center py-10">
              <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
              <p className="mb-4">The page you are looking for doesn't exist.</p>
              <Link href="/">
                <a className="text-blue-600 hover:underline">Go back home</a>
              </Link>
            </div>
          </Route>
        </Switch>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
