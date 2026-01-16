import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody, commonSchemas } from '@/lib/security/validation';
import { z } from 'zod';

const storeSkipTraceSchema = z.object({
  street: z.string().min(1).max(500),
  city: z.string().min(1).max(200),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  rawResponse: z.record(z.unknown()),
  searchQuery: z.string().max(500).optional(),
  profileId: commonSchemas.uuid.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  addressFull: z.string().max(500).optional(),
  callType: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
});

// Parse developer data from raw API response (duplicated from SkipTraceService)
function parseDeveloperData(rawResponse: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const parsed: Record<string, unknown> = {};

    if (rawResponse['Person Details'] || rawResponse.personDetails) {
      parsed.personDetails = rawResponse['Person Details'] || rawResponse.personDetails;
    }

    if (rawResponse['Email Addresses'] || rawResponse.emails || rawResponse.EmailAddresses) {
      parsed.emails = rawResponse['Email Addresses'] || rawResponse.emails || rawResponse.EmailAddresses;
    }

    if (rawResponse['All Phone Details'] || rawResponse.phones || rawResponse.AllPhoneDetails) {
      parsed.phones = rawResponse['All Phone Details'] || rawResponse.phones || rawResponse.AllPhoneDetails;
    }

    if (rawResponse['Current Address Details List'] || rawResponse.currentAddresses || rawResponse.CurrentAddressDetailsList) {
      parsed.currentAddresses = rawResponse['Current Address Details List'] || rawResponse.currentAddresses || rawResponse.CurrentAddressDetailsList;
    }

    if (rawResponse['Previous Address Details'] || rawResponse.previousAddresses || rawResponse.PreviousAddressDetails) {
      parsed.previousAddresses = rawResponse['Previous Address Details'] || rawResponse.previousAddresses || rawResponse.PreviousAddressDetails;
    }

    if (rawResponse['All Relatives'] || rawResponse.relatives || rawResponse.AllRelatives) {
      parsed.relatives = rawResponse['All Relatives'] || rawResponse.relatives || rawResponse.AllRelatives;
    }

    if (rawResponse['All Associates'] || rawResponse.associates || rawResponse.AllAssociates) {
      parsed.associates = rawResponse['All Associates'] || rawResponse.associates || rawResponse.AllAssociates;
    }

    if (rawResponse.status !== undefined) {
      parsed.status = rawResponse.status;
    }
    if (rawResponse.message !== undefined || rawResponse.Message !== undefined) {
      parsed.message = rawResponse.message || rawResponse.Message;
    }

    if (Array.isArray(rawResponse.data)) {
      parsed.data = rawResponse.data;
    }

    if (Array.isArray(rawResponse.results)) {
      parsed.results = rawResponse.results;
    }

    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch (error) {
    console.error('Error parsing developer data:', error);
    return null;
  }
}

/**
 * POST /api/skip-trace/store
 * Store skip trace result
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized', 401);
        }

        // Create response to hold cookies
        const response = new NextResponse();
        const cookieStore = await cookies();
        
        // Validate request body
        const validation = await validateRequestBody(req, storeSkipTraceSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const {
          street,
          city,
          state,
          zip,
          rawResponse,
          searchQuery,
          profileId,
          latitude,
          longitude,
          addressFull,
          callType,
          source
        } = validation.data;
        
        // Create Supabase client with proper cookie handling
        const supabase = createServerClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                  response.cookies.set({ name, value, ...options });
                });
              },
            },
          }
        );
        
        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          return createErrorResponse('Unauthorized', 401);
        }

        // Parse developer data from response
        const developerData = parseDeveloperData(rawResponse as Record<string, unknown>);

        // Build insert data
        const insertData: {
      user_id: string;
      profile_id?: string;
      api_type: string;
      search_query: string;
      call_type?: string;
      source?: string;
      latitude?: number;
      longitude?: number;
      address_street?: string;
      address_city?: string;
      address_state?: string;
      address_zip?: string;
      address_full?: string;
          developer_data: Record<string, unknown> | null;
          raw_response: Record<string, unknown>;
        } = {
          user_id: user.id,
          api_type: 'address',
          search_query: searchQuery || `${street}, ${city}, ${state} ${zip}`,
          developer_data: developerData,
          raw_response: rawResponse,
        };

        // Add profile_id if provided
        if (profileId) {
          insertData.profile_id = profileId;
        }

        // Add call_type if provided
        if (callType) {
          insertData.call_type = callType;
        }

        // Add source if provided
        if (source) {
          insertData.source = source;
        }

        // Add location data if provided (for pin drops)
        if (latitude !== undefined && longitude !== undefined) {
          insertData.latitude = latitude;
          insertData.longitude = longitude;
        }

        // Add address components
        insertData.address_street = street;
        insertData.address_city = city;
        insertData.address_state = state;
        insertData.address_zip = zip;
        if (addressFull) {
          insertData.address_full = addressFull;
        }

        // Save to database
        const { data, error } = await supabase
          .from('skip_tracing')
          .insert(insertData as any)
          .select()
          .single();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error saving skip trace result:', error);
          }
          return createErrorResponse('Failed to save skip trace result', 500);
        }

        return createSuccessResponse(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Skip trace store API error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

