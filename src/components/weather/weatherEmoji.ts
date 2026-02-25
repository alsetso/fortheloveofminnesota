/**
 * Key-value mappings: condition keywords and metric thresholds → emojis.
 * Used to show up to 3 emojis per weather card. Safe to use server-side or client-side.
 */

export const WEATHER_EMOJI_MAP = {
  /** Condition keywords (textDescription) → emoji */
  condition: [
    { keys: ['fair', 'clear', 'sunny'], emoji: '☀️' },
    { keys: ['partly cloudy', 'partly sunny'], emoji: '⛅' },
    { keys: ['cloudy', 'overcast'], emoji: '☁️' },
    { keys: ['rain', 'showers', 'drizzle'], emoji: '🌧️' },
    { keys: ['snow', 'flurries', 'snow showers'], emoji: '❄️' },
    { keys: ['fog', 'mist', 'haze'], emoji: '🌫️' },
    { keys: ['thunderstorm', 't-storm'], emoji: '⛈️' },
    { keys: ['wind', 'breezy'], emoji: '💨' },
  ] as const,

  /** Temp (F) thresholds */
  temp: [
    { max: 32, emoji: '🥶' },
    { min: 33, max: 49, emoji: '🌡️' },
    { min: 50, max: 75, emoji: '🌤️' },
    { min: 76, emoji: '🔥' },
  ] as const,

  /** Wind (mph) – show when >= 15 */
  wind: { threshold: 15, emoji: '💨' } as const,

  /** Humidity (%) – show when >= 85 */
  humidity: { threshold: 85, emoji: '💧' } as const,

  /** Wind chill present and cold */
  windChill: { max: 32, emoji: '🥶' } as const,
} as const;

export type WeatherEmojiKey = keyof typeof WEATHER_EMOJI_MAP;

/** Input derived from observation (e.g. after cToF, mpsToMph). */
export interface ObservationSummary {
  textDescription: string | null;
  tempF: number | null;
  windMph: number | null;
  humidityPercent: number | null;
  windChillF: number | null;
}

/**
 * Returns up to 3 emojis for a given observation. Order: condition first, then temp/windChill, then wind/humidity.
 */
export function getEmojisForObservation(o: ObservationSummary): string[] {
  const out: string[] = [];
  const desc = (o.textDescription || '').toLowerCase();

  // 1. Condition from textDescription
  for (const { keys, emoji } of WEATHER_EMOJI_MAP.condition) {
    if (keys.some((k) => desc.includes(k))) {
      out.push(emoji);
      break;
    }
  }

  // 2. Temp or wind chill (if not already added as condition)
  if (o.tempF != null) {
    for (const t of WEATHER_EMOJI_MAP.temp) {
      const aboveMin = !('min' in t) || o.tempF >= t.min!;
      const belowMax = !('max' in t) || o.tempF <= t.max;
      if (aboveMin && belowMax) {
        if (!out.includes(t.emoji)) out.push(t.emoji);
        break;
      }
    }
  }
  if (out.length < 3 && o.windChillF != null && o.windChillF <= WEATHER_EMOJI_MAP.windChill.max) {
    const emoji = WEATHER_EMOJI_MAP.windChill.emoji;
    if (!out.includes(emoji)) out.push(emoji);
  }

  // 3. Wind or humidity (if notable and we have room)
  if (out.length < 3 && o.windMph != null && o.windMph >= WEATHER_EMOJI_MAP.wind.threshold) {
    const emoji = WEATHER_EMOJI_MAP.wind.emoji;
    if (!out.includes(emoji)) out.push(emoji);
  }
  if (out.length < 3 && o.humidityPercent != null && o.humidityPercent >= WEATHER_EMOJI_MAP.humidity.threshold) {
    const emoji = WEATHER_EMOJI_MAP.humidity.emoji;
    if (!out.includes(emoji)) out.push(emoji);
  }

  return out.slice(0, 3);
}
