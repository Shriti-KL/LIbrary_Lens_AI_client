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

  const guardNavigation = useCallback((path: string, hasUnsavedChanges: boolean) => {
    if (hasUnsavedChanges) {
      // Show confirmation dialog
      setShowNavigationConfirmation(true);
      setPendingPath(path);
    } else {
      // Navigate directly if no unsaved changes
      setLocation(path);
    }
  }, [setLocation]);

  const confirmNavigation = useCallback(() => {
    // Run any cleanup tasks before navigation
    if (onConfirm) {
      onConfirm();
    }
    
    // Reset the confirmation state
    setShowNavigationConfirmation(false);
    
    // Proceed with navigation
    if (pendingPath) {
      setLocation(pendingPath);
      setPendingPath(null);
    }
  }, [onConfirm, pendingPath, setLocation]);

  const cancelNavigation = useCallback(() => {
    // Reset the confirmation state without navigating
    setShowNavigationConfirmation(false);
    setPendingPath(null);
  }, []);

  return {
    showNavigationConfirmation,
    pendingPath,
    confirmNavigation,
    cancelNavigation,
    guardNavigation
  };
}