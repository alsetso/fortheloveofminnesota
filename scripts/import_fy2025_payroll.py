#!/usr/bin/env python3
"""
Import FY2025 payroll from Excel into checkbook.payroll.
Uses pandas + Supabase upsert. Requires: unique constraint payroll_unique_record on (temporary_id, record_nbr, fiscal_year).

Usage:
  python scripts/import_fy2025_payroll.py

Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).
"""
from pathlib import Path
import os
import math

# Resolve project root and file path
ROOT = Path(__file__).resolve().parent.parent
FILE_PATH = ROOT / "minnesota_gov" / "State Payrole" / "fiscal-year-2025.xlsx"

# Config
BATCH_SIZE = 1000
FISCAL_YEAR = "2025"

# Load env (support .env.local)
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

def main():
    import pandas as pd
    from supabase import create_client
    import numpy as np

    # Resolve sheet names (FY25 HR INFO, FY25 EARNINGS in this file)
    xl = pd.ExcelFile(FILE_PATH)
    hr_sheet = next((s for s in xl.sheet_names if "HR INFO" in s), None)
    earn_sheet = next((s for s in xl.sheet_names if "EARNINGS" in s), None)
    if not hr_sheet or not earn_sheet:
        raise SystemExit("Sheets 'HR INFO' and 'EARNINGS' not found in workbook.")

    # Load both sheets
    hr = pd.read_excel(FILE_PATH, sheet_name=hr_sheet)
    earnings = pd.read_excel(FILE_PATH, sheet_name=earn_sheet)

    # One row per TEMPORARY_ID in earnings (avoid duplicate HR rows on merge)
    earnings = earnings.drop_duplicates(subset=["TEMPORARY_ID"], keep="first")

    # Join on TEMPORARY_ID
    df = hr.merge(earnings, on="TEMPORARY_ID", how="left")

    # Set fiscal year
    df["fiscal_year"] = FISCAL_YEAR

    # Fix date columns — convert datetime to integer Excel serial or null
    def to_int_safe(val):
        if pd.isna(val):
            return None
        if isinstance(val, int):
            return val
        try:
            return int(val.timestamp() / 86400 + 25569)  # Excel serial
        except Exception:
            return None

    df["original_hire_date"] = df["ORIGINAL_HIRE_DATE"].apply(to_int_safe)
    df["job_entry_date"] = df["JOB_ENTRY_DATE"].apply(to_int_safe)

    # Drop original date columns so we only have the serial versions
    df = df.drop(columns=["ORIGINAL_HIRE_DATE", "JOB_ENTRY_DATE"], errors="ignore")

    # Fix wage nulls — coerce '-' and null to 0
    for col in ["REGULAR_WAGES", "OVERTIME_WAGES", "OTHER_WAGES", "TOTAL_WAGES"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # last_hire_date: keep as text (can be '-', int, or date string)
    def last_hire_safe(val):
        if pd.isna(val):
            return None
        if val == "-" or str(val).strip() == "":
            return None
        return str(val).strip()

    df["last_hire_date"] = df["LAST_HIRE_DATE"].apply(last_hire_safe)
    df = df.drop(columns=["LAST_HIRE_DATE"], errors="ignore")

    # Rename columns to match schema
    column_map = {
        "TEMPORARY_ID": "temporary_id",
        "RECORD_NBR": "record_nbr",
        "EMPLOYEE_NAME": "employee_name",
        "AGENCY_NBR": "agency_nbr",
        "AGENCY_NAME": "agency_name",
        "DEPARTMENT_NBR": "department_nbr",
        "DEPARTMENT_NAME": "department_name",
        "BRANCH_CODE": "branch_code",
        "BRANCH_NAME": "branch_name",
        "JOB_CODE": "job_code",
        "JOB_TITLE": "job_title",
        "LOCATION_NBR": "location_nbr",
        "LOCATION_NAME": "location_name",
        "LOCATION_COUNTY_NAME": "location_county_name",
        "REG_TEMP_CODE": "reg_temp_code",
        "REG_TEMP_DESC": "reg_temp_desc",
        "CLASSIFIED_CODE": "classified_code",
        "CLASSIFIED_DESC": "classified_desc",
        "FULL_PART_TIME_CODE": "full_part_time_code",
        "FULL_PART_TIME_DESC": "full_part_time_desc",
        "SALARY_PLAN_GRID": "salary_plan_grid",
        "SALARY_GRADE_RANGE": "salary_grade_range",
        "MAX_SALARY_STEP": "max_salary_step",
        "COMPENSATION_RATE": "compensation_rate",
        "COMP_FREQUENCY_CODE": "comp_frequency_code",
        "COMP_FREQUENCY_DESC": "comp_frequency_desc",
        "POSITION_FTE": "position_fte",
        "BARGAINING_UNIT_NBR": "bargaining_unit_nbr",
        "BARGAINING_UNIT_NAME": "bargaining_unit_name",
        "REGULAR_WAGES": "regular_wages",
        "OVERTIME_WAGES": "overtime_wages",
        "OTHER_WAGES": "other_wages",
        "TOTAL_WAGES": "total_wages",
    }
    # FY-specific active column (e.g. ACTIVE_ON_JUNE_30_2025)
    active_col = next((c for c in df.columns if "ACTIVE_ON_JUNE_30" in str(c).upper()), None)
    if active_col:
        column_map[active_col] = "active_on_june_30"

    df = df.rename(columns=column_map)

    # Ensure record_nbr is int (nullable)
    if "record_nbr" in df.columns:
        df["record_nbr"] = pd.to_numeric(df["record_nbr"], errors="coerce").astype("Int64")

    # Keep only schema columns we send (no id, created_at, updated_at)
    schema_cols = [
        "temporary_id", "record_nbr", "employee_name", "agency_nbr", "agency_name",
        "department_nbr", "department_name", "branch_code", "branch_name",
        "job_code", "job_title", "location_nbr", "location_name", "location_county_name",
        "reg_temp_code", "reg_temp_desc", "classified_code", "classified_desc",
        "original_hire_date", "last_hire_date", "job_entry_date",
        "full_part_time_code", "full_part_time_desc", "active_on_june_30",
        "salary_plan_grid", "salary_grade_range", "max_salary_step",
        "compensation_rate", "comp_frequency_code", "comp_frequency_desc",
        "position_fte", "bargaining_unit_nbr", "bargaining_unit_name",
        "regular_wages", "overtime_wages", "other_wages", "total_wages",
        "fiscal_year",
    ]
    df = df[[c for c in schema_cols if c in df.columns]]

    # Replace NaN with None for JSON
    df = df.replace({np.nan: None})

    # Coerce integer columns to int (schema expects integer, not float)
    int_cols = ["record_nbr", "original_hire_date", "job_entry_date", "salary_grade_range", "max_salary_step", "bargaining_unit_nbr"]
    for c in int_cols:
        if c in df.columns:
            df[c] = df[c].apply(lambda x: int(x) if x is not None and not (isinstance(x, float) and math.isnan(x)) else None)

    # Supabase client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).")
    supabase = create_client(url, key)

    # Batch upsert
    records = df.to_dict(orient="records")
    int_cols_set = {"record_nbr", "original_hire_date", "job_entry_date", "salary_grade_range", "max_salary_step", "bargaining_unit_nbr"}
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, float) and math.isnan(v):
                r[k] = None
            elif k in int_cols_set and v is not None:
                # Ensure integer columns are sent as int (not float like 25610.0)
                try:
                    r[k] = int(float(v)) if v is not None else None
                except (TypeError, ValueError):
                    r[k] = None

    total_batches = math.ceil(len(records) / BATCH_SIZE)
    print(f"Total records: {len(records)}")
    print(f"Total batches: {total_batches}")

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        supabase.schema("checkbook").from_("payroll").upsert(
            batch,
            on_conflict="temporary_id,record_nbr,fiscal_year",
        ).execute()
        print(f"Batch {batch_num}/{total_batches} complete — {i + len(batch)} rows upserted")

    print("FY2025 import complete.")


if __name__ == "__main__":
    main()
