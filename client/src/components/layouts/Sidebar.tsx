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
  Book 
} from 'lucide-react';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  // Optional guard navigation function for the Analyze page
  guardNavigation?: (path: string) => void;
}

export function Sidebar({ mobile = false, onNavigate, guardNavigation }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();

  // Fetch recent books
  const { data: recentBooks = [] } = useQuery<any[]>({
    queryKey: ['/api/books/recent'],
    enabled: !mobile, // Only fetch on desktop
  });
  
  // Fetch all books for stats
  const { data: allBooks = [] } = useQuery<any[]>({
    queryKey: ['/api/books'],
    enabled: !mobile, // Only fetch on desktop
  });

  // Handle navigation with guard for the Analyze page
  const handleNavigation = (path: string) => {
    // Call parent callback if provided
    if (onNavigate) onNavigate();
    
    // If we have a guard function and we're on the analyze page,
    // use it to guard navigation
    if (guardNavigation && (location === '/analyze' || location === '/')) {
      guardNavigation(path);
    } else {
      // Otherwise, navigate directly
      setLocation(path);
    }
  };

  return (
    <div className={cn(
      "flex flex-col border-r border-sidebar-border bg-blue-50/30",
      mobile ? "w-full" : "w-64"
    )}>
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <nav className="mt-2 flex-1 px-4 space-y-1">
          <div
            onClick={() => handleNavigation("/analyze")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/" || location === "/analyze" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <ClipboardSignature className="mr-3 h-5 w-5" />
            {t('bookAnalysis')}
          </div>
          <div 
            onClick={() => handleNavigation("/archives")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/archives" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <Archive className="mr-3 h-5 w-5" />
            {t('bookArchive')}
          </div>
          <div 
            onClick={() => handleNavigation("/batch")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/batch" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <LayersIcon className="mr-3 h-5 w-5" />
            {t('batchProcessing')}
          </div>
          <div
            onClick={() => handleNavigation("/settings")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/settings" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <Settings className="mr-3 h-5 w-5" />
            {t('settings')}
          </div>
          
          {!mobile && recentBooks && recentBooks.length > 0 && (
            <div className="pt-6 pb-3">
              <h3 className="px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {t('recentBooks')}
              </h3>
              <div className="mt-2 space-y-1">
                {recentBooks.map((book: any) => (
                  <div 
                    key={book.id}
                    onClick={() => handleNavigation(`/book/${book.id}`)}
                    className="group flex items-center px-4 py-2 text-sm font-medium text-neutral-800 rounded-md hover:bg-accent/70 hover:text-accent-foreground cursor-pointer"
                  >
                    <Book className="mr-3 h-4 w-4" />
                    <span className="truncate">{book.title}</span>
                  </div>
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
            <p className="text-xs text-neutral-800 mt-1">Books analyzed: {allBooks?.length || 0}</p>
            <p className="text-xs text-neutral-800">Version: 1.0.0</p>
          </div>
        </div>
      )}
    </div>
  );
}
