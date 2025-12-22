'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { XMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';

interface DraggableWindowProps {
  id: string;
  title: string;
  url: string;
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  zIndex?: number;
  onFocus?: () => void;
}

export default function DraggableWindow({
  id,
  title,
  url,
  isOpen,
  onClose,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 400, height: 500 },
  zIndex = 100,
  onFocus,
}: DraggableWindowProps) {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaximizeState, setPreMaximizeState] = useState({ position: initialPosition, size: initialSize });
  const [isLoading, setIsLoading] = useState(true);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isMaximized) return;
    
    e.preventDefault();
    setIsDragging(true);
    onFocus?.();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { x: position.x, y: position.y };
  }, [position, isMaximized, onFocus]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, positionStartRef.current.x + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 50, positionStartRef.current.y + deltaY)),
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Toggle maximize
  const handleToggleMaximize = useCallback(() => {
    if (isMaximized) {
      setPosition(preMaximizeState.position);
      setSize(preMaximizeState.size);
      setIsMaximized(false);
    } else {
      setPreMaximizeState({ position, size });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setIsMaximized(true);
    }
  }, [isMaximized, position, size, preMaximizeState]);

  // Reset loading state when URL changes
  useEffect(() => {
    setIsLoading(true);
  }, [url]);

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className="fixed bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: isMaximized ? '100vw' : size.width,
        height: isMaximized ? '100vh' : size.height,
        zIndex,
        borderRadius: isMaximized ? 0 : 12,
      }}
      onClick={onFocus}
    >
      {/* iOS-style handle bar */}
      <div
        className={`flex items-center justify-center h-7 bg-gray-100 border-b border-gray-200 cursor-grab active:cursor-grabbing ${isDragging ? 'cursor-grabbing' : ''}`}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="w-9 h-1 bg-gray-300 rounded-full" />
      </div>
      
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Traffic light buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors flex items-center justify-center group"
              title="Close"
            >
              <XMarkIcon className="w-2 h-2 text-red-800 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={handleToggleMaximize}
              className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-500 transition-colors flex items-center justify-center group"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <ArrowsPointingInIcon className="w-2 h-2 text-green-800 opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : (
                <ArrowsPointingOutIcon className="w-2 h-2 text-green-800 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
          <span className="text-xs font-medium text-gray-700 truncate">{title}</span>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 top-[68px] flex items-center justify-center bg-white z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        </div>
      )}

      {/* Iframe content */}
      <iframe
        src={url}
        className="flex-1 w-full border-0"
        title={title}
        onLoad={() => setIsLoading(false)}
        style={{ 
          pointerEvents: isDragging ? 'none' : 'auto',
        }}
      />

      {/* Resize handle (bottom-right corner) */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFocus?.();
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = size.width;
            const startHeight = size.height;

            const handleResize = (moveEvent: MouseEvent) => {
              const newWidth = Math.max(300, startWidth + (moveEvent.clientX - startX));
              const newHeight = Math.max(200, startHeight + (moveEvent.clientY - startY));
              setSize({ width: newWidth, height: newHeight });
            };

            const handleResizeEnd = () => {
              document.removeEventListener('mousemove', handleResize);
              document.removeEventListener('mouseup', handleResizeEnd);
            };

            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', handleResizeEnd);
          }}
        >
          <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V20H18V22ZM22 14H20V18H22V14Z" />
          </svg>
        </div>
      )}
    </div>
  );
}

