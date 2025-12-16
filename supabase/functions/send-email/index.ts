// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@2.0.0";

// General email payload types
interface EmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
}

// Get Resend API key from environment
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Helper function to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.error('[ERROR][send-email] Invalid method:', req.method);
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    // Verify Authorization header (service role key or anon key)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Parse email payload
    const payload = await req.json() as EmailPayload;
    const { to, subject, html, text } = payload;

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return jsonResponse(
        { success: false, error: 'Missing required fields: to, subject, and html or text' },
        400
      );
    }

    // Check if RESEND_API_KEY is configured
    if (!RESEND_API_KEY) {
      console.error('[ERROR][send-email] RESEND_API_KEY not configured');
      return jsonResponse(
        { success: false, error: 'Email service not configured' },
        500
      );
    }

    // Send email via Resend API
    try {
      const resend = new Resend(RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: 'For the Love of Minnesota <hi@fortheloveofminnesota.com>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || undefined,
        text: text || undefined,
      });

      if (error) {
        console.error('[ERROR][send-email] Resend API error:', error);
        return jsonResponse(
          { success: false, error: 'Failed to send email via Resend', details: error },
          500
        );
      }

      console.log('[INFO][send-email] Email sent successfully', {
        to,
        messageId: data?.id,
      });
      return jsonResponse({ success: true, id: data?.id }, 200);
    } catch (err) {
      console.error('[ERROR][send-email] Failed to send email:', err);
      return jsonResponse({ success: false, error: 'Failed to send email' }, 500);
    }
  } catch (error) {
    console.error('[ERROR][send-email] Edge function error:', error);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

