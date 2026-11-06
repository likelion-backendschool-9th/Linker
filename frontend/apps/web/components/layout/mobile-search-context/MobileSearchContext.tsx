'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type MobileSearchContextValue = {
  isOpen: boolean;
  toggle: () => void;
};

const MobileSearchContext = createContext<MobileSearchContextValue | null>(null);

/** Shares the mobile search reveal state between the header's toggle icon and the input row below it. */
export function MobileSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MobileSearchContext.Provider value={{ isOpen, toggle: () => setIsOpen((open) => !open) }}>
      {children}
    </MobileSearchContext.Provider>
  );
}

export function useMobileSearch() {
  const context = useContext(MobileSearchContext);
  if (!context) throw new Error('useMobileSearch must be used within MobileSearchProvider');
  return context;
}
