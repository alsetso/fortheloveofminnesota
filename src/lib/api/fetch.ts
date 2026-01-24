/**
 * Simple fetch wrapper with automatic error handling
 * Automatically shows toast notifications for errors
 */

type FetchOptions = RequestInit & {
  skipErrorToast?: boolean;
};

export async function apiFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipErrorToast = false, ...fetchOptions } = options;

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorMsg = `Request failed: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch {
        // If JSON parsing fails, use status text
      }

      // Show toast unless skipped
      if (!skipErrorToast && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('show-error-toast', { 
          detail: { message: errorMsg } 
        }));
      }

      throw new Error(errorMsg);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}
