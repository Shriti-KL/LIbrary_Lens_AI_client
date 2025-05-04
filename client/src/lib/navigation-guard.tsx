import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useLocation } from 'wouter';

// Define the NavigationGuard context type
interface NavigationGuardContextType {
  registerGuard: (id: string, callback: (to: string) => boolean) => void;
  unregisterGuard: (id: string) => void;
  attemptNavigation: (to: string) => boolean;
}

// Create the context with default values
const NavigationGuardContext = createContext<NavigationGuardContextType>({
  registerGuard: () => {},
  unregisterGuard: () => {},
  attemptNavigation: () => true,
});

// NavigationGuard Provider component
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  
  // Store navigation guards in a Map where key is the guard ID
  // and value is the callback function that returns true if navigation is allowed
  const [navigationGuards, setNavigationGuards] = useState<Map<string, (to: string) => boolean>>(
    new Map()
  );
  
  // Register a navigation guard
  const registerGuard = useCallback((id: string, callback: (to: string) => boolean) => {
    setNavigationGuards(prev => {
      const newMap = new Map(prev);
      newMap.set(id, callback);
      return newMap;
    });
  }, []);
  
  // Unregister a navigation guard
  const unregisterGuard = useCallback((id: string) => {
    setNavigationGuards(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);
  
  // Attempt navigation, checking all guards
  const attemptNavigation = useCallback((to: string) => {
    // Check all guards - every guard must return true for navigation to proceed
    let canNavigate = true;
    
    // Convert map to array and iterate
    Array.from(navigationGuards.values()).forEach(guardFn => {
      if (!guardFn(to)) {
        canNavigate = false;
      }
    });
    
    // If all guards allow, perform navigation
    if (canNavigate) {
      navigate(to);
    }
    
    return canNavigate;
  }, [navigationGuards, navigate]);
  
  return (
    <NavigationGuardContext.Provider
      value={{ registerGuard, unregisterGuard, attemptNavigation }}
    >
      {children}
    </NavigationGuardContext.Provider>
  );
}

// Custom hook to use the navigation guard
export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

// Custom Link component that uses navigation guard
export function GuardedLink({ to, children, className, onClick }: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { attemptNavigation } = useNavigationGuard();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Run any additional onClick handler
    if (onClick) onClick();
    
    // Attempt navigation through the guard system
    attemptNavigation(to);
  };
  
  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}