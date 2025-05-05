import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Analyze from "@/pages/analyze";
import Archives from "@/pages/archives";
import Batch from "@/pages/batch";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import BookDetail from "@/pages/book-detail";
import AppLayout from "@/components/layouts/AppLayout";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { NavigationGuardProvider } from "./lib/navigation-guard";
import { createContext, useState, useEffect, ReactNode } from "react";
import { Language } from "@/hooks/use-language";

// Create a language context to ensure German is the default language app-wide
export const LanguageContext = createContext<{
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string) => string;
}>({
  language: "de",
  changeLanguage: () => {},
  t: (key) => key,
});

// Create translations object following the same structure as in use-language.ts
// This is a simplified version with only keys used in the app load phase
const translations: Record<Language, Record<string, string>> = {
  en: {
    // English translations here
    appName: "LibraryLens AI",
    bookAnalysis: "Book Analysis",
    // Add other translations as needed
  },
  de: {
    // German translations here
    appName: "LibraryLens AI",
    bookAnalysis: "Buchanalyse",
    // Add other translations as needed
  },
  es: { appName: "LibraryLens AI" },
  fr: { appName: "LibraryLens AI" },
  zh: { appName: "LibraryLens AI" },
};

// Language Provider component
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("de");
  
  // Function to change the current language
  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("preferredLanguage", lang);
  };
  
  // Translation function
  const t = (key: string): string => {
    return (translations[language] && translations[language][key]) || key;
  };
  
  // Load saved language preference on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("preferredLanguage") as Language;
    if (savedLanguage && Object.keys(translations).includes(savedLanguage)) {
      setLanguage(savedLanguage);
    } else {
      // Set German as default if no preference is saved
      setLanguage("de");
      localStorage.setItem("preferredLanguage", "de");
    }
  }, []);
  
  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Analyze} />
      <ProtectedRoute path="/analyze" component={Analyze} />
      <ProtectedRoute path="/archives" component={Archives} />
      <ProtectedRoute path="/batch" component={Batch} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/book/:id" component={BookDetail} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <ThemeProvider attribute="class">
            <TooltipProvider>
              <NavigationGuardProvider>
                <AppLayout>
                  <Router />
                </AppLayout>
              </NavigationGuardProvider>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
