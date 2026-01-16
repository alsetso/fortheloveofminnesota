// API service for property data calls
import { apiConfig, shouldUseMockData, getApiHeaders } from '../config/apiConfig';

// Global callback for API usage updates - will be set by the context provider
let _onApiUsageUpdate: (() => void) | null = null;

export const setApiUsageUpdateCallback = (callback: (() => void) | null) => {
  _onApiUsageUpdate = callback;
};

export interface ApiOption {
  id: string;
  name: string;
  description: string;
  curl: string;
  endpoint: string;
  headers: Record<string, string>;
}

export const apiOptions: ApiOption[] = [
  {
    id: 'zillow',
    name: 'Zillow Search',
    description: 'Search property data from Zillow API',
    curl: `curl --request GET \\
	--url 'https://zillow56.p.rapidapi.com/search_address?address=1161%20Natchez%20Dr%20College%20Station%20Texas%2077845' \\
	--header 'x-rapidapi-host: zillow56.p.rapidapi.com' \\
	--header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'`,
    endpoint: 'https://zillow56.p.rapidapi.com/search_address',
    headers: getApiHeaders('zillow')
  },
  {
    id: 'skip-trace',
    name: 'Skip Trace',
    description: 'Skip tracing and property owner data',
    curl: `curl --request GET \\
	--url 'https://skip-tracing-working-api.p.rapidapi.com/search/byaddress?street=3828%20Double%20Oak%20Ln&citystatezip=Irving%2C%20TX%2075061&page=1' \\
	--header 'x-rapidapi-host: skip-tracing-working-api.p.rapidapi.com' \\
	--header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'`,
    endpoint: 'https://skip-tracing-working-api.p.rapidapi.com/search/byaddress',
    headers: getApiHeaders('skipTrace')
  }
];

// Custom error class for credit exhaustion
export class CreditsExhaustedError extends Error {
  constructor(message: string = 'Daily API limit reached. Please try again tomorrow.') {
    super(message);
    this.name = 'CreditsExhaustedError';
  }
}

export const apiService = {
  async callZillowAPI(address: { street: string; city: string; state: string; zip: string }): Promise<unknown> {
    const fullAddress = `${address.street} ${address.city} ${address.state} ${address.zip}`;
    
    // Use proxy route instead of direct API call
    const response = await fetch('/api/proxy/zillow/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: fullAddress }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Zillow API error: ${response.status}`);
    }

    return response.json();
  },

  async callSkipTraceAPI(address: { street: string; city: string; state: string; zip: string }): Promise<unknown> {
    // Check if we should use mock data
    if (shouldUseMockData('skipTrace')) {
      return this.getMockSkipTraceData(address);
    }
    
    const cityStateZip = `${address.city}, ${address.state} ${address.zip}`;
    
    // Use proxy route instead of direct API call
    try {
      const response = await fetch('/api/proxy/skip-trace/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'address',
          street: address.street,
          citystatezip: cityStateZip,
          page: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Skip Trace API error: ${response.status}`;
        console.error(`Skip Trace API error: ${response.status}`, errorMessage);
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      console.error('Skip Trace API request failed:', error);
      throw error;
    }
  },

  // Mock data for development when API fails
  getMockSkipTraceData(address: { street: string; city: string; state: string; zip: string }): unknown {
    return {
      success: true,
      data: [
        {
          "Person ID": "mock-person-1",
          "Name": "John Smith",
          "Age": "45",
          "Address": `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
          "Phone": "(555) 123-4567",
          "Email": "john.smith@email.com",
          "Relationship": "Property Owner"
        },
        {
          "Person ID": "mock-person-2", 
          "Name": "Jane Smith",
          "Age": "42",
          "Address": `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
          "Phone": "(555) 987-6543",
          "Email": "jane.smith@email.com",
          "Relationship": "Spouse"
        }
      ],
      message: "Mock data - API unavailable",
      total: 2
    };
  },

  async callPersonAPI(personId: string, retryCount = 0): Promise<unknown> {
    // Use proxy route instead of direct API call
    try {
      const response = await fetch('/api/proxy/skip-trace/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'person',
          personId,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.callPersonAPI(personId, retryCount + 1);
          }
          throw new Error(`Person API rate limit exceeded (429). Please wait before making another request.`);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Person API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('rate limit')) {
        throw error; // Re-throw rate limit errors
      }
      throw error;
    }
  },

  async callNameSearchAPI(name: { firstName: string; middleInitial?: string; lastName: string }): Promise<unknown> {
    // Format name as "FirstName MiddleInitial LastName" or "FirstName LastName"
    const fullName = name.middleInitial 
      ? `${name.firstName} ${name.middleInitial} ${name.lastName}`
      : `${name.firstName} ${name.lastName}`;
    
    // Use proxy route instead of direct API call
    const response = await fetch('/api/proxy/skip-trace/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'name',
        name: fullName,
        page: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Name Search API error: ${response.status}`);
    }

    return response.json();
  },

  async callEmailSearchAPI(email: string): Promise<unknown> {
    // Use proxy route instead of direct API call
    const response = await fetch('/api/proxy/skip-trace/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'email',
        email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Email Search API error: ${response.status}`);
    }

    return response.json();
  },

  async callPhoneSearchAPI(phone: string): Promise<unknown> {
    // Use proxy route instead of direct API call
    const response = await fetch('/api/proxy/skip-trace/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'phone',
        phone,
        page: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Phone Search API error: ${response.status}`);
    }

    return response.json();
  }
};
