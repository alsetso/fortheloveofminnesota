# Minnesota State Payroll Files — Full Assessment (FY2020–2025)

Assessment date: 2025-02-20. Purpose: decide whether to seed payroll data and whether to load all 6 years or start with the most recent.

---

## Step 1 — File locations and sizes

All files are **Excel (.xlsx)** under `minnesota_gov/State Payrole/` (note directory name spelling "Payrole").

| File | Path | Size (bytes) | Size (MB) |
|------|------|--------------|-----------|
| FY2020 | `minnesota_gov/State Payrole/fiscal-year-2020.xlsx` | 16,592,583 | 15.82 |
| FY2021 | `minnesota_gov/State Payrole/fiscal-year-2021.xlsx` | 16,062,178 | 15.32 |
| FY2022 | `minnesota_gov/State Payrole/fiscal-year-2022.xlsx` | 18,114,914 | 17.28 |
| FY2023 | `minnesota_gov/State Payrole/fiscal-year-2023.xlsx` | 18,329,171 | 17.48 |
| FY2024 | `minnesota_gov/State Payrole/fiscal-year-2024.xlsx` | 17,233,287 | 16.43 |
| FY2025 | `minnesota_gov/State Payrole/fiscal-year-2025.xlsx` | 18,006,625 | 17.17 |

**Total size (all 6 files):** ~103.5 MB.

**Other directories checked:**  
`data/`, `scripts/`, `seeds/`, `prisma/` — no payroll CSV/Excel files. Payroll lives only in `minnesota_gov/State Payrole/`.  
Import script: `scripts/import_payroll.py` (reads from the path above; currently `FISCAL_YEARS = [2020]` for testing).

---

## Step 2 — File structure

- **File type:** Microsoft Excel (.xlsx). Not CSV — use `openpyxl` or equivalent; `file` and `wc -l` are not applicable.
- **Sheets per file:** 4 — `Overview`, `FY## HR INFO`, `FY## EARNINGS`, `Metadata`. Use **HR INFO** and **EARNINGS** only; join on `TEMPORARY_ID`.

### HR INFO sheet

- **Columns:** 33 (numbered below).
- **Data rows (per year):** see Step 5.

| # | Excel column |
|---|----------------|
| 1 | TEMPORARY_ID |
| 2 | RECORD_NBR |
| 3 | EMPLOYEE_NAME |
| 4 | AGENCY_NBR |
| 5 | AGENCY_NAME |
| 6 | DEPARTMENT_NBR |
| 7 | DEPARTMENT_NAME |
| 8 | BRANCH_CODE |
| 9 | BRANCH_NAME |
| 10 | JOB_CODE |
| 11 | JOB_TITLE |
| 12 | LOCATION_NBR |
| 13 | LOCATION_NAME |
| 14 | LOCATION_COUNTY_NAME |
| 15 | REG_TEMP_CODE |
| 16 | REG_TEMP_DESC |
| 17 | CLASSIFIED_CODE |
| 18 | CLASSIFIED_DESC |
| 19 | ORIGINAL_HIRE_DATE |
| 20 | LAST_HIRE_DATE |
| 21 | JOB_ENTRY_DATE |
| 22 | FULL_PART_TIME_CODE |
| 23 | FULL_PART_TIME_DESC |
| 24 | SALARY_PLAN_GRID |
| 25 | SALARY_GRADE_RANGE |
| 26 | MAX_SALARY_STEP |
| 27 | COMPENSATION_RATE |
| 28 | COMP_FREQUENCY_CODE |
| 29 | COMP_FREQUENCY_DESC |
| 30 | POSITION_FTE |
| 31 | BARGAINING_UNIT_NBR |
| 32 | BARGAINING_UNIT_NAME |
| 33 | ACTIVE_ON_JUNE_30_#### (year varies) |

### EARNINGS sheet

- **Columns:** 5.

| # | Excel column |
|---|----------------|
| 1 | TEMPORARY_ID |
| 2 | REGULAR_WAGES |
| 3 | OVERTIME_WAGES |
| 4 | OTHER_WAGES |
| 5 | TOTAL_WAGES |

### Sample rows (first 3)

**HR INFO (FY2025, first 10 columns):**  
- Row1: `['025701292535', 0, 'Edstrom,Robert L', 'G67', 'Revenue Dept', 'G675835', 'Tax Ops-Early Audit 2', 'E', 'Executive', '002757']`  
- Row2: `['064783205662', 1, 'Rydell,Susan T', 'E26', 'MN St Colleges & Universities', ...]`  
- Row3: `['064783205662', 2, 'Rydell,Susan T', 'E26', 'MN St Colleges & Universities', ...]`

