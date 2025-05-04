import React from 'react';
import { useLocation } from 'wouter';
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
  TagsIcon
} from 'lucide-react';
import { GuardedLink, useNavigationGuard } from '@/lib/navigation-guard';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { attemptNavigation } = useNavigationGuard();

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

  const handleNavigation = () => {
    if (onNavigate) onNavigate();
  };

  // Used for links that should be guarded by navigation guard
  const handleGuardedNavigation = (to: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) onNavigate();
    attemptNavigation(to);
  };

  return (
    <div className={cn(
      "flex flex-col border-r border-sidebar-border bg-blue-50/30",
      mobile ? "w-full" : "w-64"
    )}>
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <nav className="mt-2 flex-1 px-4 space-y-1">
          <a 
            href="/analyze"
            onClick={handleGuardedNavigation("/analyze")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/" || location === "/analyze" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <ClipboardSignature className="mr-3 h-5 w-5" />
            {t('bookAnalysis')}
          </a>
          <a 
            href="/archives"
            onClick={handleGuardedNavigation("/archives")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/archives" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <Archive className="mr-3 h-5 w-5" />
            {t('bookArchive')}
          </a>
          <a 
            href="/genres"
            onClick={handleGuardedNavigation("/genres")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/genres" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <TagsIcon className="mr-3 h-5 w-5" />
            Browse by Genre
          </a>
          <a
            href="/batch" 
            onClick={handleGuardedNavigation("/batch")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/batch" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <LayersIcon className="mr-3 h-5 w-5" />
            {t('batchProcessing')}
          </a>
          <a
            href="/settings"
            onClick={handleGuardedNavigation("/settings")}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer", 
              location === "/settings" 
                ? "bg-primary text-white" 
                : "text-neutral-800 hover:bg-primary/90 hover:text-white"
            )}
          >
            <Settings className="mr-3 h-5 w-5" />
            {t('settings')}
          </a>
          
          {!mobile && recentBooks && recentBooks.length > 0 && (
            <div className="pt-6 pb-3">
              <h3 className="px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {t('recentBooks')}
              </h3>
              <div className="mt-2 space-y-1">
                {recentBooks.map((book: any) => (
                  <a 
                    key={book.id}
                    href={`/book/${book.id}`}
                    onClick={handleGuardedNavigation(`/book/${book.id}`)}
                    className="group flex items-center px-4 py-2 text-sm font-medium text-neutral-800 rounded-md hover:bg-accent/70 hover:text-accent-foreground cursor-pointer"
                  >
                    <Book className="mr-3 h-4 w-4" />
                    <span className="truncate">{book.title}</span>
                  </a>
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
