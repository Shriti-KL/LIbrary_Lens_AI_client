import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<Partial<User>, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<Partial<User>, Error, RegisterData>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = LoginData & {
  isLibrarian?: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      
      // Immediately try to upload API keys from localStorage to session after login
      const uploadApiKeysFromStorage = async () => {
        console.log("Attempting to restore API keys from localStorage after login");
        try {
          // Get API keys from localStorage
          const OPENAI_KEY = localStorage.getItem("user_openai_api_key") || '';
          const GOOGLE_BOOKS_KEY = localStorage.getItem("user_google_books_api_key") || '';
          const GOOGLE_CSE_KEY = localStorage.getItem("user_google_cse_key") || '';
          const GOOGLE_CSE_ID = localStorage.getItem("user_google_cse_id") || '';
          
          console.log("API keys found in localStorage:", {
            hasOpenAI: !!OPENAI_KEY,
            hasGoogleBooks: !!GOOGLE_BOOKS_KEY,
            hasGoogleCSE: !!GOOGLE_CSE_KEY,
            hasGoogleCSEId: !!GOOGLE_CSE_ID
          });
          
          // Only proceed if we have some keys
          if (OPENAI_KEY || GOOGLE_BOOKS_KEY) {
            const response = await fetch('/api/session/api-keys', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                openai_api_key: OPENAI_KEY,
                google_books_api_key: GOOGLE_BOOKS_KEY,
                google_cse_key: GOOGLE_CSE_KEY,
                google_cse_id: GOOGLE_CSE_ID
              })
            });
            
            if (response.ok) {
              console.log("API keys successfully restored from localStorage to session");
              // Invalidate the API keys status query to refresh UI
              queryClient.invalidateQueries({ queryKey: ['/api/session/api-keys/status'] });
            } else {
              console.error("Failed to restore API keys to session:", await response.text());
            }
          }
        } catch (error) {
          console.error("Error restoring API keys after login:", error);
        }
      };
      
      // Execute the key restoration
      uploadApiKeysFromStorage();
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      
      // Immediately try to upload API keys from localStorage to session after registration
      const uploadApiKeysFromStorage = async () => {
        console.log("Attempting to restore API keys from localStorage after registration");
        try {
          // Get API keys from localStorage
          const OPENAI_KEY = localStorage.getItem("user_openai_api_key") || '';
          const GOOGLE_BOOKS_KEY = localStorage.getItem("user_google_books_api_key") || '';
          const GOOGLE_CSE_KEY = localStorage.getItem("user_google_cse_key") || '';
          const GOOGLE_CSE_ID = localStorage.getItem("user_google_cse_id") || '';
          
          console.log("API keys found in localStorage for new user:", {
            hasOpenAI: !!OPENAI_KEY,
            hasGoogleBooks: !!GOOGLE_BOOKS_KEY,
            hasGoogleCSE: !!GOOGLE_CSE_KEY,
            hasGoogleCSEId: !!GOOGLE_CSE_ID
          });
          
          // Only proceed if we have some keys
          if (OPENAI_KEY || GOOGLE_BOOKS_KEY) {
            const response = await fetch('/api/session/api-keys', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                openai_api_key: OPENAI_KEY,
                google_books_api_key: GOOGLE_BOOKS_KEY,
                google_cse_key: GOOGLE_CSE_KEY,
                google_cse_id: GOOGLE_CSE_ID
              })
            });
            
            if (response.ok) {
              console.log("API keys successfully restored from localStorage to session for new user");
              // Invalidate the API keys status query to refresh UI
              queryClient.invalidateQueries({ queryKey: ['/api/session/api-keys/status'] });
            } else {
              console.error("Failed to restore API keys to session for new user:", await response.text());
            }
          }
        } catch (error) {
          console.error("Error restoring API keys after registration:", error);
        }
      };
      
      // Execute the key restoration
      uploadApiKeysFromStorage();
      
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout successful",
        description: "You have been logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}