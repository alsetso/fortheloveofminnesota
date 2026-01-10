#!/bin/bash
# Clear CTU boundaries table and reimport with proper geometry

echo "🗑️  Clearing CTU boundaries table..."

# Use the import script's clear functionality, or run SQL directly
# For now, we'll let the import script handle clearing

echo "📦 Reimporting CTU boundaries with proper geometry..."
echo ""
echo "Requirements:"
echo "  - ogr2ogr (recommended): brew install gdal"
echo "  - OR fiona Python library: pip3 install --user fiona"
echo ""

# Check for ogr2ogr
if command -v ogr2ogr &> /dev/null; then
    echo "✅ ogr2ogr found - will use for geometry conversion"
    npx tsx scripts/import-ctu-boundaries.ts
elif python3 -c "import fiona" 2>/dev/null; then
    echo "✅ fiona found - will use for geometry conversion"
    npx tsx scripts/import-ctu-boundaries.ts
else
    echo "❌ Neither ogr2ogr nor fiona is available"
    echo ""
    echo "Please install one of the following:"
    echo "  1. ogr2ogr: brew install gdal"
    echo "  2. fiona: pip3 install --user fiona"
    echo ""
    exit 1
fi

