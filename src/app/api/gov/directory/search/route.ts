import { NextResponse } from 'next/server';
import { searchDirectory } from '@/features/civic/services/civicService';

export const dynamic = 'force-dynamic';

/** GET ?q=... — search directory (agencies, people, roles) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const result = await searchDirectory(q);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[directory search]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 }
    );
  }
}
