import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const querySchema = z.object({
  schoolSlug: commonSchemas.slug,
  weekStart: z.string().optional(),
  mealType: z.enum(['lunch', 'breakfast']).default('lunch'),
});

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface NutrisliceFood {
  name: string;
  food_category: string;
  rounded_nutrition_info?: { calories?: number | null };
}

interface NutrisliceMenuItem {
  is_section_title: boolean;
  is_holiday: boolean;
  text: string;
  food: NutrisliceFood | null;
  category: string;
}

interface NutrisliceDay {
  date: string;
  menu_items: NutrisliceMenuItem[];
}

interface NutrisliceWeek {
  start_date: string;
  days: NutrisliceDay[];
}

interface TransformedMeal {
  name: string;
  category: string;
  calories: number | null;
}

interface TransformedDay {
  date: string;
  day_label: string;
  events: { title: string }[];
  meals: TransformedMeal[];
}

interface NutrisliceSchoolConfig {
  school_slug?: string;
  menu_types?: Record<string, string>;
}

interface NutrisliceDistrictConfig {
  subdomain?: string;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function transformWeek(raw: NutrisliceWeek): { week_start: string; calendar: TransformedDay[] } {
  const calendar: TransformedDay[] = [];

  for (const day of raw.days) {
    const dateObj = new Date(day.date + 'T12:00:00');
    const dow = dateObj.getDay();
    if (dow === 0 || dow === 6) continue;

    const events: { title: string }[] = [];
    const meals: TransformedMeal[] = [];

    for (const item of day.menu_items) {
      if (item.is_holiday && item.text) {
        events.push({ title: item.text });
        continue;
      }
      if (item.is_section_title || !item.food) continue;

      meals.push({
        name: item.food.name,
        category: item.food.food_category || item.category || 'other',
        calories: item.food.rounded_nutrition_info?.calories ?? null,
      });
    }

    calendar.push({
      date: day.date,
      day_label: DAY_NAMES[dow],
      events,
      meals,
    });
  }

  return { week_start: raw.start_date, calendar };
}

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) return validation.error;

      const { schoolSlug, mealType } = validation.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: schoolRow } = await supabase
        .schema('atlas' as any)
        .from('schools' as any)
        .select('id, district_id')
        .eq('slug', schoolSlug)
        .single();

      if (!schoolRow) {
        return NextResponse.json({ available: false, mealType });
      }

      const { id: schoolId, district_id: districtId } = schoolRow as { id: string; district_id: string };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: schoolInteg } = await supabase
        .schema('atlas' as any)
        .from('school_integrations' as any)
        .select('config')
        .eq('school_id', schoolId)
        .eq('provider', 'nutrislice')
        .eq('enabled', true)
        .single();

      if (!schoolInteg) {
        return NextResponse.json({ available: false, mealType });
      }

      const schoolConfig = (schoolInteg as { config: NutrisliceSchoolConfig }).config;
      const schoolSlugNs = schoolConfig.school_slug;
      const menuTypes = schoolConfig.menu_types;
      const menuTypeSlug = menuTypes?.[mealType];

      if (!schoolSlugNs || !menuTypeSlug) {
        return NextResponse.json({ available: false, mealType });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: districtInteg } = await supabase
        .schema('atlas' as any)
        .from('district_integrations' as any)
        .select('config')
        .eq('district_id', districtId)
        .eq('provider', 'nutrislice')
        .eq('enabled', true)
        .single();

      const subdomain = (districtInteg as { config: NutrisliceDistrictConfig } | null)?.config?.subdomain;
      if (!subdomain) {
        return NextResponse.json({ available: false, mealType });
      }

      const { weekStart } = validation.data;
      let anchor = new Date();
      if (weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        const parsed = new Date(weekStart + 'T12:00:00');
        if (!isNaN(parsed.getTime())) anchor = parsed;
      }
      const monday = getMondayOfWeek(anchor);
      const year = monday.getFullYear();
      const month = pad(monday.getMonth() + 1);
      const day = pad(monday.getDate());

      const nutrisliceUrl =
        `https://${subdomain}.api.nutrislice.com/menu/api/weeks/school/` +
        `${schoolSlugNs}/menu-type/${menuTypeSlug}/${year}/${month}/${day}/?format=json`;

      try {
        const upstream = await fetch(nutrisliceUrl, {
          headers: { Accept: 'application/json' },
          next: { revalidate: 3600 },
        });

        if (!upstream.ok) {
          return NextResponse.json({ available: false, mealType });
        }

        const raw: NutrisliceWeek = await upstream.json();
        const transformed = transformWeek(raw);

        return NextResponse.json({ available: true, mealType, ...transformed });
      } catch {
        return NextResponse.json({ available: false, mealType });
      }
    },
    { rateLimit: 'public', requireAuth: false },
  );
}
