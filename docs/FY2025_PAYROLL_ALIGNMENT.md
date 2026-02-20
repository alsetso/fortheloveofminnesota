# FY2025 Payroll File — Full Alignment (No Import Yet)

All five steps below are answered before touching the database.

---

## Important: File format

The FY2025 payroll file is **Excel (.xlsx)**, not CSV. Commands like `wc -l`, `head`, `cut`, and `awk -F','` do not apply to the raw file. All counts and samples below were obtained by opening the workbook with Python (openpyxl).

---

## Step 1 — File inspection

### Exact file path and name

- **Path:** `/Users/colebremer/Desktop/Love of Minnesota/www/minnesota_gov/State Payrole/fiscal-year-2025.xlsx`
- **Name:** `fiscal-year-2025.xlsx`

### File size

- **18,006,625 bytes** (17.17 MB)

### Total row count (conceptual)

- **HR INFO sheet:** 76,218 data rows (header excluded). After LEFT JOIN to EARNINGS, **one row per HR record** = **76,218 rows**.
- **EARNINGS sheet:** 69,137 data rows.
- **Conceptual “total rows including header”:** 1 header + 76,218 = **76,219** (one logical row per HR record; wages from EARNINGS joined on TEMPORARY_ID).

### Every column name exactly as in header

**HR INFO (33 columns):**

1. `TEMPORARY_ID`
2. `RECORD_NBR`
3. `EMPLOYEE_NAME`
4. `AGENCY_NBR`
5. `AGENCY_NAME`
6. `DEPARTMENT_NBR`
7. `DEPARTMENT_NAME`
8. `BRANCH_CODE`
9. `BRANCH_NAME`
10. `JOB_CODE`
11. `JOB_TITLE`
12. `LOCATION_NBR`
13. `LOCATION_NAME`
14. `LOCATION_COUNTY_NAME`
15. `REG_TEMP_CODE`
16. `REG_TEMP_DESC`
17. `CLASSIFIED_CODE`
18. `CLASSIFIED_DESC`
19. `ORIGINAL_HIRE_DATE`
20. `LAST_HIRE_DATE`
21. `JOB_ENTRY_DATE`
22. `FULL_PART_TIME_CODE`
23. `FULL_PART_TIME_DESC`
24. `SALARY_PLAN_GRID`
25. `SALARY_GRADE_RANGE`
26. `MAX_SALARY_STEP`
27. `COMPENSATION_RATE`
28. `COMP_FREQUENCY_CODE`
29. `COMP_FREQUENCY_DESC`
30. `POSITION_FTE`
31. `BARGAINING_UNIT_NBR`
32. `BARGAINING_UNIT_NAME`
33. `ACTIVE_ON_JUNE_30_2025`

**EARNINGS (5 columns):**

1. `TEMPORARY_ID`
2. `REGULAR_WAGES`
3. `OVERTIME_WAGES`
4. `OTHER_WAGES`
5. `TOTAL_WAGES`

### First 3 data rows (real values)

**HR INFO (all 33 columns, Row 1–3):**

- **Row 1:** `['025701292535', 0, 'Edstrom,Robert L', 'G67', 'Revenue Dept', 'G675835', 'Tax Ops-Early Audit 2', 'E', 'Executive', '002757', 'Revenue Tax Specialist Int', 'G6747', 'Revenue Building, 1st Floor', 'Ramsey', 'U', 'Unlimited', 'C', 'Classified', datetime(1970, 2, 11), '-', datetime(1971, 2, 24), 'F', 'Full-Time', '14G', 10, 12, 42.31, 'H', 'Hourly', 1, 214, 'MN Assoc of Professional Empl', 'YES']`
- **Row 2:** `['064783205662', 1, 'Rydell,Susan T', 'E26', 'MN St Colleges & Universities', 'E26U07B', 'MnSCU Metro SU IFO', 'E', 'Executive', '007846', 'State University Faculty', ...]`
- **Row 3:** `['064783205662', 2, 'Rydell,Susan T', 'E26', 'MN St Colleges & Universities', ...]` (same person, RECORD_NBR = 2)

**EARNINGS (Row 1–3):**

- **Row 1:** `['021788423953', 389213.12, 14004.34, 216130.12, 619347.58]`
- **Row 2:** `['331010253552', 389213.12, 3886.35, 222802.47, 615901.94]`
- **Row 3:** `['034936062129', 405416, 0, 209176.13, 614592.13]`

