import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  businessCategorySlug,
  formatBusinessCategoryName,
  normalizeBusinessCategoryKey,
} from '@/lib/directory/businessCategoryText';
import {
  isPageCategoryParent,
  type PageCategoryParent,
} from '@/lib/directory/pageCategoryParents';
import { createPageServiceClient } from '@/lib/supabase/pageDb';

export const dynamic = 'force-dynamic';

function childCategorySlug(parentSlug: PageCategoryParent, name: string): string {
  const base = businessCategorySlug(name);
  if (parentSlug === 'local-business') return base;
  if (parentSlug === 'community') return `community-${base}`.substring(0, 80);
  return `${parentSlug}-${base}`.substring(0, 80);
}

async function getParentCategory(
  db: ReturnType<typeof createPageServiceClient>,
  parentSlug: string,
) {
  const { data, error } = await db
    .from('categories')
    .select('id')
    .eq('slug', parentSlug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** GET /api/directory/categories?parent=local-business&q=coffee&limit=12 */
export async function GET(request: NextRequest) {
  const parentSlug = request.nextUrl.searchParams.get('parent')?.trim();
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '12');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 12;

  if (!parentSlug) {
    return NextResponse.json({ error: 'parent query param is required' }, { status: 400 });
  }

  const db = createPageServiceClient();

  try {
    const parent = await getParentCategory(db, parentSlug);
    if (!parent) return NextResponse.json({ categories: [] });

    let query = db
      .from('categories')
      .select('id, slug, name')
      .eq('parent_id', parent.id)
      .order('name')
      .limit(limit);

    if (q) query = query.ilike('name', `%${q}%`);

    const { data: categories, error } = await query;
    if (error) throw error;

    return NextResponse.json({ categories: categories ?? [] });
  } catch (err) {
    console.error('[directory/categories] GET:', err);
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }
}

/** POST /api/directory/categories — add a custom category under a parent bucket. */
export async function POST(request: NextRequest) {
  const session = await getSessionAccount();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parentSlug = typeof body?.parent === 'string' ? body.parent.trim() : '';
  const rawName = typeof body?.name === 'string' ? body.name : '';

  if (!parentSlug || !isPageCategoryParent(parentSlug)) {
    return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 });
  }

  const name = formatBusinessCategoryName(rawName);
  if (name.length < 2) {
    return NextResponse.json({ error: 'Enter a category (at least 2 characters).' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: 'Category is too long.' }, { status: 400 });
  }

  const slug = childCategorySlug(parentSlug, name);
  if (!slug) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  }

  const db = createPageServiceClient();

  try {
    const parent = await getParentCategory(db, parentSlug);
    if (!parent) {
      return NextResponse.json(
        { error: 'Categories are not configured for this page type.' },
        { status: 500 },
      );
    }

    const { data: siblings, error: siblingsErr } = await db
      .from('categories')
      .select('id, slug, name')
      .eq('parent_id', parent.id);
    if (siblingsErr) throw siblingsErr;

    const normalized = normalizeBusinessCategoryKey(name);
    const existing = (siblings ?? []).find(
      (row) =>
        row.slug === slug ||
        normalizeBusinessCategoryKey(row.name) === normalized,
    );
    if (existing) {
      return NextResponse.json({ category: existing, created: false });
    }

    const { data: created, error: insertErr } = await db
      .from('categories')
      .insert({ slug, name, parent_id: parent.id })
      .select('id, slug, name')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        const { data: bySlug } = await db
          .from('categories')
          .select('id, slug, name')
          .eq('parent_id', parent.id)
          .eq('slug', slug)
          .maybeSingle();
        if (bySlug) return NextResponse.json({ category: bySlug, created: false });
      }
      throw insertErr;
    }

    return NextResponse.json({ category: created, created: true }, { status: 201 });
  } catch (err) {
    console.error('[directory/categories] POST:', err);
    return NextResponse.json({ error: 'Failed to add category' }, { status: 500 });
  }
}
