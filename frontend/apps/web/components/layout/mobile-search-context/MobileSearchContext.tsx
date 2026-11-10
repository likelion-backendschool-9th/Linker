'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type MobileSearchContextValue = {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
};

const MobileSearchContext = createContext<MobileSearchContextValue | null>(null);

/** Shares the mobile search reveal state between the header's toggle icon and the input row below it. */
export function MobileSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Leave the top of the page → fold the input row away (e.g. 19 recruit chrome collapse).
  useEffect(() => {
    if (!isOpen) return;

    const onScroll = () => {
      if (Math.max(window.scrollY, 0) > 0) setIsOpen(false);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  return (
    <MobileSearchContext.Provider
      value={{
        isOpen,
        toggle: () => setIsOpen((open) => !open),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </MobileSearchContext.Provider>
  );
}

export function useMobileSearch() {
  const context = useContext(MobileSearchContext);
  if (!context) throw new Error('useMobileSearch must be used within MobileSearchProvider');
  return context;
}