**EARNINGS (FY2025):**  
- Row1: `['021788423953', 389213.12, 14004.34, 216130.12, 619347.58]`  
- Row2: `['331010253552', 389213.12, 3886.35, 222802.47, 615901.94]`  
- Row3: `['034936062129', 405416, 0, 209176.13, 614592.13]`

Note: Some EARNINGS cells contain string `'-'` (e.g. FY2021); import script must coerce to 0.

---

## Step 3 — Sample data quality (FY2025)

- **Unique agencies (by AGENCY_NAME):** 106.
- **Unique employees (by EMPLOYEE_NAME):** 68,923.
- **COMPENSATION_RATE:** min = 0.00, max = 17,751.95.  
  - Lowest 5: 0, 0, 0, 0, 0.  
  - Highest 5: 14,367.81, 14,658.61, 14,792.12, 17,318.97, 17,751.95.
- **TOTAL_WAGES (from EARNINGS):** Sample rows show values in the 60k–620k range; high earners and/or multiple jobs can push totals high. Full range not computed in script; visually consistent with COMPENSATION_RATE scale.

**Top 20 agencies by row count (FY2025):**

| Row count | Agency name |
|-----------|-------------|
| 23,616 | MN St Colleges & Universities |
| 6,078 | Transportation Dept |
| 5,498 | Direct Care and Treatment Dept |
| 5,015 | Corrections Dept |
| 3,614 | Natural Resources Dept |
| 3,158 | Human Services Dept |
| 3,146 | Trial Courts |
| 3,043 | Minnesota IT Services |
| 2,430 | Public Safety Dept |
| 2,256 | Health Department |
| 2,056 | Veterans Affairs Dept |
| 1,780 | Employ & Econ Development Dept |
| 1,650 | Revenue Dept |
| 1,206 | Pollution Control Agency |
| 1,088 | Public Defense Board |
| 839 | Children Youth & Families Dept |
| 700 | Labor & Industry Dept |
| 617 | Administration Dept |
| 616 | Agriculture Dept |
| 580 | Supreme Court |

---

## Step 4 — Column mapping to `checkbook.payroll`

Schema columns you listed are all present in the table and have a source in the Excel files. No new schema columns required.

| Excel (HR INFO) | checkbook.payroll | Notes |
|-----------------|-------------------|--------|
| TEMPORARY_ID | temporary_id | NOT NULL, join key |
| RECORD_NBR | record_nbr | |
| EMPLOYEE_NAME | employee_name | |
| AGENCY_NBR | agency_nbr | |
| AGENCY_NAME | agency_name | |
| DEPARTMENT_NBR | department_nbr | |
| DEPARTMENT_NAME | department_name | |
| BRANCH_CODE | branch_code | |
| BRANCH_NAME | branch_name | |
| JOB_CODE | job_code | |
| JOB_TITLE | job_title | |
| LOCATION_NBR | location_nbr | |
| LOCATION_NAME | location_name | |
| LOCATION_COUNTY_NAME | location_county_name | |
| REG_TEMP_CODE | reg_temp_code | |
| REG_TEMP_DESC | reg_temp_desc | |
| CLASSIFIED_CODE | classified_code | |
| CLASSIFIED_DESC | classified_desc | |
| ORIGINAL_HIRE_DATE | original_hire_date | integer (Excel serial) |
| LAST_HIRE_DATE | last_hire_date | text (int or '-') |
| JOB_ENTRY_DATE | job_entry_date | integer (Excel serial) |
| FULL_PART_TIME_CODE | full_part_time_code | |
| FULL_PART_TIME_DESC | full_part_time_desc | |
| ACTIVE_ON_JUNE_30_#### | active_on_june_30 | column name varies by year |
| SALARY_PLAN_GRID | salary_plan_grid | |
| SALARY_GRADE_RANGE | salary_grade_range | |
| MAX_SALARY_STEP | max_salary_step | |
| COMPENSATION_RATE | compensation_rate | |
| COMP_FREQUENCY_CODE | comp_frequency_code | |
| COMP_FREQUENCY_DESC | comp_frequency_desc | |
| POSITION_FTE | position_fte | |
| BARGAINING_UNIT_NBR | bargaining_unit_nbr | |
| BARGAINING_UNIT_NAME | bargaining_unit_name | |

| Excel (EARNINGS) | checkbook.payroll |
|------------------|-------------------|
| REGULAR_WAGES | regular_wages |
| OVERTIME_WAGES | overtime_wages |
| OTHER_WAGES | other_wages |
| TOTAL_WAGES | total_wages |

