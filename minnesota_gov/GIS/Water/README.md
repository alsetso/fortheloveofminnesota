# Minnesota GIS Water (NHD)

Source: https://gisdata.mn.gov/dataset/water-national-hydrography-data

## Migration to Supabase

Water bodies from NHD are loaded into `layers.water` via a batched, resumable script.

- **Source:** `water_data/shp_water_national_hydrography_data/NHDWaterbody.shp`
- **Source date:** 2024-01-05 (MN NHD extract, from metadata)
- **Filter:** Optional; use `--lakes-only` to load only fcode 39xxx (lakes/ponds). Default: all NHDWaterbody features.
- **Target:** `layers.water` (`feature_type = 'waterbody'`)
- **Load script:** `scripts/load-nhd-water.js`
- **Progress file:** `minnesota_gov/GIS/Water/water_load_state.json`

### Progress file schema

The loader reads/writes this JSON (created in this directory):

```json
{
  "last_nhd_feature_id": "string or null",
  "rows_inserted": 0,
  "batches_done": 0,
  "last_run_at": "ISO8601 or null"
}
```

- **last_nhd_feature_id:** After each batch, the last `permanent_` value in that batch. On resume, the script skips features until it sees this id, then continues.
- **rows_inserted:** Total rows inserted so far.
- **batches_done:** Number of batches committed.
- **last_run_at:** Timestamp of last successful batch write.

### Total features in source

- **Total features:** 205,032
- **Lakes/ponds only (fcode 39xxx, including 39000):** 183,477
- **Lakes/ponds (fcode 39001–39012 only):** 162,344
- **Reservoirs (436xx):** ~4,800
- **Other (46600 etc.):** ~15,600

### Last run

- **Date:** 2026-02-17
- **Rows inserted:** 500 (test run with `--max-batches=1`; resume with no args to continue)
- **Last nhd_feature_id:** {5D7396E4-9FF0-433A-9B3D-F66850C2868E}