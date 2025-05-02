import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useLanguage } from '@/hooks/use-language';
import { Book } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t, language, changeLanguage } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            <div className="hidden md:flex items-center space-x-1 text-white">
              <span className="font-medium">Librarian Admin</span>
              <div className="h-8 w-8 rounded-full bg-white/30 flex items-center justify-center text-primary">
                LA
              </div>
            </div>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="md:hidden">
                <Sidebar mobile onNavigate={() => setIsMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
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
