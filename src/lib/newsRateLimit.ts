/**
 * News API rate limiting utility
 * Tracks daily search credits using localStorage
 * Free tier: 1 credit per day
 */

const NEWS_RATE_LIMIT_KEY = 'news_api_rate_limit';
const DAILY_CREDITS = 1;

interface RateLimitData {
  date: string; // YYYY-MM-DD format
  creditsUsed: number;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get current rate limit data from localStorage
 */
function getRateLimitData(): RateLimitData {
  if (typeof window === 'undefined') {
    return { date: getTodayDate(), creditsUsed: 0 };
  }

  try {
    const stored = localStorage.getItem(NEWS_RATE_LIMIT_KEY);
    if (!stored) {
      return { date: getTodayDate(), creditsUsed: 0 };
    }

    const data: RateLimitData = JSON.parse(stored);
    const today = getTodayDate();

    // If stored date is not today, reset credits
    if (data.date !== today) {
      return { date: today, creditsUsed: 0 };
    }

    return data;
  } catch (error) {
    console.error('Error reading rate limit data:', error);
    return { date: getTodayDate(), creditsUsed: 0 };
  }
}

/**
 * Save rate limit data to localStorage
 */
function saveRateLimitData(data: RateLimitData): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(NEWS_RATE_LIMIT_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving rate limit data:', error);
  }
}

/**
 * Check if user has remaining credits
 */
export function hasRemainingCredits(): boolean {
  const data = getRateLimitData();
  return data.creditsUsed < DAILY_CREDITS;
}

/**
 * Get remaining credits count
 */
export function getRemainingCredits(): number {
  const data = getRateLimitData();
  return Math.max(0, DAILY_CREDITS - data.creditsUsed);
}

/**
 * Use a credit (increment usage)
 * Returns true if credit was successfully used, false if no credits remaining
 */
export function useCredit(): boolean {
  const data = getRateLimitData();

  if (data.creditsUsed >= DAILY_CREDITS) {
    return false;
  }

  data.creditsUsed += 1;
  saveRateLimitData(data);
  return true;
}

/**
 * Reset rate limit (for testing or admin purposes)
 */
export function resetRateLimit(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(NEWS_RATE_LIMIT_KEY);
}
