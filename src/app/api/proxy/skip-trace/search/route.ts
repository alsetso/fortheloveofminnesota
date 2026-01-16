import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/security/apiKeys';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * POST /api/proxy/skip-trace/search
 * Proxy route for Skip Trace API searches
 * 
 * Security:
 * - Rate limited: 60 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Server-only API key
 */
const skipTraceSearchSchema = z.object({
  type: z.enum(['name', 'address', 'phone', 'email', 'person']),
  // Name search
  name: z.string().min(1).max(200).optional(),
  // Address search
  street: z.string().max(200).optional(),
  citystatezip: z.string().max(100).optional(),
  // Phone search
  phone: z.string().max(20).optional(),
  // Email search
  email: z.string().email().max(200).optional(),
  // Person details
  personId: z.string().max(100).optional(),
  // Common params
  page: z.number().int().min(1).max(100).default(1).optional(),
});

const RAPIDAPI_HOST = 'skip-tracing-working-api.p.rapidapi.com';

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId }) => {
      try {
        // Get server-only API key
        const apiKey = getApiKey('RAPIDAPI');
        
        // Validate request body
        const validation = await validateRequestBody(req, skipTraceSearchSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { type, name, street, citystatezip, phone, email, personId, page = 1 } = validation.data;
        
        // Build URL based on search type
        let url: string;
        
        switch (type) {
          case 'name':
            if (!name) {
              return NextResponse.json(
                { error: 'Name is required for name search' },
                { status: 400 }
              );
            }
            url = `https://${RAPIDAPI_HOST}/search/byname?name=${encodeURIComponent(name)}&page=${page}`;
            break;
            
          case 'address':
            if (!street || !citystatezip) {
              return NextResponse.json(
                { error: 'Street and citystatezip are required for address search' },
                { status: 400 }
              );
            }
            url = `https://${RAPIDAPI_HOST}/search/byaddress?street=${encodeURIComponent(street)}&citystatezip=${encodeURIComponent(citystatezip)}&page=${page}`;
            break;
            
          case 'phone':
            if (!phone) {
              return NextResponse.json(
                { error: 'Phone is required for phone search' },
                { status: 400 }
              );
            }
            url = `https://${RAPIDAPI_HOST}/search/byphone?phoneno=${encodeURIComponent(phone)}&page=${page}`;
            break;
            
          case 'email':
            if (!email) {
              return NextResponse.json(
                { error: 'Email is required for email search' },
                { status: 400 }
              );
            }
            url = `https://${RAPIDAPI_HOST}/search/byemail?email=${encodeURIComponent(email)}&phone=1`;
            break;
            
          case 'person':
            if (!personId) {
              return NextResponse.json(
                { error: 'Person ID is required for person details' },
                { status: 400 }
              );
            }
            url = `https://${RAPIDAPI_HOST}/search/detailsbyID?peo_id=${encodeURIComponent(personId)}`;
            break;
            
          default:
            return NextResponse.json(
              { error: 'Invalid search type' },
              { status: 400 }
            );
        }
        
        // Proxy request to RapidAPI
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': apiKey,
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          const statusCode = response.status >= 500 ? 502 : response.status;
          
          // Check if it's a subscription error
          const isSubscriptionError = response.status === 403 || 
            errorText.toLowerCase().includes('not subscribed');
          
          if (process.env.NODE_ENV === 'development') {
            console.error('Skip Trace API error:', {
              status: response.status,
              type,
              error: errorText,
            });
          }
          
          return NextResponse.json(
            {
              error: 'Skip Trace API error',
              message: isSubscriptionError 
                ? 'API subscription required or expired'
                : 'Failed to fetch data from Skip Trace API',
              status: response.status,
              isSubscriptionError,
            },
            { status: statusCode }
          );
        }
        
        const data = await response.json();
        
        return NextResponse.json(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Skip Trace proxy error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true, // Require authentication for skip trace
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