---

## Step 2 — Column mapping to checkbook.payroll schema

Schema columns (from `information_schema.columns` for `checkbook.payroll`, ordered by ordinal_position):

| # | column_name | data_type | is_nullable |
|---|-------------|-----------|-------------|
| 1 | id | uuid | NO |
| 2 | temporary_id | text | NO |
| 3 | record_nbr | integer | YES |
| 4 | employee_name | text | YES |
| 5 | agency_nbr | text | YES |
| 6 | agency_name | text | YES |
| 7 | department_nbr | text | YES |
| 8 | department_name | text | YES |
| 9 | branch_code | text | YES |
| 10 | branch_name | text | YES |
| 11 | job_code | text | YES |
| 12 | job_title | text | YES |
| 13 | location_nbr | text | YES |
| 14 | location_name | text | YES |
| 15 | location_county_name | text | YES |
| 16 | reg_temp_code | text | YES |
| 17 | reg_temp_desc | text | YES |
| 18 | classified_code | text | YES |
| 19 | classified_desc | text | YES |
| 20 | original_hire_date | integer | YES |
| 21 | last_hire_date | text | YES |
| 22 | job_entry_date | integer | YES |
| 23 | full_part_time_code | text | YES |
| 24 | full_part_time_desc | text | YES |
| 25 | active_on_june_30 | text | YES |
| 26 | salary_plan_grid | text | YES |
| 27 | salary_grade_range | integer | YES |
| 28 | max_salary_step | integer | YES |
| 29 | compensation_rate | numeric | YES |
| 30 | comp_frequency_code | text | YES |
| 31 | comp_frequency_desc | text | YES |
| 32 | position_fte | numeric | YES |
| 33 | bargaining_unit_nbr | integer | YES |
| 34 | bargaining_unit_name | text | YES |
| 35 | regular_wages | numeric | NO |
| 36 | overtime_wages | numeric | NO |
| 37 | other_wages | numeric | NO |
| 38 | total_wages | numeric | NO |
| 39 | created_at | timestamp with time zone | NO |
| 40 | updated_at | timestamp with time zone | NO |
| 41 | fiscal_year | text | YES |

### Mapping: every source column → schema

