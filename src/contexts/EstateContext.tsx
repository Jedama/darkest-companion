// src/contexts/EstateContext.tsx
import React, {
  createContext,
  useState,
  useCallback,
  ReactNode,
  useContext
} from 'react';
import type { Estate } from '../../shared/types/types';
import {
  fetchEstates,
  loadEstate,
  createEstate as createEstateApi,
  deleteEstate as deleteEstateApi
} from '../utils/api';

/** 
 * Our context shape:
 */
interface EstateContextValue {
  // The currently selected (loaded) estate
  currentEstate: Estate | null;
  setCurrentEstate: React.Dispatch<React.SetStateAction<Estate | null>>;

  // Actions for creating/loading/deleting
  handleCreateEstate: (estateName: string) => Promise<void>;
  handleLoadEstate: (estateName: string) => Promise<void>;
  handleDeleteEstate: (estateName: string) => Promise<void>;
}

/** 
 * Create the context with a default of an empty object
 * (we'll provide a real value via EstateProvider).
 */
export const EstateContext = createContext<EstateContextValue>({} as EstateContextValue);

export function useEstateContext() {
  const ctx = useContext(EstateContext);
  if (!ctx) {
    throw new Error('useEstateContext must be used inside EstateProvider');
  }
  return ctx;
}

/** 
 * Our provider that wraps the app (or part of it).
 */
export function EstateProvider({ children }: { children: ReactNode }) {
  const [currentEstate, setCurrentEstate] = useState<Estate | null>(null);

  // Create estate, then set as "currently selected"
  const handleCreateEstate = useCallback(async (estateName: string) => {
    const estate = await createEstateApi(estateName.trim());
    setCurrentEstate(estate);
  }, []);

  // Load existing estate, store it
  const handleLoadEstate = useCallback(async (estateName: string) => {
    const estate = await loadEstate(estateName);
    setCurrentEstate(estate);
  }, []);

  // Delete estate; if it's the currently loaded one, reset
  const handleDeleteEstate = useCallback(async (estateName: string) => {
    await deleteEstateApi(estateName);
    if (currentEstate?.estateName === estateName) {
      setCurrentEstate(null);
    }
  }, [currentEstate]);

  const contextValue: EstateContextValue = {
    currentEstate,
    setCurrentEstate,
    handleCreateEstate,
    handleLoadEstate,
    handleDeleteEstate
  };

  return (
    <EstateContext.Provider value={contextValue}>
      {children}
    </EstateContext.Provider>
  );
}
