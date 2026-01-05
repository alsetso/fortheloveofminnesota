'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DraggableBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
  initialHeight?: number;
  snapPoints?: number[];
  showBackdrop?: boolean;
  backdropOpacity?: number;
  className?: string;
  sheetClassName?: string;
  zIndex?: number;
  backdropZIndex?: number;
  maxWidth?: string;
  centered?: boolean;
  leftOffset?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
}

export default function DraggableBottomSheet({
  isOpen,
  onClose,
  title,
  header,
  children,
  initialHeight = 80,
  snapPoints = [25, 50, 80],
  showBackdrop = true,
  backdropOpacity = 0.4,
  className = '',
  sheetClassName = '',
  zIndex = 50,
  backdropZIndex = 40,
  maxWidth,
  centered = false,
  leftOffset,
  contentClassName = 'p-4',
  showCloseButton = true,
}: DraggableBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Drag state
  const dragStartY = useRef<number>(0);
  const dragStartTranslateY = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const currentTranslateY = useRef<number>(0);
  
  // Velocity tracking (using last 5 samples for smoother calculation)
  const velocitySamples = useRef<Array<{ y: number; time: number }>>([]);
  const MAX_VELOCITY_SAMPLES = 5;
  
  // Momentum animation
  const momentumAnimationRef = useRef<number | null>(null);
  const isAnimatingRef = useRef<boolean>(false);

  const [translateY, setTranslateY] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Convert percentage to pixels
  const percentageToPixels = useCallback((percentage: number) => {
    return (window.innerHeight * percentage) / 100;
  }, []);

  // Calculate translateY from percentage
  const percentageToTranslateY = useCallback((percentage: number) => {
    const height = percentageToPixels(percentage);
    return window.innerHeight - height;
  }, [percentageToPixels]);

  // Calculate velocity from samples
  const calculateVelocity = useCallback(() => {
    const samples = velocitySamples.current;
    if (samples.length < 2) return 0;

    const oldest = samples[0];
    const newest = samples[samples.length - 1];
    const timeDelta = newest.time - oldest.time;
    
    if (timeDelta <= 0) return 0;
    
    const yDelta = newest.y - oldest.y;
    return yDelta / timeDelta; // pixels per ms
  }, []);

  // Find nearest snap point
  const findNearestSnapPoint = useCallback((currentTranslateY: number) => {
    const currentPercentage = ((window.innerHeight - currentTranslateY) / window.innerHeight) * 100;
    
    let nearest = snapPoints[0];
    let minDiff = Math.abs(currentPercentage - nearest);
    
    for (const point of snapPoints) {
      const diff = Math.abs(currentPercentage - point);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = point;
      }
    }
    
    return nearest;
  }, [snapPoints]);

  // Apply rubber band effect when dragging past boundaries
  const applyRubberBand = useCallback((translateY: number, minY: number, maxY: number): number => {
    if (translateY < minY) {
      // Dragging up past top - apply resistance
      const over = minY - translateY;
      return minY - over * 0.3; // 30% resistance
    }
    if (translateY > maxY) {
      // Dragging down past bottom - apply resistance
      const over = translateY - maxY;
      return maxY + over * 0.3; // 30% resistance
    }
    return translateY;
  }, []);

  // Update position with RAF for smooth animation
  const updatePosition = useCallback((newTranslateY: number, useRubberBand = false) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const minY = 0;
      const maxY = window.innerHeight;
      
      const finalY = useRubberBand 
        ? applyRubberBand(newTranslateY, minY, maxY)
        : Math.max(minY, Math.min(maxY, newTranslateY));
      
      currentTranslateY.current = finalY;
      setTranslateY(finalY);
    });
  }, [applyRubberBand]);

  // Momentum animation with spring physics
  const animateWithMomentum = useCallback((startY: number, velocity: number, targetY: number) => {
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
    }

    isAnimatingRef.current = true;
    setIsTransitioning(true);
    
    const startTime = performance.now();
    const spring = 0.15; // Spring constant (lower = more bouncy)
    const damping = 0.8; // Damping factor
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / 300, 1); // Max 300ms
      
      // Spring physics with damping
      const distance = targetY - startY;
      const springForce = distance * spring;
      const dampingForce = velocity * damping;
      const acceleration = springForce - dampingForce;
      
      const newY = startY + distance * (1 - Math.exp(-spring * progress)) + velocity * progress * damping;
      
      updatePosition(newY, false);
      
      if (Math.abs(newY - targetY) > 0.5 && progress < 1) {
        momentumAnimationRef.current = requestAnimationFrame(animate);
      } else {
        updatePosition(targetY, false);
        isAnimatingRef.current = false;
        momentumAnimationRef.current = null;
      }
    };

    momentumAnimationRef.current = requestAnimationFrame(animate);
  }, [updatePosition]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!sheetRef.current || isAnimatingRef.current) return;
    
    // Cancel any ongoing momentum animation
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
      momentumAnimationRef.current = null;
      isAnimatingRef.current = false;
    }
    
    isDraggingRef.current = true;
    setIsTransitioning(false);
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartTranslateY.current = currentTranslateY.current;
    
    // Reset velocity samples
    velocitySamples.current = [{ y: clientY, time: performance.now() }];
    
    if ('preventDefault' in e) {
      e.preventDefault();
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }, []);

  // Handle drag move
  useEffect(() => {
    if (!isDraggingRef.current) return;

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!sheetRef.current || !isDraggingRef.current) return;
      
      e.preventDefault();
      
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const now = performance.now();
      
      // Track velocity samples
      velocitySamples.current.push({ y: clientY, time: now });
      if (velocitySamples.current.length > MAX_VELOCITY_SAMPLES) {
        velocitySamples.current.shift();
      }
      
      const deltaY = clientY - dragStartY.current;
      const newTranslateY = dragStartTranslateY.current + deltaY;
      
      // Apply rubber band effect
      updatePosition(newTranslateY, true);
    };

    const handleEnd = () => {
      if (!isDraggingRef.current || !sheetRef.current) return;
      
      isDraggingRef.current = false;
      
      // Restore body scroll
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      
      const velocity = calculateVelocity();
      const currentY = currentTranslateY.current;
      const currentPercentage = ((window.innerHeight - currentY) / window.innerHeight) * 100;
      
      // Determine target based on velocity and position
      const VELOCITY_THRESHOLD = 0.5; // pixels per ms
      const CLOSE_THRESHOLD = 0.6; // 60% of viewport
      
      let targetPercentage: number;
      
      // High velocity down - close
      if (velocity > VELOCITY_THRESHOLD) {
        targetPercentage = 0;
      }
      // High velocity up - go to next snap point
      else if (velocity < -VELOCITY_THRESHOLD) {
        const nextPoint = snapPoints.find(p => p > currentPercentage) || snapPoints[snapPoints.length - 1];
        targetPercentage = nextPoint;
      }
      // Dragged down past threshold - close
      else if (currentY > window.innerHeight * CLOSE_THRESHOLD) {
        targetPercentage = 0;
      }
      // Slow drag - snap to nearest
      else {
        targetPercentage = findNearestSnapPoint(currentY);
      }
      
      const targetTranslateY = targetPercentage === 0 
        ? window.innerHeight 
        : percentageToTranslateY(targetPercentage);
      
      // Animate to target with momentum
      animateWithMomentum(currentY, velocity, targetTranslateY);
      
      // If closing, call onClose after animation
      if (targetPercentage === 0) {
        setTimeout(() => {
          onClose();
          setTranslateY(0);
          velocitySamples.current = [];
        }, 350);
      } else {
        velocitySamples.current = [];
      }
    };

    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd, { passive: true });
    document.addEventListener('touchcancel', handleEnd, { passive: true });
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('mouseleave', handleEnd);

    return () => {
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('mouseleave', handleEnd);
    };
  }, [calculateVelocity, snapPoints, findNearestSnapPoint, percentageToTranslateY, animateWithMomentum, onClose, updatePosition]);

  // Initialize position when opening
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      setIsTransitioning(true);
      const targetTranslateY = percentageToTranslateY(initialHeight);
      currentTranslateY.current = targetTranslateY;
      setTranslateY(targetTranslateY);
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else if (!isOpen) {
      // Restore body scroll
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      const closedY = window.innerHeight;
      currentTranslateY.current = closedY;
      setTranslateY(closedY);
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen, initialHeight, percentageToTranslateY]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (isTransitioning || isDraggingRef.current || isAnimatingRef.current) return;
    setIsTransitioning(true);
    const closedY = window.innerHeight;
    animateWithMomentum(currentTranslateY.current, 0, closedY);
    setTimeout(() => {
      onClose();
      setTranslateY(0);
    }, 350);
  }, [onClose, isTransitioning, animateWithMomentum]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (momentumAnimationRef.current) {
        cancelAnimationFrame(momentumAnimationRef.current);
      }
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  if (!isOpen) return null;

  const sheetStyle: React.CSSProperties = {
    transform: centered 
      ? `translate3d(-50%, ${translateY}px, 0)` 
      : `translate3d(0, ${translateY}px, 0)`,
    transition: isTransitioning && !isDraggingRef.current && !isAnimatingRef.current
      ? 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)' 
      : 'none',
    maxHeight: '90vh',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex,
    willChange: isDraggingRef.current || isAnimatingRef.current ? 'transform' : 'auto',
  };

  if (maxWidth) {
    sheetStyle.maxWidth = maxWidth;
  }

  const sheetClasses = [
    'fixed bottom-0 bg-white rounded-t-2xl shadow-2xl flex flex-col',
    centered ? 'left-1/2' : leftOffset ? '' : 'left-0',
    centered ? '' : leftOffset ? '' : 'right-0',
    className,
    sheetClassName,
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Backdrop */}
      {showBackdrop && (
        <div
          ref={backdropRef}
          onClick={handleBackdropClick}
          className="fixed inset-0 bg-black transition-opacity duration-300"
          style={{ opacity: backdropOpacity, zIndex: backdropZIndex }}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={sheetClasses}
        style={sheetStyle}
      >
        {/* Drag Handle */}
        <div
          className="flex items-center justify-center pt-3 pb-2 flex-shrink-0"
          onTouchStart={handleDragStart}
          onMouseDown={handleDragStart}
          style={{ 
            cursor: isDraggingRef.current ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {(title || header) && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 flex-shrink-0">
            {header || <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={handleBackdropClick}
                className="p-1.5 -mr-1.5 text-gray-500 hover:text-gray-900 transition-colors touch-manipulation"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            touchAction: isDraggingRef.current ? 'none' : 'pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className={contentClassName}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
