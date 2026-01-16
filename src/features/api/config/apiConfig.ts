// ============================================================================
// API CONFIGURATION
// ============================================================================
// Centralized API configuration for external services
// NOTE: API keys are now server-only. Client-side code uses proxy routes.

export interface ApiConfig {
  skipTrace: {
    enabled: boolean;
    endpoint: string;
    host: string;
    useMockData: boolean;
  };
  zillow: {
    enabled: boolean;
    endpoint: string;
    host: string;
    useMockData: boolean;
  };
}

// Check if mock data should be used (no longer depends on API key presence)
const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

export const apiConfig: ApiConfig = {
  skipTrace: {
    enabled: true,
    endpoint: 'https://skip-tracing-working-api.p.rapidapi.com/search/byaddress',
    host: 'skip-tracing-working-api.p.rapidapi.com',
    useMockData
  },
  zillow: {
    enabled: true,
    endpoint: 'https://zillow56.p.rapidapi.com/search_address',
    host: 'zillow56.p.rapidapi.com',
    useMockData
  }
};

// Helper function to check if we should use mock data
export const shouldUseMockData = (service: keyof ApiConfig): boolean => {
  return apiConfig[service].useMockData || !apiConfig[service].enabled;
};

// DEPRECATED: getApiHeaders is no longer used (client-side code uses proxy routes)
// Kept for backward compatibility but returns empty headers
export const getApiHeaders = (_service: keyof ApiConfig): Record<string, string> => {
  console.warn('getApiHeaders is deprecated. Client-side code should use proxy routes instead.');
  return {};
};
