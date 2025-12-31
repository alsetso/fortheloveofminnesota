# Checkbook Data Import Requirements

## Overview
This document outlines the import requirements for three checkbook tables: `budgets`, `payments`, and `payroll`.

---

## 1. BUDGETS TABLE (`checkbook.budgets`)

### Source Files
- **7 CSV files** (one per year):
  - `Budget/2020_ALL_budgets.csv`
  - `Budget/2021_ALL_budgets.csv`
  - `Budget/2022_ALL_budgets.csv`
  - `Budget/2023_ALL_budgets.csv`
  - `Budget/2024_ALL_budgets.csv`
  - `Budget/2025_ALL_budgets.csv`
  - `Budget/2026_ALL_budgets.csv`

### File Structure
- **Header row**: `Budget Period,Agency,Fund,Program,Activity,Available Amount,Obligated Amount,Spend Amount,Remaining Amount,Budget Amount,Budget Remaining Amount`
- **Estimated rows**: ~1,800 rows per file (12,600 total)

### Column Mapping
| CSV Column | DB Column | Type | Notes |
|------------|-----------|------|-------|
| Budget Period | `budget_period` | INTEGER | Parse from string |
| Agency | `agency` | TEXT | Can be NULL |
| Fund | `fund` | TEXT | Can be NULL |
| Program | `program` | TEXT | Can be NULL |
| Activity | `activity` | TEXT | Can be NULL |
| Available Amount | `available_amount` | NUMERIC(15,2) | Parse decimal |
| Obligated Amount | `obligated_amount` | NUMERIC(15,2) | Parse decimal |
| Spend Amount | `spend_amount` | NUMERIC(15,2) | Parse decimal |
| Remaining Amount | `remaining_amount` | NUMERIC(15,2) | Parse decimal |
| Budget Amount | `budget_amount` | NUMERIC(15,2) | Parse decimal |
| Budget Remaining Amount | `budget_remaining_amount` | NUMERIC(15,2) | Parse decimal |

### Transformations Needed
- Parse `Budget Period` string to INTEGER
- Parse all amount fields from strings to NUMERIC
- Handle empty strings as NULL for nullable TEXT fields
- Handle empty strings as 0 for NUMERIC fields

### Import Strategy
- Process files sequentially by year
- Batch insert in chunks of 500-1000 rows
- Use `ON CONFLICT` handling if needed (though no unique constraint exists)

---

## 2. PAYMENTS TABLE (`checkbook.payments`)

### Source Files
- **Main payments** (6 CSV files):
  - `Payments/2021_payments.csv`
  - `Payments/2022_payments.csv`
  - `Payments/2023_payments.csv`
  - `Payments/2024_payments.csv`
  - `Payments/2025_payments.csv`
  - `Payments/2026_payments.csv`

- **DHS Payees** (7 CSV files):
  - `Payments/Payments and Payees/Department of Human Services/2020.csv`
  - `Payments/Payments and Payees/Department of Human Services/2021_DHS_payees.csv`
  - `Payments/Payments and Payees/Department of Human Services/2022_DHS_payees.csv`
  - `Payments/Payments and Payees/Department of Human Services/2023_DHS_payees.csv`
  - `Payments/Payments and Payees/Department of Human Services/2024_DHS_payees.csv`
  - `Payments/Payments and Payees/Department of Human Services/2025_DHS_payees.csv`
  - `Payments/Payments and Payees/Department of Human Services/2026_DHS_payees.csv`

### File Structure

**Main Payments Format:**
- **Header**: `Budget Period,Payment Amount,Agency`
- **Estimated rows**: ~100-200 rows per file

**DHS Payees Format:**
- **Header**: `Payment Amount,Budget Period,Agency,Payee`
- **Estimated rows**: ~8,500 rows for 2026

### Column Mapping

**Main Payments:**
| CSV Column | DB Column | Type | Notes |
|------------|-----------|------|-------|
| Budget Period | `budget_period` | INTEGER | Parse from string |
| Payment Amount | `payment_amount` | NUMERIC(15,2) | Parse decimal |
| Agency | `agency` | TEXT | Can be NULL |
| (none) | `payee` | TEXT | NULL for main payments |

