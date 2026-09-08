/** Server-only RapidAPI key (never NEXT_PUBLIC). */
export function getRapidApiKey(): string {
  const key = process.env.RAPIDAPI_KEY?.trim();
  if (!key) {
    throw new Error('RAPIDAPI_KEY is not configured');
  }
  return key;
}
