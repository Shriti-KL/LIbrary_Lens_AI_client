import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define key storage names
export const API_KEYS = {
  OPENAI: "user_openai_api_key",
  GOOGLE_BOOKS: "user_google_books_api_key",
  GOOGLE_CSE: "user_google_cse_key",
  GOOGLE_CSE_ID: "user_google_cse_id"
};

// Helper to retrieve all stored API keys
export function getStoredApiKeys() {
  return {
    [API_KEYS.OPENAI]: localStorage.getItem(API_KEYS.OPENAI) || "",
    [API_KEYS.GOOGLE_BOOKS]: localStorage.getItem(API_KEYS.GOOGLE_BOOKS) || "",
    [API_KEYS.GOOGLE_CSE]: localStorage.getItem(API_KEYS.GOOGLE_CSE) || "",
    [API_KEYS.GOOGLE_CSE_ID]: localStorage.getItem(API_KEYS.GOOGLE_CSE_ID) || ""
  };
}

// Helper to check if required API keys are available
export function checkRequiredApiKeys() {
  const keys = getStoredApiKeys();
  return {
    hasOpenAI: !!keys[API_KEYS.OPENAI],
    hasGoogleBooks: !!keys[API_KEYS.GOOGLE_BOOKS],
    hasGoogleCSE: !!(keys[API_KEYS.GOOGLE_CSE] && keys[API_KEYS.GOOGLE_CSE_ID]),
    hasAllRequired: !!(
      keys[API_KEYS.OPENAI] && 
      keys[API_KEYS.GOOGLE_BOOKS] && 
      keys[API_KEYS.GOOGLE_CSE] &&
      keys[API_KEYS.GOOGLE_CSE_ID]
    )
  };
}

export function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  const { toast } = useToast();
  const storedKeys = getStoredApiKeys();
  
  const [openAIKey, setOpenAIKey] = useState(storedKeys[API_KEYS.OPENAI]);
  const [googleBooksKey, setGoogleBooksKey] = useState(storedKeys[API_KEYS.GOOGLE_BOOKS]);
  const [googleCSEKey, setGoogleCSEKey] = useState(storedKeys[API_KEYS.GOOGLE_CSE]);
  const [googleCSEId, setGoogleCSEId] = useState(storedKeys[API_KEYS.GOOGLE_CSE_ID]);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSave = async () => {
    setIsSaving(true);
    
    // Store in localStorage
    localStorage.setItem(API_KEYS.OPENAI, openAIKey);
    localStorage.setItem(API_KEYS.GOOGLE_BOOKS, googleBooksKey);
    localStorage.setItem(API_KEYS.GOOGLE_CSE, googleCSEKey);
    localStorage.setItem(API_KEYS.GOOGLE_CSE_ID, googleCSEId);
    
    // Also send to server for current session validation
    try {
      await apiRequest("POST", "/api/session/api-keys", {
        openai_api_key: openAIKey,
        google_books_api_key: googleBooksKey,
        google_cse_key: googleCSEKey,
        google_cse_id: googleCSEId
      });
      
      toast({
        title: "API Keys Saved",
        description: "Your API keys have been saved for this session.",
        variant: "default"
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error Saving API Keys",
        description: "There was a problem saving your API keys.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const allKeysProvided = !!openAIKey && !!googleBooksKey && !!googleCSEKey && !!googleCSEId;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enter Your API Keys</DialogTitle>
          <DialogDescription>
            Please provide your own API keys for the services below. These will be used for book analysis and metadata retrieval in this session.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <Input
              id="openai-key"
              type="password"
              placeholder="sk-..."
              value={openAIKey}
              onChange={(e) => setOpenAIKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for summaries and critical reviews. Get one at{" "}
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                OpenAI Platform
              </a>
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="google-books-key">Google Books API Key</Label>
            <Input
              id="google-books-key"
              type="password" 
              placeholder="AIzaSyA..."
              value={googleBooksKey}
              onChange={(e) => setGoogleBooksKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for ISBN lookups. Get one at{" "}
              <a 
                href="https://console.cloud.google.com/apis/library/books.googleapis.com" 
                target="_blank" 
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Google Cloud Console
              </a>
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="google-cse-key">Google Custom Search API Key</Label>
            <Input
              id="google-cse-key"
              type="password" 
              placeholder="AIzaSyA..."
              value={googleCSEKey}
              onChange={(e) => setGoogleCSEKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for cross-source verification.
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="google-cse-id">Google Custom Search Engine ID</Label>
            <Input
              id="google-cse-id"
              placeholder="12345678901234567890:abcdef"
              value={googleCSEId}
              onChange={(e) => setGoogleCSEId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Setup instructions at{" "}
              <a 
                href="https://developers.google.com/custom-search/v1/introduction" 
                target="_blank" 
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Google Custom Search
              </a>
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Later
          </Button>
          <Button type="submit" onClick={handleSave} disabled={!allKeysProvided || isSaving}>
            {isSaving ? "Saving..." : "Save API Keys"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}