**DHS Payees:**
| CSV Column | DB Column | Type | Notes |
|------------|-----------|------|-------|
| Payment Amount | `payment_amount` | NUMERIC(15,2) | Parse decimal |
| Budget Period | `budget_period` | INTEGER | Parse from string |
| Agency | `agency` | TEXT | Can be NULL |
| Payee | `payee` | TEXT | Can be NULL |

### Transformations Needed
- Parse `Budget Period` string to INTEGER
- Parse `Payment Amount` from string to NUMERIC
- Handle empty strings as NULL for nullable TEXT fields
- Handle empty strings as 0 for NUMERIC fields
- **Note**: Column order differs between main payments and DHS payees formats

### Import Strategy
- Process main payments files first
- Process DHS payees files separately
- Both can be imported into the same table (payee will be NULL for main payments)
- Batch insert in chunks of 500-1000 rows

---

## 3. PAYROLL TABLE (`checkbook.payroll`)

### Source Files
- **6 Excel files** (one per fiscal year):
  - `State Payrole/fiscal-year-2020.xlsx`
  - `State Payrole/fiscal-year-2021.xlsx`
  - `State Payrole/fiscal-year-2022.xlsx`
  - `State Payrole/fiscal-year-2023.xlsx`
  - `State Payrole/fiscal-year-2024.xlsx`
  - `State Payrole/fiscal-year-2025.xlsx`

### File Structure
Each Excel file contains **4 sheets**:
1. `Overview` - Metadata/explanation (skip)
2. `FY## HR INFO` - Employee HR information (33 columns)
3. `FY## EARNINGS` - Employee earnings data (5 columns)
4. `Metadata` - Field descriptions (skip)

### Sheet Details

**HR INFO Sheet:**
- **Columns**: 33 columns
- **Estimated rows**: ~76,000 rows per file (2025 data)
- **Key column**: `TEMPORARY_ID` (used to join with EARNINGS)

**EARNINGS Sheet:**
- **Columns**: 5 columns (`TEMPORARY_ID`, `REGULAR_WAGES`, `OVERTIME_WAGES`, `OTHER_WAGES`, `TOTAL_WAGES`)
- **Estimated rows**: ~69,000 rows per file (2025 data)
- **Key column**: `TEMPORARY_ID` (used to join with HR INFO)

### Column Mapping

**HR INFO → DB:**
| Excel Column | DB Column | Type | Notes |
|--------------|-----------|------|-------|
| TEMPORARY_ID | `temporary_id` | TEXT | NOT NULL, join key |
| RECORD_NBR | `record_nbr` | INTEGER | Can be NULL |
| EMPLOYEE_NAME | `employee_name` | TEXT | Can be NULL |
| AGENCY_NBR | `agency_nbr` | TEXT | Can be NULL |
| AGENCY_NAME | `agency_name` | TEXT | Can be NULL |
| DEPARTMENT_NBR | `department_nbr` | TEXT | Can be NULL |
| DEPARTMENT_NAME | `department_name` | TEXT | Can be NULL |
| BRANCH_CODE | `branch_code` | TEXT | Can be NULL |
| BRANCH_NAME | `branch_name` | TEXT | Can be NULL |
| JOB_CODE | `job_code` | TEXT | Can be NULL |
| JOB_TITLE | `job_title` | TEXT | Can be NULL |
| LOCATION_NBR | `location_nbr` | TEXT | Can be NULL |
| LOCATION_NAME | `location_name` | TEXT | Can be NULL |
| LOCATION_COUNTY_NAME | `location_county_name` | TEXT | Can be NULL |
| REG_TEMP_CODE | `reg_temp_code` | TEXT | Can be NULL |
| REG_TEMP_DESC | `reg_temp_desc` | TEXT | Can be NULL |
| CLASSIFIED_CODE | `classified_code` | TEXT | Can be NULL |
| CLASSIFIED_DESC | `classified_desc` | TEXT | Can be NULL |
| ORIGINAL_HIRE_DATE | `original_hire_date` | INTEGER | Excel serial date |
| LAST_HIRE_DATE | `last_hire_date` | TEXT | Can be integer or '-' |
| JOB_ENTRY_DATE | `job_entry_date` | INTEGER | Excel serial date |
| FULL_PART_TIME_CODE | `full_part_time_code` | TEXT | Can be NULL |
| FULL_PART_TIME_DESC | `full_part_time_desc` | TEXT | Can be NULL |
| SALARY_PLAN_GRID | `salary_plan_grid` | TEXT | Can be NULL |
| SALARY_GRADE_RANGE | `salary_grade_range` | INTEGER | Can be NULL |
| MAX_SALARY_STEP | `max_salary_step` | INTEGER | Can be NULL |
| COMPENSATION_RATE | `compensation_rate` | NUMERIC(15,2) | Can be NULL |
| COMP_FREQUENCY_CODE | `comp_frequency_code` | TEXT | Can be NULL |
| COMP_FREQUENCY_DESC | `comp_frequency_desc` | TEXT | Can be NULL |
| POSITION_FTE | `position_fte` | NUMERIC(5,2) | Can be NULL |
| BARGAINING_UNIT_NBR | `bargaining_unit_nbr` | INTEGER | Can be NULL |
| BARGAINING_UNIT_NAME | `bargaining_unit_name` | TEXT | Can be NULL |
| ACTIVE_ON_JUNE_30_#### | `active_on_june_30` | TEXT | 'YES' or 'NO' |

