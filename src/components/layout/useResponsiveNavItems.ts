import { useState, useEffect, useRef } from 'react';

interface UseResponsiveNavItemsOptions {
  minItemWidth?: number; // Minimum width per item in pixels
  containerPadding?: number; // Container padding
  gap?: number; // Gap between items
  moreButtonWidth?: number; // Width of "More" button
}

interface UseResponsiveNavItemsResult<T> {
  visibleItems: T[];
  overflowItems: T[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook to calculate which nav items should be visible vs overflow into "More" menu
 * Based on available container width
 */
export function useResponsiveNavItems<T>(
  items: T[],
  options: UseResponsiveNavItemsOptions = {}
): UseResponsiveNavItemsResult<T> {
  const {
    minItemWidth = 60, // Each nav item is roughly 60px (flex-1 but with min constraint)
    containerPadding = 16, // px-2 = 8px each side = 16px total
    gap = 0, // justify-around handles spacing
    moreButtonWidth = 60,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useEffect(() => {
    const calculateVisibleItems = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const availableWidth = containerWidth - containerPadding;

      // Calculate how many items can fit
      // We need space for: visible items + (maybe) More button
      let count = 0;
      let totalWidth = 0;

      // Try to fit items one by one
      for (let i = 0; i < items.length; i++) {
        const itemWidth = minItemWidth;
        const wouldNeedMoreButton = i < items.length - 1; // Need More if not last item

        if (wouldNeedMoreButton) {
          // If we'd need a More button, check if we have space for item + More button
          if (totalWidth + itemWidth + moreButtonWidth <= availableWidth) {
            totalWidth += itemWidth;
            count++;
          } else {
            // Can't fit this item + More button, stop here
            break;
          }
        } else {
          // Last item, no More button needed
          if (totalWidth + itemWidth <= availableWidth) {
            count++;
          }
        }
      }

      // Always show at least 1 item if we have items
      setVisibleCount(Math.max(1, Math.min(count, items.length)));
    };

    calculateVisibleItems();

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateVisibleItems);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', calculateVisibleItems);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateVisibleItems);
    };
  }, [items.length, minItemWidth, containerPadding, gap, moreButtonWidth]);

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);

  return {
    visibleItems,
    overflowItems,
    containerRef,
  };
}

