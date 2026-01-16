import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * POST /api/contact
 * Contact form submission
 * 
 * Security:
 * - Rate limited: 10 requests/minute (strict) - prevent spam
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - HTML sanitization to prevent injection
 */
const contactFormSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().max(20).regex(/^\+?[\d\s()-]+$/, 'Invalid phone number format'),
  accountType: z.enum([
    'homeowner',
    'renter',
    'investor',
    'realtor',
    'wholesaler',
    'contractor',
    'service_provider',
    'developer',
    'property_manager',
    'business',
  ]).optional(),
});

// Initialize DOMPurify for server-side
const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window & typeof globalThis);

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // Validate request body
        const validation = await validateRequestBody(req, contactFormSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { name, email, phone, accountType } = validation.data;
        
        // Sanitize all user inputs to prevent HTML injection
        const sanitizedName = purify.sanitize(name);
        const sanitizedEmail = purify.sanitize(email);
        const sanitizedPhone = purify.sanitize(phone);

        // Check for Resend API key
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Missing RESEND_API_KEY');
          }
          return NextResponse.json(
            { error: 'Server configuration error: Email service not configured' },
            { status: 500 }
          );
        }

        // Format account type labels
        const accountTypeLabels: Record<string, string> = {
          homeowner: 'Homeowner',
          renter: 'Resident',
          investor: 'Investor',
          realtor: 'Realtor',
          wholesaler: 'Wholesaler',
          contractor: 'Contractor',
          service_provider: 'Service Provider',
          developer: 'Developer',
          property_manager: 'Property Manager',
          business: 'Business',
        };
        
        const accountTypeLabel = accountType ? accountTypeLabels[accountType] || accountType : 'Not specified';
        
        // Build email HTML content (using sanitized values)
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #000; color: #fff; padding: 20px; text-align: center; }
                .content { background-color: #f9f9f9; padding: 20px; }
                .field { margin-bottom: 15px; }
                .label { font-weight: bold; color: #666; }
                .value { color: #333; margin-top: 5px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>New Lead Submission</h1>
                </div>
                <div class="content">
                  <h2>Contact Information</h2>
                  <div class="field">
                    <div class="label">Name:</div>
                    <div class="value">${sanitizedName}</div>
                  </div>
                  <div class="field">
                    <div class="label">Email:</div>
                    <div class="value"><a href="mailto:${sanitizedEmail}">${sanitizedEmail}</a></div>
                  </div>
                  <div class="field">
                    <div class="label">Phone:</div>
                    <div class="value"><a href="tel:${sanitizedPhone}">${sanitizedPhone}</a></div>
                  </div>
                  
                  <h2 style="margin-top: 30px;">Account Type</h2>
                  <div class="field">
                    <div class="label">Account Type:</div>
                    <div class="value">${accountTypeLabel}</div>
                  </div>
                  
                  <div class="field" style="margin-top: 30px;">
                    <div class="label">Submitted:</div>
                    <div class="value">${new Date().toLocaleString()}</div>
                  </div>
                </div>
                <div class="footer">
                  <p>This lead was submitted through the website contact form.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        // Build email text content (plain text fallback)
        const emailText = `
New Lead Submission

Contact Information:
Name: ${sanitizedName}
Email: ${sanitizedEmail}
Phone: ${sanitizedPhone}

Account Type:
Account Type: ${accountTypeLabel}

Submitted: ${new Date().toLocaleString()}

This lead was submitted through the website contact form.
        `.trim();

        // Send email directly via Resend API
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: 'For the Love of Minnesota <hi@fortheloveofminnesota.com>',
              to: 'hi@fortheloveofminnesota.com',
              subject: `New Lead: ${sanitizedName} - ${accountTypeLabel}`,
              html: emailHtml,
              text: emailText,
            }),
          });

          if (!resendResponse.ok) {
            const errorData = await resendResponse.json().catch(() => ({}));
            if (process.env.NODE_ENV === 'development') {
              console.error('Resend API error:', {
                status: resendResponse.status,
                statusText: resendResponse.statusText,
                error: errorData,
              });
            }
            return NextResponse.json(
              { error: 'Failed to send email. Please try again later.' },
              { status: 500 }
            );
          }

          const resendResult = await resendResponse.json();
          if (process.env.NODE_ENV === 'development') {
            console.log('Lead email sent successfully via Resend:', {
              id: resendResult.id,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (emailError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error sending email via Resend:', emailError);
          }
          return NextResponse.json(
            { error: 'Failed to send email. Please try again later.' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { success: true, message: 'Form submitted successfully' },
          { status: 200 }
        );
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Contact API error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict', // 10 requests/minute - prevent spam
      requireAuth: false, // Public form
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

