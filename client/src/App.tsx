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
      <AuthProvider>
        <ThemeProvider attribute="class">
          <TooltipProvider>
            <AppLayout>
              <Router />
            </AppLayout>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