| Source (HR or EARNINGS) | Schema column | Direct map? | Type match? | Nullable in source, required in schema? |
|-------------------------|---------------|-------------|------------|----------------------------------------|
| TEMPORARY_ID (HR) | temporary_id | Yes | text→text | Source: not empty in sample. Schema: NOT NULL. **OK.** |
| RECORD_NBR (HR) | record_nbr | Yes | number→integer | Both nullable. **OK.** |
| EMPLOYEE_NAME (HR) | employee_name | Yes | text→text | Both nullable. **OK.** |
| AGENCY_NBR (HR) | agency_nbr | Yes | text→text | Both nullable. **OK.** |
| AGENCY_NAME (HR) | agency_name | Yes | text→text | Both nullable. **OK.** |
| DEPARTMENT_NBR (HR) | department_nbr | Yes | text→text | Both nullable. **OK.** |
| DEPARTMENT_NAME (HR) | department_name | Yes | text→text | Both nullable. **OK.** |
| BRANCH_CODE (HR) | branch_code | Yes | text→text | Both nullable. **OK.** |
| BRANCH_NAME (HR) | branch_name | Yes | text→text | Both nullable. **OK.** |
| JOB_CODE (HR) | job_code | Yes | text→text | Both nullable. **OK.** |
| JOB_TITLE (HR) | job_title | Yes | text→text | Both nullable. **OK.** |
| LOCATION_NBR (HR) | location_nbr | Yes | text→text | Both nullable. **OK.** |
| LOCATION_NAME (HR) | location_name | Yes | text→text | Both nullable. **OK.** |
| LOCATION_COUNTY_NAME (HR) | location_county_name | Yes | text→text | Both nullable. **OK.** |
| REG_TEMP_CODE (HR) | reg_temp_code | Yes | text→text | Both nullable. **OK.** |
| REG_TEMP_DESC (HR) | reg_temp_desc | Yes | text→text | Both nullable. **OK.** |
| CLASSIFIED_CODE (HR) | classified_code | Yes | text→text | Both nullable. **OK.** |
| CLASSIFIED_DESC (HR) | classified_desc | Yes | text→text | Both nullable. **OK.** |
| ORIGINAL_HIRE_DATE (HR) | original_hire_date | Yes | **Note below** | Both nullable. **OK.** |
| LAST_HIRE_DATE (HR) | last_hire_date | Yes | text→text | Both nullable. **OK.** |
| JOB_ENTRY_DATE (HR) | job_entry_date | Yes | **Note below** | Both nullable. **OK.** |
| FULL_PART_TIME_CODE (HR) | full_part_time_code | Yes | text→text | Both nullable. **OK.** |
| FULL_PART_TIME_DESC (HR) | full_part_time_desc | Yes | text→text | Both nullable. **OK.** |
| ACTIVE_ON_JUNE_30_2025 (HR) | active_on_june_30 | Yes | text→text | Both nullable. **OK.** |
| SALARY_PLAN_GRID (HR) | salary_plan_grid | Yes | text→text | Both nullable. **OK.** |
| SALARY_GRADE_RANGE (HR) | salary_grade_range | Yes | number→integer | Both nullable. **OK.** |
| MAX_SALARY_STEP (HR) | max_salary_step | Yes | number→integer | Both nullable. **OK.** |
| COMPENSATION_RATE (HR) | compensation_rate | Yes | number→numeric | Both nullable. **OK.** |
| COMP_FREQUENCY_CODE (HR) | comp_frequency_code | Yes | text→text | Both nullable. **OK.** |
| COMP_FREQUENCY_DESC (HR) | comp_frequency_desc | Yes | text→text | Both nullable. **OK.** |
| POSITION_FTE (HR) | position_fte | Yes | number→numeric | Both nullable. **OK.** |
| BARGAINING_UNIT_NBR (HR) | bargaining_unit_nbr | Yes | number→integer | Both nullable. **OK.** |
| BARGAINING_UNIT_NAME (HR) | bargaining_unit_name | Yes | text→text | Both nullable. **OK.** |
| REGULAR_WAGES (EARNINGS) | regular_wages | Yes | number→numeric | **Schema NOT NULL default 0.** Source can be missing for HR-only rows → use 0. **OK.** |
| OVERTIME_WAGES (EARNINGS) | overtime_wages | Yes | number→numeric | **Schema NOT NULL default 0.** Source can be '-' in other years → coerce to 0. **OK.** |
| OTHER_WAGES (EARNINGS) | other_wages | Yes | number→numeric | **Schema NOT NULL default 0.** Same as above. **OK.** |
| TOTAL_WAGES (EARNINGS) | total_wages | Yes | number→numeric | **Schema NOT NULL default 0.** Same as above. **OK.** |

**Not from source (set on insert):** `id` (uuid, gen_random_uuid), `created_at`, `updated_at`, `fiscal_year` (e.g. `'2025'`).

**Notes:**

- **ORIGINAL_HIRE_DATE / JOB_ENTRY_DATE:** In FY2025 Excel these appear as Python `datetime` (openpyxl data_only). Schema expects `integer` (Excel serial). Import must convert date → serial (or store as integer YYYYMMDD if preferred and documented).
- **LAST_HIRE_DATE:** Can be integer or `'-'` in source; schema is text, nullable. **OK.**
- **ACTIVE_ON_JUNE_30_2025:** Column name is year-specific; import resolves by pattern `ACTIVE_ON_JUNE_30*`.
- **Wages:** Schema requires NOT NULL; default 0. For HR rows with no EARNINGS row, use 0. For EARNINGS cells that are `'-'`, coerce to 0.

**Source columns with no schema column:** None. Every HR and EARNINGS column maps to an existing column (or is used only for join). No new column needed; none dropped.

---

## Step 3 — Data quality check on FY2025 (joined view)

- **Null or empty employee_name:** **0**
- **Null or empty agency_name:** **0**
- **Null/empty/missing total_wages:** **0** (every HR row’s TEMPORARY_ID appears in EARNINGS with a non-null, non-dash TOTAL_WAGES in this file; any HR-only row in other years would get total_wages = 0 on insert)

**Distinct agency names in file:** 106 (full list in Step 4 and in `scripts/fy2025_agency_list.txt`).

