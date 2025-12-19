'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import DraggableWindow from './DraggableWindow';

export interface WindowConfig {
  id: string;
  title: string;
  url: string;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
}

interface WindowState extends WindowConfig {
  zIndex: number;
}

interface WindowManagerContextType {
  openWindow: (config: WindowConfig) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  isWindowOpen: (id: string) => boolean;
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null);

export function useWindowManager() {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
}

interface WindowManagerProviderProps {
  children: ReactNode;
}

export function WindowManagerProvider({ children }: WindowManagerProviderProps) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(100);

  const openWindow = useCallback((config: WindowConfig) => {
    setWindows(prev => {
      // If window already exists, just focus it
      const existing = prev.find(w => w.id === config.id);
      if (existing) {
        return prev.map(w => 
          w.id === config.id 
            ? { ...w, zIndex: nextZIndex, url: config.url, title: config.title }
            : w
        );
      }
      
      // Calculate cascade position for new windows
      const offset = (prev.length % 5) * 30;
      const defaultPosition = config.initialPosition || { x: 120 + offset, y: 80 + offset };
      
      return [...prev, {
        ...config,
        initialPosition: defaultPosition,
        zIndex: nextZIndex,
      }];
    });
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => {
      const window = prev.find(w => w.id === id);
      if (!window || window.zIndex === nextZIndex - 1) return prev;
      
      return prev.map(w => 
        w.id === id ? { ...w, zIndex: nextZIndex } : w
      );
    });
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const isWindowOpen = useCallback((id: string) => {
    return windows.some(w => w.id === id);
  }, [windows]);

  return (
    <WindowManagerContext.Provider value={{ openWindow, closeWindow, focusWindow, isWindowOpen }}>
      {children}
      
      {/* Render all open windows */}
      {windows.map(window => (
        <DraggableWindow
          key={window.id}
          id={window.id}
          title={window.title}
          url={window.url}
          isOpen={true}
          onClose={() => closeWindow(window.id)}
          onFocus={() => focusWindow(window.id)}
          initialPosition={window.initialPosition}
          initialSize={window.initialSize}
          zIndex={window.zIndex}
        />
      ))}
    </WindowManagerContext.Provider>
  );
}
