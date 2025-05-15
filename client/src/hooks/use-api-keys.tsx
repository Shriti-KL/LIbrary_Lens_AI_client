import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ApiKeysModal, API_KEYS, checkRequiredApiKeys } from '@/components/ui/api-keys-modal';
import { useAuth } from '@/hooks/use-auth';
import { queryClient } from '@/lib/queryClient';

interface ApiKeysContextType {
  showApiKeysModal: () => void;
  apiKeysStatus: {
    hasKeys: boolean;
    hasOpenAI: boolean;
    hasGoogleBooks: boolean;
    hasGoogleCSE: boolean;
  } | null;
  loading: boolean;
}

const ApiKeysContext = createContext<ApiKeysContextType | null>(null);

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Query server for API key status
  const { 
    data: apiKeysStatus, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['/api/session/api-keys/status'],
    queryFn: async () => {
      if (!user) return { hasKeys: false, hasOpenAI: false, hasGoogleBooks: false, hasGoogleCSE: false };
      try {
        return await fetch('/api/session/api-keys/status').then(res => res.json());
      } catch (error) {
        console.error('Failed to fetch API key status:', error);
        return { hasKeys: false, hasOpenAI: false, hasGoogleBooks: false, hasGoogleCSE: false };
      }
    },
    enabled: !!user,
  });
  
  // Show modal automatically after login if keys are missing
  useEffect(() => {
    if (user && apiKeysStatus && !apiKeysStatus.hasKeys && !isModalOpen) {
      // Check localStorage first
      const localStorageKeys = checkRequiredApiKeys();
      
      if (localStorageKeys.hasAllRequired) {
        // If keys are in localStorage but not in session, send them to server
        updateServerKeysFromLocalStorage();
      } else {
        // If no keys anywhere, show the modal
        setIsModalOpen(true);
      }
    }
  }, [user, apiKeysStatus]);
  
  // Function to update server with keys from localStorage
  const updateServerKeysFromLocalStorage = async () => {
    try {
      const response = await fetch('/api/session/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openai_api_key: localStorage.getItem(API_KEYS.OPENAI) || '',
          google_books_api_key: localStorage.getItem(API_KEYS.GOOGLE_BOOKS) || '',
          google_cse_key: localStorage.getItem(API_KEYS.GOOGLE_CSE) || '',
          google_cse_id: localStorage.getItem(API_KEYS.GOOGLE_CSE_ID) || '',
        }),
      });
      
      if (response.ok) {
        refetch(); // Refresh the status after updating
      }
    } catch (error) {
      console.error('Failed to update server with localStorage keys:', error);
    }
  };
  
  // Function to show modal on demand
  const showApiKeysModal = () => {
    setIsModalOpen(true);
  };
  
  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    refetch(); // Refresh status after modal closes
  };
  
  return (
    <ApiKeysContext.Provider
      value={{
        showApiKeysModal,
        apiKeysStatus: apiKeysStatus || null,
        loading: isLoading,
      }}
    >
      {children}
      <ApiKeysModal isOpen={isModalOpen} onClose={handleModalClose} />
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys() {
  const context = useContext(ApiKeysContext);
  if (!context) {
    throw new Error('useApiKeys must be used within an ApiKeysProvider');
  }
  return context;
}