**Added at import:** `fiscal_year` (text, e.g. `"2025"`) — column exists in schema.  
**Resolved at runtime:** `ACTIVE_ON_JUNE_30_####` — script finds the column whose name contains `ACTIVE_ON_JUNE_30` for that year’s sheet.

---

## Step 5 — Row count per fiscal year

After joining HR INFO to EARNINGS on `TEMPORARY_ID` (one row per HR record; LEFT JOIN so HR-only rows remain):

| Fiscal year | Rows |
|-------------|------|
| 2020 | 73,348 |
| 2021 | 75,502 |
| 2022 | 77,807 |
| 2023 | 74,813 |
| 2024 | 75,137 |
| 2025 | 76,218 |
| **Total** | **452,825** |

So seeding all 6 years would insert **~453k rows** into `checkbook.payroll`.

---

## Step 6 — Agency name cross-reference with `checkbook.org_agency_map`

- **FY2025 distinct agency names (from payroll file):** 106.  
- **Documented `checkbook.org_agency_map`:** 20 rows (see `docs/CHECKBOOK_SCHEMA_AUDIT.md`).  
- **Note:** The Supabase project used for this assessment does not expose `checkbook.org_agency_map` (relation not found). The cross-reference below uses the **documented** map of 20 agencies.

**Mapped agency_name (org_agency_map) → Payroll FY2025**

| org_slug | agency_name (map) | In payroll? | Payroll name if different |
|----------|-------------------|------------|----------------------------|
| dept-administration | Administration Dept | Yes | Administration Dept |
| dept-agriculture | Agriculture Dept | Yes | Agriculture Dept |
| dept-children-youth-families | Children Youth & Families Dept | Yes | Children Youth & Families Dept |
| dept-commerce | Commerce Dept | Yes | Commerce Dept |
| dept-corrections | Corrections Dept | Yes | Corrections Dept |
| dept-direct-care-treatment | Direct Care and Treatment | Yes | Direct Care and Treatment **Dept** |
| dept-education | Education Department | Yes | Education Department |
| dept-employment-economic-dev | Employ & Econ Development Dept | Yes | Employ & Econ Development Dept |
| dept-health | Health Department | Yes | Health Department |
| dept-human-rights | Human Rights Dept | Yes | Human Rights Dept |
| dept-human-services | Department of Human Services | Yes | **Human Services Dept** |
| dept-labor-industry | Labor & Industry Dept | Yes | Labor & Industry Dept |
| dept-management-budget | Mn Management & Budget | Yes | Mn Management & Budget |
| dept-military-affairs | Military Affairs Dept | Yes | Military Affairs Dept |
| dept-natural-resources | Natural Resources Dept | Yes | Natural Resources Dept |
| dept-public-safety | Public Safety Dept | Yes | Public Safety Dept |
| dept-revenue | Revenue Dept | Yes | Revenue Dept |
| dept-transportation | Transportation Dept | Yes | Transportation Dept |
| dept-veterans-affairs | Veterans Affairs Dept | Yes | Veterans Affairs Dept |
| mn-state-colleges-universities | MN St Colleges & Universities | Yes | MN St Colleges & Universities |

**Summary:**

- **All 20 mapped agencies** appear in FY2025 payroll with exact or near-exact names.  
- **2** need name normalization when linking to `org_agency_map`:  
  - "Human Services Dept" → map "Department of Human Services"  
  - "Direct Care and Treatment Dept" → map "Direct Care and Treatment"  
- **86** payroll agencies are **not** in the 20-row map (boards, councils, courts, commissions, MNsure, Legislature, etc.). If you want payroll → civic.orgs links for those, the map would need to be expanded.

---

## Recommendation (for seeding decision)

- **Schema:** No changes needed; all columns map.  
- **Volume:** ~453k rows for all 6 years; ~76k for FY2025 only.  
- **Import path:** `scripts/import_payroll.py` already supports the structure; set `FISCAL_YEARS = [2020, 2021, 2022, 2023, 2024, 2025]` (or subset) and run.  
- **Agency linking:** 20/20 mapped agencies present in payroll; 86 additional agencies in payroll not in the map.  
- **Data quality:** One representative year (FY2025) shows 106 agencies, ~69k distinct employee names, and plausible compensation/wage ranges; EARNINGS sometimes use `'-'` and must be normalized to 0.

You can either seed **all 6 years** (~453k rows) or **start with FY2024/FY2025 only** (~75–76k rows each) and add earlier years later. The assessment script used for this report is `scripts/assess_payroll_files.py` (run with `.venv` Python and `openpyxl` installed).
