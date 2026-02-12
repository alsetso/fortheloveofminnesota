-- Create table for manually entered system details
-- Allows admins to enter routes, files, API endpoints instead of scanning filesystem

CREATE TABLE IF NOT EXISTS admin.system_details (
  system_id UUID PRIMARY KEY REFERENCES admin.system_visibility(id) ON DELETE CASCADE,
  routes JSONB DEFAULT '[]'::jsonb, -- Array of {path, filePath, hasMetadata, isDraft}
  database_tables TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of table names
  api_routes TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of API route paths
  files JSONB DEFAULT '{"components":[],"services":[],"hooks":[],"types":[],"utils":[],"pages":[]}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_details_system ON admin.system_details(system_id);

-- RLS Policies
ALTER TABLE admin.system_details ENABLE ROW LEVEL SECURITY;

-- Everyone can read system details
CREATE POLICY "System details are viewable by everyone"
  ON admin.system_details FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can modify system details"
  ON admin.system_details FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

COMMENT ON TABLE admin.system_details IS 'Manually entered system details (routes, files, API endpoints) stored by admins';
