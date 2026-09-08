/**
 * Paginate a Supabase query past the default 1000-row cap.
 * Uses `.range()` until a short page is returned.
 */

export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

/**
 * `buildPage(from, to)` should return the Supabase query with `.range(from, to)` applied.
 */
export async function fetchAllSupabaseRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await buildPage(from, to);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}
