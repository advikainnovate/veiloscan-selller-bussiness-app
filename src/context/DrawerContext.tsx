import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface DrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(() => ({ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }), [isOpen]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) throw new Error('useDrawer must be used inside DrawerProvider');
  return context;
}
