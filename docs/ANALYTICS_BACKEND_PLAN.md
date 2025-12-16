# Enterprise Analytics Backend: Finalization Plan

## Current State Assessment

### ✅ Completed (Phase 1)
- Enhanced `page_views` table with `referrer_url`, `session_id`, `time_on_page`
- Complete tracking coverage (all major pages)
- Basic indexes on new columns
- Free/Pro feature gating in UI

### ❌ Missing for Enterprise-Grade Backend

## What We Can Finalize Now

### 1. Performance Infrastructure (P0 - Critical)

#### A. Composite Indexes for Time-Series Queries
**Purpose**: Enable fast date-range queries for charts and analytics
```sql
-- For entity-specific time-series queries
CREATE INDEX idx_page_views_entity_time_series 
  ON page_views(entity_type, entity_id, viewed_at DESC)
  WHERE entity_id IS NOT NULL;

-- For account-based visitor queries (Pro feature)
CREATE INDEX idx_page_views_account_entity_time
  ON page_views(account_id, entity_type, entity_id, viewed_at DESC)
  WHERE account_id IS NOT NULL;

-- For session-based visitor tracking
CREATE INDEX idx_page_views_session_entity
  ON page_views(session_id, entity_type, entity_id, viewed_at DESC)
  WHERE session_id IS NOT NULL;
```

#### B. Materialized View for Visitor Lookups
**Purpose**: Fast Pro-tier visitor identity queries
```sql
CREATE MATERIALIZED VIEW analytics_visitors AS
SELECT 
  entity_type,
  entity_id,
  account_id,
  session_id,
  COUNT(*) as visit_count,
  MIN(viewed_at) as first_visit,
  MAX(viewed_at) as last_visit,
  AVG(time_on_page) as avg_time_on_page,
  COUNT(DISTINCT DATE(viewed_at)) as days_visited
FROM page_views
WHERE account_id IS NOT NULL OR session_id IS NOT NULL
GROUP BY entity_type, entity_id, account_id, session_id;

CREATE UNIQUE INDEX ON analytics_visitors(entity_type, entity_id, account_id, session_id);
CREATE INDEX ON analytics_visitors(entity_type, entity_id);
```

### 2. Data Aggregation System (P0 - Critical)

#### A. Analytics Aggregates Table
**Purpose**: Pre-computed time-series data for fast chart rendering
```sql
CREATE TABLE analytics_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  date DATE NOT NULL,
  hour INTEGER, -- 0-23 for hourly, NULL for daily
  total_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  unique_accounts INTEGER NOT NULL DEFAULT 0,
  anonymous_visitors INTEGER NOT NULL DEFAULT 0,
  avg_time_on_page INTEGER,
  bounce_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(entity_type, entity_id, date, hour)
);

CREATE INDEX idx_analytics_aggregates_entity_date 
  ON analytics_aggregates(entity_type, entity_id, date DESC);
CREATE INDEX idx_analytics_aggregates_date 
  ON analytics_aggregates(date DESC);
```

#### B. Aggregation Function
**Purpose**: Compute daily/hourly aggregates from raw page_views
```sql
CREATE OR REPLACE FUNCTION aggregate_page_views(
  p_start_date DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Daily aggregates
  INSERT INTO analytics_aggregates (
    entity_type, entity_id, date, hour,
    total_views, unique_visitors, unique_accounts, anonymous_visitors,
    avg_time_on_page
  )
  SELECT 
    entity_type,
    entity_id,
    DATE(viewed_at) as date,
    NULL as hour,
    COUNT(*) as total_views,
    COUNT(DISTINCT COALESCE(account_id::text, session_id::text)) as unique_visitors,
    COUNT(DISTINCT account_id) FILTER (WHERE account_id IS NOT NULL) as unique_accounts,
    COUNT(DISTINCT session_id) FILTER (WHERE account_id IS NULL AND session_id IS NOT NULL) as anonymous_visitors,
    AVG(time_on_page)::INTEGER as avg_time_on_page
  FROM page_views
  WHERE DATE(viewed_at) BETWEEN p_start_date AND p_end_date
    AND entity_id IS NOT NULL
  GROUP BY entity_type, entity_id, DATE(viewed_at)
  ON CONFLICT (entity_type, entity_id, date, hour) 
  DO UPDATE SET
    total_views = EXCLUDED.total_views,
    unique_visitors = EXCLUDED.unique_visitors,
    unique_accounts = EXCLUDED.unique_accounts,
    anonymous_visitors = EXCLUDED.anonymous_visitors,
    avg_time_on_page = EXCLUDED.avg_time_on_page,
    updated_at = NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
```

### 3. Visitor Sessions Table (P1 - High Priority)

**Purpose**: Track anonymous visitors across sessions
```sql
CREATE TABLE visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  session_id UUID NOT NULL, -- Client-generated session ID
  ip_address INET,
  user_agent TEXT,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_views INTEGER DEFAULT 0,
  unique_pages INTEGER DEFAULT 0,
  fingerprint_hash TEXT, -- For browser fingerprinting (future)
  
  UNIQUE(session_id)
);

CREATE INDEX idx_visitor_sessions_account 
  ON visitor_sessions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_visitor_sessions_session 
  ON visitor_sessions(session_id);
CREATE INDEX idx_visitor_sessions_last_seen 
  ON visitor_sessions(last_seen_at DESC);
```

