-- Unique constraint on layers.water(nhd_feature_id) for idempotent NHD load
-- Enables ON CONFLICT (nhd_feature_id) DO NOTHING / upsert with ignoreDuplicates

CREATE UNIQUE INDEX IF NOT EXISTS layers_water_nhd_feature_id_key
  ON layers.water (nhd_feature_id)
  WHERE nhd_feature_id IS NOT NULL;