**Obvious data quality issues:**

- Date columns in Excel are read as Python `datetime`; conversion to schema integer (serial or YYYYMMDD) must be consistent.
- Same person can have multiple HR rows (same TEMPORARY_ID, different RECORD_NBR); EARNINGS has one row per TEMPORARY_ID, so all HR rows for that person get the same wage totals (by design).
- No nulls on employee_name, agency_name, or total_wages in this file.

---

## Step 4 — Agency name cross-reference with org_agency_map

**Database check:** The table `checkbook.org_agency_map` **does not exist** in the current Supabase project (only `budgets`, `contracts`, `payments`, `payroll` exist under `checkbook`). So the Step 4 SQL cannot be run as written.

**Cross-reference using documented map:** From `docs/CHECKBOOK_SCHEMA_AUDIT.md`, `org_agency_map` is documented with **20** agencies. Matching those to the **106** distinct agency names in the FY2025 file:

**Exact match (18):**  
Administration Dept, Agriculture Dept, Children Youth & Families Dept, Commerce Dept, Corrections Dept, Education Department, Employ & Econ Development Dept, Health Department, Human Rights Dept, Labor & Industry Dept, Mn Management & Budget, Military Affairs Dept, Natural Resources Dept, Public Safety Dept, Revenue Dept, Transportation Dept, Veterans Affairs Dept, MN St Colleges & Universities.

**Name variant but same agency (2):**

- Payroll: **Human Services Dept** → Map: **Department of Human Services**
- Payroll: **Direct Care and Treatment Dept** → Map: **Direct Care and Treatment**

**Summary:**

- **Matched (exact + variant):** 20 of 20 documented map agencies appear in the payroll file.
- **New (in payroll, not in documented map):** **86** agencies (boards, councils, courts, commissions, MNsure, Legislature, etc.).

If/when `checkbook.org_agency_map` is created and populated (e.g. with the 20 above), the same logic can be run in SQL. Example pattern (once the table exists):

```sql
select distinct src.agency_name, m.org_slug as mapped
from (
  values
  ('Accountancy Board'),
  ('Administration Dept'),
  -- ... all 106 from scripts/fy2025_agency_list.txt ...
) as src(agency_name)
left join checkbook.org_agency_map m on m.agency_name = src.agency_name
order by mapped nulls last;
```

Name normalization (e.g. "Human Services Dept" → "Department of Human Services") would need to be in the join or in the map.

---

## Step 5 — Upsert key

- **temporary_id:** Present (HR col 1). Not unique in the file: same person can have multiple rows (e.g. RECORD_NBR 1 and 2 for 'Rydell,Susan T').
- **record_nbr:** Present (HR col 2). Differentiates multiple positions/records per person.

**Uniqueness check:** **(temporary_id, record_nbr)** is **unique** across all 76,218 HR rows (76,218 pairs, 76,218 distinct).

So:

- **Unique key for upsert within FY2025:** **(temporary_id, record_nbr)**.
- **Unique key for upsert across years:** **(temporary_id, record_nbr, fiscal_year)**.

No need to generate a synthetic key; **(temporary_id, record_nbr, fiscal_year)** is the natural composite key. If you implement upsert (e.g. ON CONFLICT), you would need a unique constraint or unique index on `(temporary_id, record_nbr, fiscal_year)` — currently the table has no such constraint (only `id` is primary key).

---

## Summary

| Step | Result |
|------|--------|
| 1 | File: `minnesota_gov/State Payrole/fiscal-year-2025.xlsx`, 17.17 MB, 76,218 rows (after join). Headers and first 3 rows documented. |
| 2 | Every source column maps to an existing schema column; types align; only dates need conversion to integer. No new columns; none dropped. |
| 3 | 0 nulls on employee_name, agency_name; 0 null total_wages in this file. 106 distinct agencies. |
| 4 | org_agency_map not in DB. Documented map: 20 agencies; all 20 appear in payroll (18 exact, 2 name variants). 86 payroll agencies are new (not in map). |
| 5 | (temporary_id, record_nbr) is unique in the file. Use (temporary_id, record_nbr, fiscal_year) as composite key for upsert; add unique constraint if using ON CONFLICT. |

**No import has been performed.** When you are ready to import, use this alignment to drive the FY2025 load and any upsert logic.