### 4. API Endpoints (P0 - Critical)

#### A. `/api/analytics/visitors` (Pro Only)
**Purpose**: Return visitor details for Pro users
```typescript
// Returns: Array of visitors with visit history
{
  account_id: string | null;
  username: string | null;
  display_name: string | null;
  visit_count: number;
  first_visit: string;
  last_visit: string;
  avg_time_on_page: number;
  visits: Array<{
    viewed_at: string;
    referrer_url: string | null;
  }>;
}
```

#### B. `/api/analytics/time-series` (Pro Only)
**Purpose**: Return time-series data for charts
```typescript
// Returns: Time-series data points
{
  entity_type: string;
  entity_id: string;
  data: Array<{
    date: string;
    views: number;
    unique_visitors: number;
    unique_accounts: number;
  }>;
  period: 'daily' | 'weekly' | 'monthly';
}
```

### 5. Helper Functions (P1 - High Priority)

#### A. Get Visitor Details
```sql
CREATE OR REPLACE FUNCTION get_entity_visitors(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  account_id UUID,
  username TEXT,
  display_name TEXT,
  visit_count BIGINT,
  first_visit TIMESTAMP WITH TIME ZONE,
  last_visit TIMESTAMP WITH TIME ZONE,
  avg_time_on_page NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.account_id,
    a.username,
    COALESCE(a.first_name || ' ' || a.last_name, a.username, 'Anonymous') as display_name,
    COUNT(*)::BIGINT as visit_count,
    MIN(pv.viewed_at) as first_visit,
    MAX(pv.viewed_at) as last_visit,
    AVG(pv.time_on_page) as avg_time_on_page
  FROM page_views pv
  LEFT JOIN accounts a ON pv.account_id = a.id
  WHERE pv.entity_type = p_entity_type
    AND pv.entity_id = p_entity_id
    AND (p_date_from IS NULL OR DATE(pv.viewed_at) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(pv.viewed_at) <= p_date_to)
    AND (pv.account_id IS NOT NULL OR pv.session_id IS NOT NULL)
  GROUP BY pv.account_id, a.username, a.first_name, a.last_name
  ORDER BY visit_count DESC, last_visit DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### B. Get Time-Series Data
```sql
CREATE OR REPLACE FUNCTION get_time_series_data(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_date_from DATE,
  p_date_to DATE,
  p_period TEXT DEFAULT 'daily' -- 'daily', 'weekly', 'monthly'
)
RETURNS TABLE (
  date DATE,
  views INTEGER,
  unique_visitors INTEGER,
  unique_accounts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aa.date,
    SUM(aa.total_views)::INTEGER as views,
    SUM(aa.unique_visitors)::INTEGER as unique_visitors,
    SUM(aa.unique_accounts)::INTEGER as unique_accounts
  FROM analytics_aggregates aa
  WHERE aa.entity_type = p_entity_type
    AND aa.entity_id = p_entity_id
    AND aa.date BETWEEN p_date_from AND p_date_to
    AND aa.hour IS NULL -- Daily aggregates only
  GROUP BY aa.date
  ORDER BY aa.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6. Background Processing (P1 - High Priority)

#### A. Scheduled Aggregation Job
**Purpose**: Automatically compute aggregates daily
```sql
-- Using pg_cron (if available) or external scheduler
SELECT cron.schedule(
  'aggregate-daily-analytics',
  '0 1 * * *', -- Daily at 1 AM
  $$SELECT aggregate_page_views(CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE)$$
);
```

#### B. Materialized View Refresh
```sql
-- Refresh visitor materialized view daily
SELECT cron.schedule(
  'refresh-analytics-visitors',
  '0 2 * * *', -- Daily at 2 AM
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_visitors$$
);
```

## Implementation Priority

### Phase 2A: Core Infrastructure (Week 1)
1. ✅ Performance indexes (composite indexes)
2. ✅ Analytics aggregates table
3. ✅ Aggregation function
4. ✅ Materialized view for visitors

### Phase 2B: API & Functions (Week 2)
1. ✅ Visitor lookup function
2. ✅ Time-series function
3. ✅ `/api/analytics/visitors` endpoint
4. ✅ `/api/analytics/time-series` endpoint

### Phase 2C: Background Processing (Week 3)
1. ✅ Visitor sessions table
2. ✅ Scheduled aggregation job
3. ✅ Materialized view refresh job

## Database Migration Structure

**Migration 206**: Performance indexes + aggregates table
**Migration 207**: Visitor functions + materialized view
**Migration 208**: Visitor sessions table
**Migration 209**: Background job setup (optional, depends on pg_cron)

## Success Criteria

- ✅ Time-series queries execute in < 100ms
- ✅ Visitor lookup queries execute in < 200ms
- ✅ Aggregates computed within 5 minutes of data collection
- ✅ Materialized views refresh without blocking reads
- ✅ All Pro-tier features accessible via API

## Next Steps After Backend

Once backend is finalized, move to UI:
1. Time-series chart components (recharts)
2. Visitor list component with search/filter
3. Enhanced dashboard layout
4. Export functionality (CSV/PDF)

