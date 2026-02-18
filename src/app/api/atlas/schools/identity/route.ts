import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

const updateSchema = z.object({
  school_id: z.string().uuid(),
  primary_color: z.string().max(20).nullable().optional(),
  secondary_color: z.string().max(20).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  website_url: z.string().url().nullable().optional(),
  principal_name: z.string().max(200).nullable().optional(),
  enrollment: z.number().int().min(0).nullable().optional(),
  year_established: z.number().int().min(1800).max(2100).nullable().optional(),
  grade_low: z.number().int().min(-1).max(12).nullable().optional(),
  grade_high: z.number().int().min(-1).max(12).nullable().optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  conference: z.string().max(200).nullable().optional(),
  mascot_name: z.string().max(100).nullable().optional(),
  mascot_url: z.string().url().nullable().optional(),
});

type MediaRole = 'logo' | 'cover' | 'mascot';

export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const body = await req.json();
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { school_id, primary_color, secondary_color, logo_url, cover_url,
        name, address, phone, website_url, principal_name, enrollment,
        year_established, grade_low, grade_high, tagline, description,
        conference, mascot_name, mascot_url } = parsed.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atlas = supabase.schema('atlas' as any);

      const schoolUpdates: Record<string, unknown> = {};
      if (primary_color !== undefined) schoolUpdates.primary_color = primary_color;
      if (secondary_color !== undefined) schoolUpdates.secondary_color = secondary_color;
      if (name !== undefined) schoolUpdates.name = name;
      if (address !== undefined) schoolUpdates.address = address;
      if (phone !== undefined) schoolUpdates.phone = phone;
      if (website_url !== undefined) schoolUpdates.website_url = website_url;
      if (principal_name !== undefined) schoolUpdates.principal_name = principal_name;
      if (enrollment !== undefined) schoolUpdates.enrollment = enrollment;
      if (year_established !== undefined) schoolUpdates.year_established = year_established;
      if (grade_low !== undefined) schoolUpdates.grade_low = grade_low;
      if (grade_high !== undefined) schoolUpdates.grade_high = grade_high;
      if (tagline !== undefined) schoolUpdates.tagline = tagline;
      if (description !== undefined) schoolUpdates.description = description;
      if (conference !== undefined) schoolUpdates.conference = conference;
      if (mascot_name !== undefined) schoolUpdates.mascot_name = mascot_name;

      if (Object.keys(schoolUpdates).length > 0) {
        const { error } = await atlas
          .from('schools')
          .update(schoolUpdates)
          .eq('id', school_id)
          .select('id')
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      async function upsertMedia(role: MediaRole, url: string | null | undefined) {
        if (url === undefined) return;

        const { data: existing } = await atlas
          .from('school_media')
          .select('id, media_id')
          .eq('school_id', school_id)
          .eq('role', role)
          .maybeSingle();

        if (url === null) {
          if (existing) {
            await atlas.from('school_media').delete().eq('id', existing.id);
          }
          return;
        }

        if (existing) {
          await atlas.from('media').update({ url }).eq('id', existing.media_id);
        } else {
          const { data: mediaRow, error: mediaErr } = await atlas
            .from('media')
            .insert({ url })
            .select('id')
            .single();
          if (mediaErr || !mediaRow) return;
          await atlas
            .from('school_media')
            .insert({ school_id, media_id: mediaRow.id, role, sort_order: 0 });
        }
      }

      await upsertMedia('logo', logo_url);
      await upsertMedia('cover', cover_url);
      await upsertMedia('mascot', mascot_url);

      const { data: updated } = await atlas
        .from('schools')
        .select('id, name, address, phone, website_url, principal_name, enrollment, year_established, grade_low, grade_high, primary_color, secondary_color, tagline, description, conference, mascot_name')
        .eq('id', school_id)
        .single();

      async function resolveMediaUrl(role: MediaRole): Promise<string | null> {
        const { data: link } = await atlas
          .from('school_media')
          .select('media_id')
          .eq('school_id', school_id)
          .eq('role', role)
          .maybeSingle();
        if (!link?.media_id) return null;
        const { data: rec } = await atlas
          .from('media')
          .select('url')
          .eq('id', link.media_id)
          .single();
        return rec?.url ?? null;
      }

      return NextResponse.json({
        ...updated,
        logo_url: await resolveMediaUrl('logo'),
        cover_url: await resolveMediaUrl('cover'),
        mascot_url: await resolveMediaUrl('mascot'),
      });
    },
    { requireAdmin: true, rateLimit: 'public' }
  );
}
