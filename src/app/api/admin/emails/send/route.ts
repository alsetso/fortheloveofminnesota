import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { withSecurity } from '@/lib/security/middleware';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'For the Love of Minnesota <hi@fortheloveofminnesota.com>';

interface SendPayload {
  to: string[];
  subject: string;
  html: string;
}

/**
 * POST /api/admin/emails/send
 * Sends an email to selected recipients via Resend batch API.
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const body = (await request.json()) as SendPayload;
        const { to, subject, html } = body;

        if (!to?.length || !subject || !html) {
          return NextResponse.json(
            { error: 'Missing required fields: to, subject, html' },
            { status: 400 }
          );
        }

        // Resend batch supports up to 100 emails per call
        const BATCH_SIZE = 100;
        const results: Array<{ id?: string; error?: unknown }> = [];

        for (let i = 0; i < to.length; i += BATCH_SIZE) {
          const chunk = to.slice(i, i + BATCH_SIZE);
          const emails = chunk.map((email) => ({
            from: FROM_ADDRESS,
            to: [email],
            subject,
            html,
          }));

          const response = await resend.batch.send(emails);

          if (response.error) {
            console.error('[Admin Emails] Resend batch error:', response.error);
            results.push({ error: response.error });
          } else if (response.data) {
            for (const item of response.data.data) {
              results.push({ id: item.id });
            }
          }
        }

        const sent = results.filter((r) => r.id).length;
        const failed = results.filter((r) => r.error).length;

        return NextResponse.json({ sent, failed, total: to.length });
      } catch (error) {
        console.error('[Admin Emails] Send error:', error);
        return NextResponse.json(
          { error: 'Failed to send emails' },
          { status: 500 }
        );
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
