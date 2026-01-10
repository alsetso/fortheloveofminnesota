#!/usr/bin/env python3
"""
Extract CTU boundaries from GeoPackage with proper geometry conversion
Uses fiona (GDAL Python bindings) to read GeoPackage geometry
"""

import sys
import json
from pathlib import Path

try:
    import fiona
    from fiona.crs import from_epsg
    HAS_FIONA = True
except ImportError:
    HAS_FIONA = False
    print("ERROR: fiona library not installed. Install with: pip install fiona")
    sys.exit(1)

def extract_ctu_data(gpkg_path, output_path):
    """Extract CTU data with proper geometry from GeoPackage"""
    
    if not Path(gpkg_path).exists():
        print(f"ERROR: GeoPackage file not found: {gpkg_path}")
        sys.exit(1)
    
    records = []
    
    try:
        # Open GeoPackage layer
        with fiona.open(gpkg_path, layer='city_township_unorg') as src:
            # Get CRS info
            src_crs = src.crs
            print(f"Source CRS: {src_crs}")
            
            # Read all features
            for idx, feature in enumerate(src):
                props = feature.get('properties', {})
                
                # Skip invalid records
                if not props.get('CTU_CLASS') or not props.get('FEATURE_NAME') or not props.get('COUNTY_NAME'):
                    continue
                
                if props.get('COUNTY_NAME') == 'NV':
                    continue
                
                # Get geometry (fiona automatically handles coordinate transformation if needed)
                geometry = feature.get('geometry')
                
                if not geometry:
                    print(f"WARNING: No geometry for {props.get('FEATURE_NAME')}")
                    continue
                
                # Create FeatureCollection with single feature
                feature_collection = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {},
                            "geometry": geometry
                        }
                    ]
                }
                
                record = {
                    "ctu_class": props.get('CTU_CLASS'),
                    "feature_name": props.get('FEATURE_NAME'),
                    "gnis_feature_id": str(props.get('GNIS_FEATURE_ID')) if props.get('GNIS_FEATURE_ID') else None,
                    "county_name": props.get('COUNTY_NAME'),
                    "county_code": str(props.get('COUNTY_CODE')) if props.get('COUNTY_CODE') else None,
                    "county_gnis_feature_id": str(props.get('COUNTY_GNIS_FEATURE_ID')) if props.get('COUNTY_GNIS_FEATURE_ID') else None,
                    "population": int(props.get('POPULATION')) if props.get('POPULATION') is not None else None,
                    "acres": None,  # Not in source data
                    "geometry": feature_collection
                }
                
                records.append(record)
        
        # Write to JSON file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=2)
        
        print(f"✅ Extracted {len(records)} CTU records with geometry")
        return len(records)
        
    except Exception as e:
        print(f"ERROR: Failed to extract CTU data: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 extract_ctu_geometry.py <gpkg_path> <output_json_path>")
        sys.exit(1)
    
    gpkg_path = sys.argv[1]
    output_path = sys.argv[2]
    
    extract_ctu_data(gpkg_path, output_path)

