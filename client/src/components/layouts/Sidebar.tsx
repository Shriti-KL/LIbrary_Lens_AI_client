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
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { t } = useLanguage();

  // Fetch recent books
  const { data: recentBooks = [] } = useQuery<any[]>({
    queryKey: ['/api/books/recent'],
    enabled: !mobile, // Only fetch on desktop
  });

  const handleNavigation = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <div className={cn(
      "flex flex-col border-r border-border shadow-sm bg-white",
      mobile ? "w-full" : "w-64"
    )}>
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <nav className="mt-2 flex-1 px-4 space-y-1">
          <div 
            onClick={() => {
              handleNavigation();
              window.location.href = "/analyze";
            }}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer transition-colors", 
              location === "/" || location === "/analyze" 
                ? "bg-primary text-white shadow-sm" 
                : "text-foreground hover:bg-primary-light hover:text-white"
            )}
          >
            <ClipboardSignature className="mr-3 h-5 w-5" />
            {t('bookAnalysis')}
          </div>
          <div 
            onClick={() => {
              handleNavigation();
              window.location.href = "/archives";
            }}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer transition-colors", 
              location === "/archives" 
                ? "bg-primary text-white shadow-sm" 
                : "text-foreground hover:bg-primary-light hover:text-white"
            )}
          >
            <Archive className="mr-3 h-5 w-5" />
            {t('bookArchive')}
          </div>
          <div 
            onClick={() => {
              handleNavigation();
              window.location.href = "/batch";
            }}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer transition-colors", 
              location === "/batch" 
                ? "bg-primary text-white shadow-sm" 
                : "text-foreground hover:bg-primary-light hover:text-white"
            )}
          >
            <LayersIcon className="mr-3 h-5 w-5" />
            {t('batchProcessing')}
          </div>
          <div 
            onClick={() => {
              handleNavigation();
              window.location.href = "/settings";
            }}
            className={cn(
              "flex items-center px-4 py-3 text-sm font-medium rounded-md cursor-pointer transition-colors", 
              location === "/settings" 
                ? "bg-primary text-white shadow-sm" 
                : "text-foreground hover:bg-primary-light hover:text-white"
            )}
          >
            <Settings className="mr-3 h-5 w-5" />
            {t('settings')}
          </div>
          
          {!mobile && recentBooks && recentBooks.length > 0 && (
            <div className="pt-6 pb-3">
              <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('recentBooks')}
              </h3>
              <div className="mt-2 space-y-1">
                {recentBooks.map((book: any) => (
                  <div 
                    key={book.id}
                    onClick={() => {
                      handleNavigation();
                      window.location.href = `/book/${book.id}`;
                    }}
                    className="group flex items-center px-4 py-2 text-sm font-medium text-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
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
        <div className="flex-shrink-0 flex border-t border-border p-4">
          <div className="bg-accent/20 rounded-md p-4 w-full shadow-sm">
            <h4 className="text-sm font-semibold text-primary">AI Stats</h4>
            <p className="text-xs text-foreground mt-1">Books analyzed: {recentBooks?.length || 0}</p>
            <p className="text-xs text-foreground">Version: 1.0.0</p>
          </div>
        </div>
      )}
    </div>
  );
}
