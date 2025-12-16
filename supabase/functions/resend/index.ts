import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@2.0.0";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

function getOtpTemplate(email: string, code: string): string {
  // Split code into individual digits for display
  const digits = code.split('');
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Access Code - For the Love of Minnesota</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
        <tr>
          <td align="center" style="padding: 60px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom: 40px;">
                  <img src="https://fortheloveofminnesota.com/fav.png" alt="For the Love of Minnesota" style="max-width: 200px; height: auto;" />
                </td>
              </tr>
              
              <!-- Welcome Message -->
              <tr>
                <td align="center" style="padding-bottom: 20px;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 600; line-height: 1.2;">Welcome</h1>
                </td>
              </tr>
              
              <!-- Access Code Message -->
              <tr>
                <td align="center" style="padding-bottom: 40px;">
                  <p style="margin: 0; color: #ffffff; font-size: 18px; line-height: 1.5;">Here's your access code</p>
                </td>
              </tr>
              
              <!-- OTP Code Display -->
              <tr>
                <td align="center" style="padding-bottom: 40px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      ${digits.map(digit => `
                        <td align="center" style="padding: 0 8px;">
                          <div style="background-color: #ffffff; color: #000000; width: 60px; height: 80px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 0;">
                            ${digit}
                          </div>
                        </td>
                      `).join('')}
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Expiry Notice -->
              <tr>
                <td align="center">
                  <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.5;">This code expires in 10 minutes</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  try {
    const { user, email_data } = await req.json();

    if (!user?.email || !email_data?.token) {
      return new Response(JSON.stringify({ success: false }), { status: 200, headers });
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ success: false }), { status: 200, headers });
    }

      const resend = new Resend(RESEND_API_KEY);
    const html = getOtpTemplate(user.email, email_data.token);
      
    await resend.emails.send({
        from: 'For the Love of Minnesota <hi@fortheloveofminnesota.com>',
      to: user.email,
        subject: 'Your Access Code - For the Love of Minnesota',
        html,
      });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 200, headers });
  }
});
