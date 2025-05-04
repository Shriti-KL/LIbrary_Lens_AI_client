import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Book, LogOut, Menu, User } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLocation } from 'wouter';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t, language, changeLanguage } = useLanguage();
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/auth');
      }
    });
  };
  
  // Get user initials for avatar
  const getInitials = (username: string) => {
    return username ? username.slice(0, 2).toUpperCase() : 'LA';
  };

  // For auth page, show a simplified layout without navigation
  const isAuthPage = window.location.pathname === '/auth';
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-primary shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Book className="h-8 w-8 text-white" />
            <h1 className="text-xl font-serif font-bold text-white">{t('appName')}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-1 text-white hover:text-accent-light">
                    <span>{language.toUpperCase()}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => changeLanguage('en')}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('es')}>Español</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('fr')}>Français</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('de')}>Deutsch</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('zh')}>中文</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="hidden md:flex items-center space-x-1 text-white hover:text-accent-light">
                    <span className="font-medium">{user.username}</span>
                    <div className="h-8 w-8 rounded-full bg-white/30 flex items-center justify-center text-primary">
                      {getInitials(user.username)}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem disabled className="flex items-center text-muted-foreground">
                    <User className="mr-2 h-4 w-4" />
                    <span>
                      {user.isLibrarian ? 'Librarian' : 'User'} Account
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="md:hidden">
                <Sidebar 
                  mobile 
                  onNavigate={() => setIsMobileMenuOpen(false)}
                  guardNavigation={window.location.pathname === '/' || window.location.pathname === '/analyze' ? 
                    (path: string) => {
                      // Check if the Analyze page is rendered and has guardNavigation method
                      const analyzeComponent = document.getElementById('analyze-page');
                      if (analyzeComponent && (analyzeComponent as any).__guardNavigation) {
                        (analyzeComponent as any).__guardNavigation(path);
                      } else {
                        setLocation(path);
                      }
                    } : undefined
                  }
                />
                
                {/* Mobile user info and logout */}
                {user && (
                  <div className="mt-auto pt-4 border-t">
                    <div className="flex items-center justify-between px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                          {getInitials(user.username)}
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-xs text-muted-foreground">{user.isLibrarian ? 'Librarian' : 'User'}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleLogout}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar 
            guardNavigation={window.location.pathname === '/' || window.location.pathname === '/analyze' ? 
              (path: string) => {
                // Check if the Analyze page is rendered and has guardNavigation method
                const analyzeComponent = document.getElementById('analyze-page');
                if (analyzeComponent && (analyzeComponent as any).__guardNavigation) {
                  (analyzeComponent as any).__guardNavigation(path);
                } else {
                  setLocation(path);
                }
              } : undefined
            }
          />
        </div>

        {/* Main Content */}
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
