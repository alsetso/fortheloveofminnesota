import { createServerClient } from '@/lib/supabaseServer';

interface CheckbookStats {
  totalCount: number;
  totalAmount: number;
}

async function getCheckbookStats(): Promise<CheckbookStats> {
  try {
    const supabase = createServerClient();
    
    // Use database function to calculate stats efficiently
    // This avoids fetching all rows and calculates sum/count in the database
    const { data, error } = await supabase
      .rpc('get_checkbook_stats_2026');

    if (error) {
      console.error('[StateCheckbook] Error fetching stats:', error);
      return { totalCount: 0, totalAmount: 0 };
    }

    const result = data?.[0] as { total_count: number; total_amount: number } | undefined;
    
    if (!result) {
      return { totalCount: 0, totalAmount: 0 };
    }
    
    return {
      totalCount: Number(result.total_count) || 0,
      totalAmount: Number(result.total_amount) || 0,
    };
  } catch (error) {
    console.error('[StateCheckbook] Unexpected error:', error);
    return { totalCount: 0, totalAmount: 0 };
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function StateCheckbook() {
  const stats = await getCheckbookStats();

  return (
    <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
      <h2 className="text-xs font-semibold text-gray-900">
        State Checkbook
      </h2>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-gray-600">Active Contracts (2026)</span>
          <span className="text-xs font-semibold text-gray-900">
            {stats.totalCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-gray-600">Total Contract Amount</span>
          <span className="text-xs font-semibold text-gray-900">
            {formatCurrency(stats.totalAmount)}
          </span>
        </div>
      </div>
      <div className="pt-1 border-t border-gray-100 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Active payments as of 2026 in Minnesota
          </p>
          <a
            href="/gov/checkbook/contracts"
            className="text-xs text-gray-900 hover:text-gray-700 underline font-medium"
          >
            View State Checkbook →
          </a>
        </div>
        <p className="text-xs text-gray-400">
          Data Uploaded Dec 30 2:52 ·{' '}
          <a
            href="https://mn.gov/mmb/transparency-mn/contracts-grants.jsp"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 underline"
          >
            Source
          </a>
        </p>
      </div>
    </section>
  );
}

