import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, accountType } = body;

    // Validate required fields
    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, phone' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check for Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY');
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

    // Build email HTML content
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
                <div class="value">${name}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value"><a href="mailto:${email}">${email}</a></div>
              </div>
              <div class="field">
                <div class="label">Phone:</div>
                <div class="value"><a href="tel:${phone}">${phone}</a></div>
              </div>
              
              <h2 style="margin-top: 30px;">Account Type</h2>
              <div class="field">
                <div class="label">Account Type:</div>
                <div class="value">${accountTypeLabels[accountType] || accountType || 'Not specified'}</div>
              </div>
              
              <div class="field" style="margin-top: 30px;">
                <div class="label">Submitted:</div>
                <div class="value">${new Date().toLocaleString()}</div>
              </div>
            </div>
            <div class="footer">
              <p>This lead was submitted through the MNUDA website contact form.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Build email text content (plain text fallback)
    const emailText = `
New Lead Submission

Contact Information:
Name: ${name}
Email: ${email}
Phone: ${phone}

Account Type:
Account Type: ${accountTypeLabels[accountType] || accountType || 'Not specified'}

Submitted: ${new Date().toLocaleString()}

This lead was submitted through the MNUDA website contact form.
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
          subject: `New Lead: ${name} - ${accountTypeLabels[accountType] || accountType || 'Inquiry'}`,
          html: emailHtml,
          text: emailText,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json().catch(() => ({}));
        console.error('Resend API error:', {
          status: resendResponse.status,
          statusText: resendResponse.statusText,
          error: errorData,
        });
        return NextResponse.json(
          { error: `Failed to send email: ${errorData.message || resendResponse.statusText}` },
          { status: 500 }
        );
      }

      const resendResult = await resendResponse.json();
      console.log('Lead email sent successfully via Resend:', {
        id: resendResult.id,
        name,
        email,
        phone,
        accountType,
        timestamp: new Date().toISOString(),
      });
    } catch (emailError) {
      console.error('Error sending email via Resend:', emailError);
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
    console.error('Contact API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

