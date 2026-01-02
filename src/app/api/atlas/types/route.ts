import { NextResponse } from 'next/server';
import { getVisibleAtlasTypes } from '@/features/atlas/services/atlasTypesService';

export const revalidate = 3600;

export async function GET() {
  try {
    const types = await getVisibleAtlasTypes();
    return NextResponse.json({ types });
  } catch (error) {
    console.error('[AtlasTypesAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

