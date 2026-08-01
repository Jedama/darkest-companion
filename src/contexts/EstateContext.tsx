// src/contexts/EstateContext.tsx
import React, {
  createContext,
  useState,
  useCallback,
  useRef,
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

/** What the estate is currently busy doing, for anything that wants to say so. */
export interface EstateActivity {
  label: string;
}

interface EstateContextValue {
  // The currently selected (loaded) estate
  currentEstate: Estate | null;
  setCurrentEstate: React.Dispatch<React.SetStateAction<Estate | null>>;

  // Actions for creating/loading/deleting
  handleCreateEstate: (estateName: string) => Promise<void>;
  handleLoadEstate: (estateName: string) => Promise<void>;
  handleDeleteEstate: (estateName: string) => Promise<void>;

  /**
   * Runs a game action with exclusive access to the estate.
   *
   * This is a QUEUE, not a lock: nothing is rejected and nothing is disabled.
   * A second action simply waits for the first to finish, then runs. Callers
   * show a loading state for as long as their own call is outstanding, which
   * covers both the waiting and the working.
   *
   *   await runExclusive('the month-end review', async () => { ... });
   *
   * Mirrors the server's per-estate write lock, one layer up — but this one can
   * span several HTTP requests, which the server cannot, because only the
   * client knows a town event is three calls rather than one.
   */
  runExclusive: <T>(label: string, task: () => Promise<T>) => Promise<T>;

  /** The action currently running, or null when idle. */
  activity: EstateActivity | null;
  isBusy: boolean;
}

export const EstateContext = createContext<EstateContextValue>({} as EstateContextValue);

export function useEstateContext() {
  const ctx = useContext(EstateContext);
  if (!ctx) {
    throw new Error('useEstateContext must be used inside EstateProvider');
  }
  return ctx;
}

export function EstateProvider({ children }: { children: ReactNode }) {
  const [currentEstate, setCurrentEstate] = useState<Estate | null>(null);
  const [activity, setActivity] = useState<EstateActivity | null>(null);

  /**
   * The tail of the action queue. Each new action chains onto it and awaits the
   * previous link. Lives in a ref rather than state because chaining must not
   * trigger a render, and because it has to survive modals mounting and
   * unmounting — which is exactly why this sits on the provider.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const runExclusive = useCallback(<T,>(label: string, task: () => Promise<T>): Promise<T> => {
    const previous = queueRef.current;

    const run = (async (): Promise<T> => {
      // Wait our turn. Someone else's failure is not our problem, and must not
      // stop us from running.
      await previous.catch(() => {});

      setActivity({ label });
      try {
        return await task();
      } finally {
        setActivity(null);
      }
    })();

    // The stored tail must never reject, or one failed action would make every
    // later one reject too. The caller still gets the real promise.
    queueRef.current = run.catch(() => {});

    return run;
  }, []);

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
    setCurrentEstate((current) => (current?.name === estateName ? null : current));
  }, []);

  const contextValue: EstateContextValue = {
    currentEstate,
    setCurrentEstate,
    handleCreateEstate,
    handleLoadEstate,
    handleDeleteEstate,
    runExclusive,
    activity,
    isBusy: activity !== null,
  };

  return (
    <EstateContext.Provider value={contextValue}>
      {children}
    </EstateContext.Provider>
  );
}