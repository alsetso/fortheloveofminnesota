#!/usr/bin/env python3
"""
Convert GeoPackage CTU boundaries to GeoJSON
Uses sqlite3 to read the GeoPackage and converts geometry to GeoJSON
"""

import sqlite3
import json
import sys
from pathlib import Path

def extract_geometry_from_blob(blob):
    """Extract geometry from GeoPackage blob format"""
    # GeoPackage stores geometry in a binary format
    # We need to parse the GPKG binary geometry format
    # This is a simplified version - for production, use ogr2ogr or geopandas
    
    if not blob or len(blob) < 8:
        return None
    
    # GPKG geometry format: magic (2 bytes) + version (1 byte) + flags (1 byte) + envelope (varies) + geometry
    # For now, return None and let ogr2ogr handle it, or use a proper library
    return None

def convert_gpkg_to_geojson(gpkg_path, output_path):
    """Convert GeoPackage to GeoJSON"""
    conn = sqlite3.connect(gpkg_path)
    cursor = conn.cursor()
    
    # Get all CTU records
    cursor.execute("""
        SELECT 
            CTU_CLASS,
            FEATURE_NAME,
            GNIS_FEATURE_ID,
            COUNTY_NAME,
            COUNTY_CODE,
            COUNTY_GNIS_FEATURE_ID,
            POPULATION,
            Acres,
            SHAPE
        FROM city_township_unorg
        WHERE CTU_CLASS IS NOT NULL
            AND FEATURE_NAME IS NOT NULL
            AND COUNTY_NAME IS NOT NULL
            AND COUNTY_NAME != 'NV'
        ORDER BY CTU_CLASS, FEATURE_NAME
    """)
    
    features = []
    for row in cursor.fetchall():
        ctu_class, feature_name, gnis_id, county_name, county_code, county_gnis_id, population, acres, shape_blob = row
        
        # Skip invalid records
        if not ctu_class or not feature_name or not county_name:
            continue
        
        # For now, we'll create a placeholder geometry
        # In production, you should use ogr2ogr or a proper geometry library
        # This script will output the data, but geometry will need proper conversion
        
        feature = {
            "type": "Feature",
            "properties": {
                "CTU_CLASS": ctu_class,
                "FEATURE_NAME": feature_name,
                "GNIS_FEATURE_ID": str(gnis_id) if gnis_id else None,
                "COUNTY_NAME": county_name,
                "COUNTY_CODE": str(county_code) if county_code else None,
                "COUNTY_GNIS_FEATURE_ID": str(county_gnis_id) if county_gnis_id else None,
                "POPULATION": int(population) if population else None,
                "Acres": float(acres) if acres else None,
            },
            "geometry": None  # Will be filled by ogr2ogr
        }
        
        features.append(feature)
    
    conn.close()
    
    # Write GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"Extracted {len(features)} CTU records (geometry conversion requires ogr2ogr)")
    return len(features)

if __name__ == "__main__":
    gpkg_path = sys.argv[1] if len(sys.argv) > 1 else "minnesota_gov/gpkg_bdry_mn_city_township_unorg/bdry_mn_city_township_unorg.gpkg"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "temp_ctu_geojson.json"
    
    convert_gpkg_to_geojson(gpkg_path, output_path)

