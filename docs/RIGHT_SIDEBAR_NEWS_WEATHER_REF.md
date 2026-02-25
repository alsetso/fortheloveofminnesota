# Right Sidebar Refactor: News + Weather (Reference)

Reference for refactoring the right sidebar with **Recent News** and **Main Weather** sections, using the **LeftSidebar “Following” list** style.

---

## 1. LeftSidebar “Following” style (pattern to follow)

**Location:** `src/components/layout/LeftSidebar.tsx` (lines ~216–308)

**Structure:**
- **Section container:** `p-3 border-t border-border-muted dark:border-white/10`
- **Header row:** `flex items-center justify-between mb-2`
  - **Title:** `text-xs font-semibold text-foreground` (e.g. "Following")
  - **Action (optional):** icon button, e.g. `MagnifyingGlassIcon` with `href="/people"`
- **List:** `space-y-1`
- **List item (link):** `flex items-center gap-2 px-2 py-2 rounded-md hover:bg-surface-accent transition-colors`
  - Avatar/icon on left (e.g. `ProfilePhoto` or small icon)
  - **Primary line:** `text-sm text-foreground truncate` (+ optional badge like "following")
  - **Secondary line:** `text-xs text-foreground-muted truncate` (e.g. @username)
- **Footer link:** "View all (N)" — `block w-full mt-1 py-1.5 text-center text-xs text-foreground-muted hover:text-foreground hover:bg-surface-accent rounded-md`
- **Loading:** skeleton cards (avatar circle + 2 lines of placeholders)
- **Empty state:** icon + short message + CTA link

Use the same spacing, borders, typography, and hover states for each **inline section** in the right sidebar.

---

## 2. News page & API

**Page:** `src/app/news/page.tsx`  
**API:** `GET /api/news?limit=50` (optional: `offset`, `start_date`, `end_date`)

**Response shape:**
```ts
{
  articles: Array<{
    id: string;
    title: string;
    link: string;           // external article URL
    snippet: string | null;
    photo_url: string | null;
    thumbnail_url: string | null;
    published_at: string;   // ISO
    published_date: string; // date string
    authors: string[];
    source_name: string | null;
    source_logo_url: string | null;
    source_favicon_url: string | null;
    related_topics: string[];
  }>;
  count: number;
  limit: number;
  offset: number;
}
```

**How the news page uses it:**
- Fetches with `fetch('/api/news?limit=50', { cache: 'no-store' })`.
- Renders cards with: image (photo_url or thumbnail_url), title (line-clamp-2), snippet (line-clamp-2), source_name + published_at.
- Date formatting: `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`.

**For the right sidebar “Recent News” section:**
- Fetch same API with a small limit (e.g. `limit=5`).
- Show 3–5 items in the **friends-list style**: compact row per article (small thumb or icon, title line, optional source/date line), link to `article.link` (external).
- Section title: "Recent News"; action link to `/news` ("View all" or similar).
- Reuse the same `NewsArticle` type or a minimal subset (id, title, link, thumbnail_url, source_name, published_at).

---

## 3. Weather page & data

**Page:** `src/app/weather/WeatherPageClient.tsx` → wraps `WeatherDashboard`.  
**Dashboard:** `src/components/weather/WeatherDashboard.tsx`  
**Hooks/types:** `src/components/weather/useWeather.ts`

**Data sources (all via `/api/weather` proxy):**
- **Current conditions:** `useLatestObservation(stationId)` — stations used: KMSP (Minneapolis), KDLH (Duluth), KRST (Rochester).
- **Forecast:** `useForecast(gridId, gridX, gridY)` — 7-day periods (name, temperature, shortForecast, windSpeed, windDirection).
- **Hourly:** `useHourlyForecast(gridId, gridX, gridY)` — next 24 hours.
- **Alerts:** `useActiveAlerts()` — MN alerts; each has event, severity, headline, areaDesc, onset, ends, instruction.
- **Point metadata:** `usePointMetadata(lat, lon)` — needed to get gridId/gridX/gridY for forecast (e.g. default Minneapolis: lat 44.9778, lon -93.265).

**Key types (from useWeather.ts):**
- **Observation:** temperature (C), textDescription, windSpeed, windDirection, relativeHumidity, visibility, windChill, dewpoint; helpers `cToF`, `mpsToMph`, `windDegToDir`.
- **ForecastPeriod:** name, startTime, temperature, temperatureUnit, windSpeed, windDirection, shortForecast.
- **WeatherAlert:** properties.event, .severity, .headline, .areaDesc, .onset, .ends.

**For the right sidebar “Main Weather” section:**
- **Option A (simplest):** One city’s current conditions only:
  - Use `useLatestObservation('KMSP')` (Minneapolis).
  - Show: label "Minneapolis", temp (e.g. `cToF(p?.temperature?.value)` + "°"), textDescription, optionally one line of wind/humidity.
- **Option B:** Current conditions + next 1–2 forecast periods:
  - Same observation + `usePointMetadata(44.9778, -93.265)` then `useForecast(meta.gridId, meta.gridX, meta.gridY)`.
  - Show: current temp + condition; then 1–2 rows of forecast (e.g. "Today 42°", "Tonight 32°").
- **Option C:** Add active alerts count or first alert headline:
  - `useActiveAlerts()`; if any, show a single line like "1 alert" or first event name with link to `/weather`.

Use the same **section layout** as LeftSidebar: section title ("Weather"), optional "View all" to `/weather`, then compact list-style rows (e.g. one row for current conditions, then 1–2 forecast rows or one alerts row).

---

## 4. Right sidebar component to refactor

**Current:** `src/components/layout/RightSidebar.tsx`  
- Renders optional `children` or a minimal "Updates" placeholder.  
- Used by the **homepage** (`src/app/page.tsx`) with no children, so it currently shows the placeholder.

**Refactor plan:**
1. Replace the default placeholder with **two inline sections** (same structure as LeftSidebar’s Following block):
   - **Recent News** — fetch `/api/news?limit=5`, render list in friends-list style; "View all" → `/news`.
   - **Weather** — use `useLatestObservation('KMSP')` (+ optionally forecast/alerts), render one compact block in the same style; "View all" → `/weather`.
2. Keep support for `children`: when a page passes `children`, render that instead of (or above?) the default News + Weather sections, depending on product preference.
3. Reuse section styling: `p-3 border-t border-border-muted`, `text-xs font-semibold` title, `space-y-1` list, same hover/rounded classes as LeftSidebar.

---

## 5. File checklist

| Purpose | File |
|--------|------|
| Section pattern | `src/components/layout/LeftSidebar.tsx` (Following block) |
| Right sidebar UI | `src/components/layout/RightSidebar.tsx` |
| News API | `src/app/api/news/route.ts` |
| News types / fetch | Same as `src/app/news/page.tsx` (NewsArticle) |
| Weather hooks & types | `src/components/weather/useWeather.ts` |
| Weather UI reference | `src/components/weather/WeatherDashboard.tsx` (CurrentConditions, etc.) |

---

## 6. Summary

- **News:** `GET /api/news?limit=5` → list of articles; each row: thumb/icon, title, optional source/date; link to article; section "View all" → `/news`.
- **Weather:** `useLatestObservation('KMSP')` (and optionally forecast/alerts) → one compact block: city, temp, condition, maybe 1–2 forecast rows or alert line; "View all" → `/weather`.
- **Style:** Match LeftSidebar’s Following section: same padding, borders, title size, list spacing, item hover, and "View all" link style.
