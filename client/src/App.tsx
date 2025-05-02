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
import Search from "@/pages/search";
import AppLayout from "@/components/layouts/AppLayout";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";

function Router() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    // Simple initialization timeout to ensure components have time to load
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!isLoaded) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">LibraryLens AI</h2>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }
  
  return (
    <Switch>
      <Route path="/" component={Analyze} />
      <Route path="/analyze" component={Analyze} />
      <Route path="/archives" component={Archives} />
      <Route path="/batch" component={Batch} />
      <Route path="/search" component={Search} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class">
        <TooltipProvider>
          <AppLayout>
            <Router />
          </AppLayout>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
