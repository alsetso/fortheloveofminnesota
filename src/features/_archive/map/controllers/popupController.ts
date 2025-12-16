import type { Map as MapboxMap, Popup, Marker } from 'mapbox-gl';
import { loadMapboxGL } from '../utils/mapboxLoader';
import {
  safeQuerySelector,
  hasClass,
  safeClosest,
  safeGetAttribute,
  dispatchCustomEvent,
} from '../utils/domHelpers';

export interface PopupController {
  setupPopupListeners: (popup: Popup, id: string) => void;
  createPopup: (content: string, options?: Partial<PopupOptions>) => Popup;
  updatePopupContent: (marker: Marker, content: string, id: string) => void;
  removePopup: (marker: Marker) => void;
}

interface PopupOptions {
  offset: number;
  closeButton: boolean;
  closeOnClick: boolean;
  className: string;
  maxWidth: string;
}

/**
 * Create popup controller instance
 */
export function createPopupController(map: MapboxMap): PopupController {
  const setupPopupListeners = (popup: Popup, id: string): void => {
    popup.on('open', () => {
      const popupElement = popup.getElement();
      if (!popupElement) return;

      const popupContent = safeQuerySelector(
        popupElement,
        '.mapboxgl-popup-content'
      ) as HTMLElement;

      // Apply styling for pin popup containers
      if (popupContent && hasClass(popupElement, 'pin-popup-container')) {
        popupContent.style.background = 'transparent';
        popupContent.style.backdropFilter = 'blur(5px)';
        popupContent.style.border = '1px solid rgba(255, 255, 255, 0.3)';
      }

      // Setup click event delegation for edit/delete buttons
      popupElement.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const pinActionBtn = safeClosest(
          target,
          '.pin-edit-btn, .pin-delete-btn'
        );

        if (pinActionBtn) {
          e.stopPropagation();

          const pinId = safeGetAttribute(pinActionBtn, 'data-pin-id');
          const action = safeGetAttribute(pinActionBtn, 'data-action');

          if (pinId && action) {
            dispatchCustomEvent('pinAction', {
              pinId,
              action,
              markerId: id,
            });
          }
        }
      });
    });
  };

  const createPopup = (
    content: string,
    options?: Partial<PopupOptions>
  ): Popup => {
    // Note: This assumes mapbox is already loaded
    // In practice, this should be called after mapbox is loaded
    const mapbox = await import('mapbox-gl');

    const popupOptions: PopupOptions = {
      offset: 25,
      closeButton: false,
      closeOnClick: false,
      className: 'pin-popup-container',
      maxWidth: '300px',
      ...options,
    };

    return new mapbox.Popup(popupOptions).setHTML(content);
  };

  const updatePopupContent = (
    marker: Marker,
    content: string,
    id: string
  ): void => {
    const existingPopup = marker.getPopup();
    if (existingPopup) {
      existingPopup.setHTML(content);
    } else {
      // Create new popup if none exists
      const popup = createPopup(content);
      marker.setPopup(popup);
      setupPopupListeners(popup, id);
    }
  };

  const removePopup = (marker: Marker): void => {
    marker.setPopup(null);
  };

  return {
    setupPopupListeners,
    createPopup,
    updatePopupContent,
    removePopup,
  };
}

