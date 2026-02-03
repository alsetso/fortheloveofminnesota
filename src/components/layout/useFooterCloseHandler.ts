import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface FooterCloseHandlerOptions {
  /** Callback to clear pin selection */
  onClearPinSelection?: () => void;
  /** Callback to clear location selection */
  onClearLocationSelection?: () => void;
  /** Callback to collapse footer */
  onCollapseFooter?: () => void;
  /** Callback to clear map selection (if exists) */
  onClearMapSelection?: () => void;
}

interface FooterCloseHandlerResult {
  /** Unified close handler - handles all close scenarios */
  handleClose: () => void;
  /** Whether close icon should be shown */
  shouldShowClose: boolean;
}

/**
 * Coordinated close handler - unified logic for closing search, selections, and footer
 * Handles all close scenarios in one place
 */
export function useFooterCloseHandler({
  onClearPinSelection,
  onClearLocationSelection,
  onCollapseFooter,
  onClearMapSelection,
}: FooterCloseHandlerOptions): FooterCloseHandlerResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClose = useCallback(() => {
    // 1. Close search if active (remove #search hash)
    if (typeof window !== 'undefined' && window.location.hash === '#search') {
      const newUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      window.history.pushState({}, '', newUrl);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }

    // 2. Clear all selections
    onClearPinSelection?.();
    onClearLocationSelection?.();
    onClearMapSelection?.();

    // 3. Clear URL params (pin, layer, id, but preserve type)
    const params = new URLSearchParams(searchParams.toString());
    params.delete('pin');
    params.delete('layer');
    params.delete('id');
    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl);

    // 4. Collapse footer to low state
    onCollapseFooter?.();
  }, [router, pathname, searchParams, onClearPinSelection, onClearLocationSelection, onCollapseFooter, onClearMapSelection]);

  // Determine if close icon should be shown
  // This will be enhanced by FooterStateManager, but provides basic logic
  const shouldShowClose = useCallback(() => {
    const hasPin = searchParams.get('pin');
    const hasLayer = searchParams.get('layer');
    const hasId = searchParams.get('id');
    const isSearchActive = typeof window !== 'undefined' && window.location.hash === '#search';
    
    return Boolean(hasPin || hasLayer || hasId || isSearchActive);
  }, [searchParams]);

  return {
    handleClose,
    shouldShowClose: shouldShowClose(),
  };
}
