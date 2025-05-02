import React from 'react';
import { useLocation, Link } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { 
  ClipboardSignature, 
  Archive, 
  LayersIcon, 
  Settings,
  BookOpen, 
  Book,
  Search
} from 'lucide-react';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { t } = useLanguage();

  // Fetch recent books with proper typing and error handling
  const { data: recentBooks = [] } = useQuery({
    queryKey: ['/api/books/recent'],
    enabled: !mobile, // Only fetch on desktop
  });

  const handleNavigation = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <div className={cn(
      "flex flex-col border-r border-neutral-100 bg-white",
      mobile ? "w-full" : "w-64"
    )}>
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <nav className="mt-2 flex-1 px-4 space-y-1">
          <Link href="/analyze">
            <a 
              onClick={handleNavigation}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-md", 
                location === "/" || location === "/analyze" 
                  ? "bg-primary text-white" 
                  : "text-neutral-800 hover:bg-primary-light hover:text-white"
              )}
            >
              <ClipboardSignature className="mr-3 h-5 w-5" />
              {t('bookAnalysis')}
            </a>
          </Link>
          <Link href="/archives">
            <a 
              onClick={handleNavigation}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-md", 
                location === "/archives" 
                  ? "bg-primary text-white" 
                  : "text-neutral-800 hover:bg-primary-light hover:text-white"
              )}
            >
              <Archive className="mr-3 h-5 w-5" />
              {t('bookArchive')}
            </a>
          </Link>
          <Link href="/batch">
            <a 
              onClick={handleNavigation}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-md", 
                location === "/batch" 
                  ? "bg-primary text-white" 
                  : "text-neutral-800 hover:bg-primary-light hover:text-white"
              )}
            >
              <LayersIcon className="mr-3 h-5 w-5" />
              {t('batchProcessing')}
            </a>
          </Link>
          <Link href="/search">
            <a 
              onClick={handleNavigation}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-md", 
                location === "/search" 
                  ? "bg-primary text-white" 
                  : "text-neutral-800 hover:bg-primary-light hover:text-white"
              )}
            >
              <Search className="mr-3 h-5 w-5" />
              {t('searchBooks')}
            </a>
          </Link>
          <Link href="/settings">
            <a 
              onClick={handleNavigation}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-md", 
                location === "/settings" 
                  ? "bg-primary text-white" 
                  : "text-neutral-800 hover:bg-primary-light hover:text-white"
              )}
            >
              <Settings className="mr-3 h-5 w-5" />
              {t('settings')}
            </a>
          </Link>
          
          {!mobile && Array.isArray(recentBooks) && recentBooks.length > 0 && (
            <div className="pt-6 pb-3">
              <h3 className="px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {t('recentBooks')}
              </h3>
              <div className="mt-2 space-y-1">
                {recentBooks.map((book: any) => (
                  <Link key={book.id} href={`/book/${book.id}`}>
                    <a className="group flex items-center px-4 py-2 text-sm font-medium text-neutral-800 rounded-md hover:bg-accent hover:text-neutral-800">
                      <Book className="mr-3 h-4 w-4" />
                      <span className="truncate">{book.title}</span>
                    </a>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>
      {!mobile && (
        <div className="flex-shrink-0 flex border-t border-neutral-100 p-4">
          <div className="bg-accent-light/30 rounded-md p-4 w-full">
            <h4 className="text-sm font-semibold text-primary">AI Stats</h4>
            <p className="text-xs text-neutral-800 mt-1">Books analyzed: {Array.isArray(recentBooks) ? recentBooks.length : 0}</p>
            <p className="text-xs text-neutral-800">Version: 1.0.0</p>
          </div>
        </div>
      )}
    </div>
  );
}
