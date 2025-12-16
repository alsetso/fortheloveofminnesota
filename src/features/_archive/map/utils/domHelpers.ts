/**
 * Safely query selector with null check
 */
export function safeQuerySelector(
  element: HTMLElement | null,
  selector: string
): HTMLElement | null {
  if (!element) return null;
  try {
    return element.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Safely check if element has class
 */
export function hasClass(element: HTMLElement | null, className: string): boolean {
  if (!element) return false;
  try {
    return element.classList.contains(className);
  } catch {
    return false;
  }
}

/**
 * Safely get closest parent element
 */
export function safeClosest(
  element: HTMLElement | null,
  selector: string
): HTMLElement | null {
  if (!element) return null;
  try {
    return element.closest(selector);
  } catch {
    return null;
  }
}

/**
 * Safely get attribute value
 */
export function safeGetAttribute(
  element: HTMLElement | null,
  attribute: string
): string | null {
  if (!element) return null;
  try {
    return element.getAttribute(attribute);
  } catch {
    return null;
  }
}

/**
 * Dispatch custom event safely
 */
export function dispatchCustomEvent(
  eventName: string,
  detail: Record<string, unknown>
): void {
  try {
    document.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
        bubbles: true,
      })
    );
  } catch (error) {
    console.error(`Error dispatching event ${eventName}:`, error);
  }
}



