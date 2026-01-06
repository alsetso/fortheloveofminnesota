import { NextRequest, NextResponse } from 'next/server';
import { getActiveMentionIcons } from '@/features/mentions/services/mentionIconsService';

export const revalidate = 3600; // Revalidate every hour

/**
 * GET /api/mention-icons
 * Fetch all active mention icons for the icon selector
 */
export async function GET() {
  try {
    const icons = await getActiveMentionIcons();
    return NextResponse.json(icons);
  } catch (error) {
    console.error('[MentionIcons API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

