import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';

type NavigationGuardHook = {
  showNavigationConfirmation: boolean;
  pendingPath: string | null;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
  guardNavigation: (path: string, hasUnsavedChanges: boolean) => void;
};

/**
 * A hook to guard navigation when there are unsaved changes
 * @param onConfirm Optional callback to run before confirming navigation
 * @returns NavigationGuardHook
 */
export function useNavigationGuard(onConfirm?: () => void): NavigationGuardHook {
  const [, setLocation] = useLocation();
  const [showNavigationConfirmation, setShowNavigationConfirmation] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Handle confirming navigation
  const confirmNavigation = useCallback(() => {
    if (pendingPath) {
      // Run the optional callback if provided
      if (onConfirm) {
        onConfirm();
      }
      
      // Navigate to pending location
      setLocation(pendingPath);
      
      // Reset state
      setShowNavigationConfirmation(false);
      setPendingPath(null);
    }
  }, [pendingPath, setLocation, onConfirm]);

  // Handle canceling navigation
  const cancelNavigation = useCallback(() => {
    setShowNavigationConfirmation(false);
    setPendingPath(null);
  }, []);

  // Guard navigation based on whether there are unsaved changes
  const guardNavigation = useCallback((path: string, hasUnsavedChanges: boolean) => {
    if (hasUnsavedChanges) {
      setPendingPath(path);
      setShowNavigationConfirmation(true);
    } else {
      setLocation(path);
    }
  }, [setLocation]);

  return {
    showNavigationConfirmation,
    pendingPath,
    confirmNavigation,
    cancelNavigation,
    guardNavigation
  };
}