#!/usr/bin/env python3
"""
Import budgets data from CSV files into checkbook.budgets table.

Usage:
    python scripts/import_budgets.py

Environment variables required:
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import os
import csv
import sys
from pathlib import Path
from typing import Optional, Dict
from dotenv import load_dotenv

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py not installed. Run: pip install supabase python-dotenv")
    sys.exit(1)

# Load environment variables (check .env.local first, then .env)
env_path = Path(__file__).parent.parent / '.env.local'
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

# Configuration
BATCH_SIZE = 1000
CSV_DIR = Path(__file__).parent.parent / "minnesota_gov" / "Budget"
YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]


def parse_decimal(value: str) -> float:
    """Parse string to float for NUMERIC fields, return 0.0 if invalid."""
    if not value or not value.strip():
        return 0.0
    try:
        # Remove commas and parse to float
        cleaned = value.strip().replace(',', '')
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0


def parse_integer(value: str) -> Optional[int]:
    """Parse string to integer, return None if invalid."""
    if not value or not value.strip():
        return None
    try:
        return int(value.strip())
    except (ValueError, TypeError):
        return None


def normalize_text(value: str) -> Optional[str]:
    """Normalize text field: empty strings become None."""
    if not value or not value.strip():
        return None
    return value.strip()


def parse_budget_row(row: Dict[str, str]) -> Optional[Dict]:
    """Parse a CSV row into a budget record."""
    try:
        budget_period = parse_integer(row.get('Budget Period', ''))
        if budget_period is None:
            return None

        return {
            'budget_period': budget_period,
            'agency': normalize_text(row.get('Agency', '')),
            'fund': normalize_text(row.get('Fund', '')),
            'program': normalize_text(row.get('Program', '')),
            'activity': normalize_text(row.get('Activity', '')),
            'available_amount': parse_decimal(row.get('Available Amount', '0')),
            'obligated_amount': parse_decimal(row.get('Obligated Amount', '0')),
            'spend_amount': parse_decimal(row.get('Spend Amount', '0')),
            'remaining_amount': parse_decimal(row.get('Remaining Amount', '0')),
            'budget_amount': parse_decimal(row.get('Budget Amount', '0')),
            'budget_remaining_amount': parse_decimal(row.get('Budget Remaining Amount', '0')),
        }
    except Exception as e:
        print(f"  Error parsing row: {e}")
        return None


def import_budget_file(supabase: Client, file_path: Path, year: int) -> tuple[int, int]:
    """Import a single budget CSV file."""
    print(f"  Processing {file_path.name}...")
    
    records = []
    skipped = 0
    
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                parsed = parse_budget_row(row)
                if parsed:
                    records.append(parsed)
                else:
                    skipped += 1
                    if skipped <= 5:  # Only log first 5 skipped rows
                        print(f"    Skipped row {row_num}: invalid budget_period")
        
        if not records:
            print(f"  No valid records found in {file_path.name}")
            return 0, skipped
        
        # Batch insert with duplicate handling
        total_inserted = 0
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]
            try:
                # Use upsert with ON CONFLICT DO NOTHING to skip duplicates
                # The unique index will prevent duplicates
                result = supabase.table('budgets').upsert(
                    batch,
                    on_conflict='budget_period,agency,fund,program,activity,available_amount,obligated_amount,spend_amount,remaining_amount,budget_amount,budget_remaining_amount'
                ).execute()
                inserted = len(result.data) if result.data else 0
                total_inserted += inserted
                print(f"    Processed batch: {inserted} new records (total: {total_inserted}/{len(records)})")
            except Exception as e:
                # If upsert fails, try regular insert (for backwards compatibility)
                try:
                    result = supabase.table('budgets').insert(batch).execute()
                    inserted = len(result.data) if result.data else len(batch)
                    total_inserted += inserted
                    print(f"    Inserted batch: {inserted} records (total: {total_inserted}/{len(records)})")
                except Exception as e2:
                    print(f"    Error inserting batch {i//BATCH_SIZE + 1}: {e2}")
                    raise
        
        return total_inserted, skipped
    
    except FileNotFoundError:
        print(f"  Error: File not found: {file_path}")
        return 0, skipped
    except Exception as e:
        print(f"  Error processing {file_path.name}: {e}")
        return 0, skipped


def main():
    """Main import function."""
    # Validate environment
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url:
        print("Error: NEXT_PUBLIC_SUPABASE_URL not set in environment")
        sys.exit(1)
    
    if not supabase_key:
        print("Error: SUPABASE_SERVICE_ROLE_KEY not set in environment")
        sys.exit(1)
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
    except Exception as e:
        print(f"Error creating Supabase client: {e}")
        sys.exit(1)
    
    # Validate CSV directory
    if not CSV_DIR.exists():
        print(f"Error: CSV directory not found: {CSV_DIR}")
        sys.exit(1)
    
    print("=" * 60)
    print("Budget Import Script")
    print("=" * 60)
    print(f"CSV Directory: {CSV_DIR}")
    print(f"Batch Size: {BATCH_SIZE}")
    print()
    
    # Process each year
    total_inserted = 0
    total_skipped = 0
    
    for year in YEARS:
        file_path = CSV_DIR / f"{year}_ALL_budgets.csv"
        
        if not file_path.exists():
            print(f"⚠️  Skipping {year}: File not found")
            continue
        
        print(f"📁 Year {year}:")
        inserted, skipped = import_budget_file(supabase, file_path, year)
        total_inserted += inserted
        total_skipped += skipped
        print()
    
    # Summary
    print("=" * 60)
    print("Import Summary")
    print("=" * 60)
    print(f"Total records inserted: {total_inserted:,}")
    print(f"Total rows skipped: {total_skipped:,}")
    print("=" * 60)


if __name__ == '__main__':
    main()

