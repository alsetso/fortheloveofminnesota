import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam) {
      return NextResponse.json(
        { error: 'startDate parameter is required' },
        { status: 400 }
      );
    }

    const endDate = endDateParam || startDateParam;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDateParam)) {
      return NextResponse.json(
        { error: 'Invalid startDate format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (endDateParam && !dateRegex.test(endDateParam)) {
      return NextResponse.json(
        { error: 'Invalid endDate format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Use RPC function to query news schema
    // Note: Function must be created via migration 328 first
    const { data, error } = await (supabase.rpc as any)('get_dates_with_news_counts', {
      p_start_date: startDateParam,
      p_end_date: endDate,
    });

    if (error) {
      console.error('Error fetching dates with news:', error);
      
      // If function doesn't exist, return empty result (migration not run yet)
      if (error.message?.includes('Could not find the function') || error.message?.includes('schema cache')) {
        return NextResponse.json({
          success: true,
          data: {
            dates: {},
            dateList: [],
          },
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch dates with news', details: error.message },
        { status: 500 }
      );
    }

    // Format response (RPC already returns grouped data)
    const dateMap: Record<string, number> = {};
    const dateList: Array<{ date: string; article_count: number }> = [];
    
    (data || []).forEach((row: any) => {
      const date = row.date;
      const count = Number(row.article_count);
      dateMap[date] = count;
      dateList.push({ date, article_count: count });
    });

    return NextResponse.json({
      success: true,
      data: {
        dates: dateMap,
        dateList: dateList,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/news/dates-with-news:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

