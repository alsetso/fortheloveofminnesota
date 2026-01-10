#!/usr/bin/env python3
"""
Extract CTU boundaries using only built-in Python libraries
Reads GeoPackage as SQLite and exports geometry as base64 for PostGIS conversion
"""

import sqlite3
import json
import sys
import base64
from pathlib import Path

def extract_ctu_data(gpkg_path, output_path):
    """Extract CTU data - geometry will be converted via PostGIS ST_GeomFromGPKG"""
    
    if not Path(gpkg_path).exists():
        print(f"ERROR: GeoPackage file not found: {gpkg_path}")
        sys.exit(1)
    
    conn = sqlite3.connect(gpkg_path)
    cursor = conn.cursor()
    
    # Read CTU data with geometry blob
    cursor.execute("""
      SELECT 
        CTU_CLASS,
        FEATURE_NAME,
        GNIS_FEATURE_ID,
        COUNTY_NAME,
        COUNTY_CODE,
        COUNTY_GNIS_FEATURE_ID,
        POPULATION,
        SHAPE
      FROM city_township_unorg
      WHERE CTU_CLASS IS NOT NULL
        AND FEATURE_NAME IS NOT NULL
        AND COUNTY_NAME IS NOT NULL
        AND COUNTY_NAME != 'NV'
      ORDER BY CTU_CLASS, FEATURE_NAME
    """)
    
    records = []
    for idx, row in enumerate(cursor.fetchall()):
        ctu_class, feature_name, gnis_id, county_name, county_code, county_gnis_id, population, shape_blob = row
        
        # Store geometry as base64-encoded blob
        # PostGIS can convert this using ST_GeomFromWKB
        geometry_blob_b64 = None
        if shape_blob:
            geometry_blob_b64 = base64.b64encode(shape_blob).decode('utf-8')
        
        record = {
            "ctu_class": ctu_class,
            "feature_name": feature_name,
            "gnis_feature_id": str(gnis_id) if gnis_id else None,
            "county_name": county_name,
            "county_code": str(county_code) if county_code else None,
            "county_gnis_feature_id": str(county_gnis_id) if county_gnis_id else None,
            "population": int(population) if population else None,
            "acres": None,
            "geometry_blob_b64": geometry_blob_b64
        }
        
        records.append(record)
    
    conn.close()
    
    # Write to JSON file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2)
    
    print(f"✅ Extracted {len(records)} CTU records")
    print(f"   Records with geometry: {sum(1 for r in records if r['geometry_blob_b64'])}")
    return len(records)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 extract-ctu-simple.py <gpkg_path> <output_json_path>")
        sys.exit(1)
    
    gpkg_path = sys.argv[1]
    output_path = sys.argv[2]
    
    extract_ctu_data(gpkg_path, output_path)

