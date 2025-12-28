import { NextRequest, NextResponse } from 'next/server';
import { getLatestNewsGen } from '@/features/news/services/newsService';

export async function GET(request: NextRequest) {
  try {
    const latestNews = await getLatestNewsGen();

    if (!latestNews) {
      return NextResponse.json(
        { error: 'No news data available. Please generate news first.' },
        { status: 404 }
      );
    }

    // Extract the API response from the stored data
    const apiResponse = latestNews.api_response as {
      requestId?: string;
      articles?: unknown[];
      count?: number;
      query?: string;
      limit?: string;
      timePublished?: string;
      country?: string;
      lang?: string;
      generatedAt?: string;
    };

    return NextResponse.json({
      success: true,
      data: {
        articles: apiResponse.articles || [],
        count: apiResponse.count || 0,
        requestId: apiResponse.requestId,
        query: apiResponse.query || latestNews.user_input,
        generatedAt: apiResponse.generatedAt || latestNews.created_at,
        createdAt: latestNews.created_at,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/news/latest:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