**EARNINGS → DB:**
| Excel Column | DB Column | Type | Notes |
|--------------|-----------|------|-------|
| TEMPORARY_ID | `temporary_id` | TEXT | NOT NULL, join key |
| REGULAR_WAGES | `regular_wages` | NUMERIC(15,2) | Default 0 |
| OVERTIME_WAGES | `overtime_wages` | NUMERIC(15,2) | Default 0 |
| OTHER_WAGES | `other_wages` | NUMERIC(15,2) | Default 0 |
| TOTAL_WAGES | `total_wages` | NUMERIC(15,2) | Default 0 |

### Transformations Needed
- **Join HR INFO and EARNINGS** on `TEMPORARY_ID` (LEFT JOIN - some employees may have HR but no earnings)
- Parse date fields as integers (Excel serial dates - stored as-is, can convert later if needed)
- Handle `LAST_HIRE_DATE` which can be integer or '-' string
- Parse numeric fields (wages, compensation_rate, position_fte)
- Handle empty strings as NULL for nullable fields
- Handle empty strings as 0 for NUMERIC fields with NOT NULL
- Parse `ACTIVE_ON_JUNE_30_####` column name (year varies by file)

### Import Strategy
- Process each Excel file sequentially
- For each file:
  1. Read HR INFO sheet
  2. Read EARNINGS sheet
  3. Join on `TEMPORARY_ID` (LEFT JOIN EARNINGS to HR INFO)
  4. Insert combined records
- Batch insert in chunks of 500-1000 rows
- **Note**: Some employees may have HR data but no earnings (use LEFT JOIN)

### Special Considerations
- Excel files are large (16-18MB each)
- Sheet names vary by year (e.g., `FY20 HR INFO`, `FY25 HR INFO`)
- Date columns are Excel serial dates (integers) - stored as-is
- `LAST_HIRE_DATE` can be '-' string or integer
- `ACTIVE_ON_JUNE_30` column name includes year suffix

---

## General Import Considerations

### Performance
- Use batch inserts (500-1000 rows per batch)
- Consider disabling indexes during import, then rebuilding
- Use transactions for each file to allow rollback on errors

### Error Handling
- Log rows that fail validation
- Continue processing on non-critical errors
- Track import progress per file

### Data Validation
- Validate numeric fields before insert
- Handle NULL/empty values appropriately
- Validate date ranges (budget_period should be 2020-2026)

### Duplicate Handling
- Budgets: No unique constraint - duplicates allowed
- Payments: No unique constraint - duplicates allowed
- Payroll: `temporary_id` is NOT NULL but not unique - duplicates possible across years

### Recommended Import Order
1. Budgets (simplest, CSV format)
2. Payments (two formats, but straightforward)
3. Payroll (most complex, requires joining sheets)

