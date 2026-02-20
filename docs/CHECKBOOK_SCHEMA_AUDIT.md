# Checkbook Schema Audit — Full Report

**Purpose:** Table/column inventory, row counts, distinct agency/linking values, fiscal year coverage. Assess connection points to `civic.orgs`, `civic.people`, and `layers.*`.

---

## Step 1 — Full table and column inventory

| table_name      | column_name           | data_type             | is_nullable |
|-----------------|------------------------|------------------------|-------------|
| budgets         | id                     | uuid                   | NO          |
| budgets         | budget_period          | integer                | NO          |
| budgets         | agency                 | text                   | YES         |
| budgets         | fund                   | text                   | YES         |
| budgets         | program                | text                   | YES         |
| budgets         | activity               | text                   | YES         |
| budgets         | available_amount       | numeric                | NO          |
| budgets         | obligated_amount       | numeric                | NO          |
| budgets         | spend_amount           | numeric                | NO          |
| budgets         | remaining_amount       | numeric                | NO          |
| budgets         | budget_amount          | numeric                | NO          |
| budgets         | budget_remaining_amount| numeric                | NO          |
| budgets         | created_at             | timestamp with time zone | NO       |
| budgets         | updated_at             | timestamp with time zone | NO       |
| contracts       | id                     | uuid                   | NO          |
| contracts       | agency                 | text                   | YES         |
| contracts       | payee                  | text                   | NO          |
| contracts       | contract_type          | text                   | NO          |
| contracts       | contract_id            | text                   | NO          |
| contracts       | start_date             | date                   | NO          |
| contracts       | end_date               | date                   | YES         |
| contracts       | drill                  | text                   | NO          |
| contracts       | total_contract_amount  | numeric                | NO          |
| contracts       | created_at             | timestamp with time zone | NO       |
| contracts       | updated_at             | timestamp with time zone | NO       |
| org_agency_map  | org_slug               | text                   | NO          |
| org_agency_map  | agency_name            | text                   | NO          |
| payments        | id                     | uuid                   | NO          |
| payments        | budget_period          | integer                | NO          |
| payments        | payment_amount         | numeric                | NO          |
| payments        | agency                 | text                   | YES         |
| payments        | payee                  | text                   | YES         |
| payments        | created_at             | timestamp with time zone | NO       |
| payments        | updated_at             | timestamp with time zone | NO       |
| payroll         | id                     | uuid                   | NO          |
| payroll         | temporary_id           | text                   | NO          |
| payroll         | record_nbr             | integer                | YES         |
| payroll         | employee_name          | text                   | YES         |
| payroll         | agency_nbr             | text                   | YES         |
| payroll         | agency_name            | text                   | YES         |
| payroll         | department_nbr        | text                   | YES         |
| payroll         | department_name        | text                   | YES         |
| payroll         | branch_code            | text                   | YES         |
| payroll         | branch_name            | text                   | YES         |
| payroll         | job_code               | text                   | YES         |
| payroll         | job_title              | text                   | YES         |
| payroll         | location_nbr           | text                   | YES         |
| payroll         | location_name          | text                   | YES         |
| payroll         | location_county_name   | text                   | YES         |
| payroll         | reg_temp_code          | text                   | YES         |
| payroll         | reg_temp_desc          | text                   | YES         |
| payroll         | classified_code        | text                   | YES         |
| payroll         | classified_desc        | text                   | YES         |
| payroll         | original_hire_date     | integer                | YES         |
| payroll         | last_hire_date         | text                   | YES         |
| payroll         | job_entry_date         | integer                | YES         |
| payroll         | full_part_time_code    | text                   | YES         |
| payroll         | full_part_time_desc    | text                   | YES         |
| payroll         | active_on_june_30      | text                   | YES         |
| payroll         | salary_plan_grid       | text                   | YES         |
| payroll         | salary_grade_range     | integer                | YES         |
| payroll         | max_salary_step        | integer                | YES         |
| payroll         | compensation_rate      | numeric                | YES         |
| payroll         | comp_frequency_code    | text                   | YES         |
| payroll         | comp_frequency_desc    | text                   | YES         |
| payroll         | position_fte           | numeric                | YES         |
| payroll         | bargaining_unit_nbr    | integer                | YES         |
| payroll         | bargaining_unit_name   | text                   | YES         |
| payroll         | regular_wages          | numeric                | NO          |
| payroll         | overtime_wages         | numeric                | NO          |
| payroll         | other_wages            | numeric                | NO          |
| payroll         | total_wages            | numeric                | NO          |
| payroll         | created_at             | timestamp with time zone | NO       |
| payroll         | updated_at             | timestamp with time zone | NO       |
| payroll         | fiscal_year            | text                   | YES         |

---

## Step 2 — Row counts

| table_name      | count  |
|-----------------|--------|
| budgets         | 13,055 |
| contracts       | 43,325 |
| payments        | 0      |
| payroll         | 0      |
| org_agency_map  | 20     |

---

## Step 3 — Distinct values for key linking columns

### budgets — distinct agency, record count

| agency | records |
|--------|---------|
| Accountancy Board | 14 |
| Administration Dept | 530 |
| Administrative Hearings | 44 |
| Agriculture Dept | 377 |
| Agriculture Utilization Resrch | 10 |
| Amateur Sports Comm | 33 |
| Animal Health Board | 28 |
| Appellate Counsel & Trg Office | 6 |
| Architecture, Engineering Bd | 14 |
| Arts Board | 43 |
| Asian-Pacific Council | 32 |
| Attorney General | 153 |
| Barber Examiners Board | 14 |
| Behavioral Health & Therapy Bd | 21 |
| Board Of Public Defense | 43 |
| Board of Teaching | 33 |
| Bureau of Mediation Services | 21 |
| Campaign Fin & Public Discl Bd | 21 |
| Cannabis Expungement Board | 6 |
| Cannabis Management Office | 13 |
| Capitol Area Architect | 23 |
| Children Youth & Families Dept | 93 |
| Chiropractors Board | 21 |
| Clemency Review Commission | 4 |
| Climate Innovn Finance Authrty | 9 |
| Combative Sports Commission | 7 |
| Commerce Dept | 205 |
| Corrections Dept | 891 |
| Cosmetologist Exam Board | 14 |
| Council for MN of African Heri | 28 |
| Court Of Appeals | 14 |
| Dentistry Board | 33 |
| Department of Human Services | 1146 |
| Dietetics & Nutrition Practice | 21 |
| Direct Care and Treatment | 19 |
| Disability Council | 33 |
| Education Department | 714 |
| Emergency Medical Services Bd | 40 |
| Employ & Econ Development Dept | 558 |
| Exec for LT Svcs & Supports Bd | 28 |
| Explore Minnesota Tourism | 26 |
| Foster Youth Ombudsperson | 8 |
| Gambling Control Board | 14 |
| Governors Office | 34 |
| Guardian ad Litem Board | 29 |
| Health Department | 502 |
| Higher Ed Facilities Authority | 14 |
| Historical Society | 27 |
| House of Representatives | 29 |
| Housing Finance Agency | 137 |
| Human Rights Dept | 36 |
| Humanities Center | 17 |
| Indian Affairs Council | 41 |
| Investment Board | 36 |
| Iron Range Resources & Rehab | 123 |
| Judicial Standards Board | 14 |
| Labor & Industry Dept | 152 |
| LCC-Leg Coordinating Comm | 74 |
| Legislative Auditor | 19 |
| LGBTQIA2S+ Minnesotans Council | 6 |
| Lottery | 14 |
| Marriage & Family Therapy | 21 |
| Medical Practice Board | 25 |
| Metropolitan Council | 77 |
| Military Affairs Dept | 103 |
| Minn Conservation Corps | 73 |
| Minnesota Zoological Garden | 66 |
| Mmb Debt Service | 159 |
| Mmb Non-operating | 387 |
| MN Council on Latino Affairs | 24 |
| Mn Management & Budget | 162 |
| MN Secure Choice Retirement Bd | 5 |
| MN St Colleges & Universities | 86 |
| Mn State Academies | 126 |
| MN State Retirement System | 73 |
| MN.IT Services | 49 |
| MNsure | 31 |
| Natural Resources Dept | 1119 |
| Nursing Board | 21 |
| Occupational Therapy Pract Bd | 21 |
| Office of Emergency Med Svc | 12 |
| Office of Higher Education | 207 |
| Ombud American Indian Families | 18 |
| Ombud Mental Hlth & Dev Dis | 15 |
| Ombuds Family Child Care | 1 |
| Ombudsperson for Corrections | 10 |
| Ombudsperson for Families | 21 |
| Optometry Board | 21 |
| Peace Officer Board (POST) | 15 |
| Perpich Ctr For Arts Education | 69 |
| Pharmacy Board | 51 |
| Physical Therapy Board | 21 |
| Podiatric Medicine Board | 21 |
| Pollution Control Agency | 402 |
| Private Detective Board | 14 |
| Psychology Board | 24 |
| Public Employees Retire Assoc | 51 |
| Public Facilities Authority | 50 |
| Public Safety Dept | 680 |
| Public Utilities Comm | 22 |
| Racing Commission | 16 |
| Rare Disease Advisory Council | 8 |
| Revenue Dept | 93 |
| Revenue Intergovt Payments | 367 |
| Science Museum | 14 |
| Secretary of State | 34 |
| Senate | 28 |
| Sentencing Guidelines Comm | 14 |
| Social Work Board | 21 |
| State Auditor | 70 |
| State Board of Civil Legal Aid | 4 |
| State Competency Attainment Bd | 7 |
| Supreme Court | 143 |
| Tax Court | 14 |
| Teachers Retirement Assoc | 14 |
| Transportation Dept | 464 |
| Trial Courts | 53 |
| Uniform Laws Commission | 14 |
| University Of Minnesota | 104 |
| Veterans Affairs Dept | 289 |
| Veterinary Medicine Board | 21 |
| Water & Soil Resources Board | 187 |
| Workers Comp Court of Appeals | 14 |

### contracts — sample agency, payee (20 rows)

| agency | payee |
|--------|--------|
| Human Services Department | VOLUNTEER SERVICES OF |
| Direct Care and Treatment | ANNANDALE CLINIC PARTNERS LLC |
| Education Department | MINNESOTA OFFICE OF CHARTER AUTHORIZING |
| Admin/State Procurement | AEON NEXUS CORP |
| Human Services Department | METROPOLITAN CENTER FOR |
| Health Department | MINNESOTA MIND-BODY MEDICINE PLLC |
| Health Department | FREEBORN COUNTY |
| MN.IT | INTEGRATION ARCHITECTS INC |
| Public Safety Department | KITTSON COUNTY T |
| Office of Higher Education | ISD 0150 |
| Natural Resources Department | LAKE BYLLESBY IMPROVEMENT ASSOCIATION |
| MN.IT | AZUL ARC |
| Health Department | FUSSELL EMILY CRISTEN |
| Employment & Economic Develop | PARENTS IN COMM ACTION INC |
| Transportation Department | DARTS VMS |
| Housing Finance Agency | BENEVATE LLC |
| Not Available | ST ANTHONY CITY OF |
| Children Youth & Families Dept | SIBLEY COUNTY |
| Health Department | SOUTHWEST MINN EMERGENCY MED |
| Public Safety Department | INST POLICE TECH & MGMT |

### payments — distinct agency

(Empty — 0 rows.)

### payroll — distinct agency_name, branch_name, branch_code

(Empty — 0 rows.)

### org_agency_map — full contents (connection to civic.orgs)

| org_slug | agency_name |
|----------|-------------|
| dept-administration | Administration Dept |
| dept-agriculture | Agriculture Dept |
| dept-children-youth-families | Children Youth & Families Dept |
| dept-commerce | Commerce Dept |
| dept-corrections | Corrections Dept |
| dept-direct-care-treatment | Direct Care and Treatment |
| dept-education | Education Department |
| dept-employment-economic-dev | Employ & Econ Development Dept |
| dept-health | Health Department |
| dept-human-rights | Human Rights Dept |
| dept-human-services | Department of Human Services |
| dept-labor-industry | Labor & Industry Dept |
| dept-management-budget | Mn Management & Budget |
| dept-military-affairs | Military Affairs Dept |
| dept-natural-resources | Natural Resources Dept |
| dept-public-safety | Public Safety Dept |
| dept-revenue | Revenue Dept |
| dept-transportation | Transportation Dept |
| dept-veterans-affairs | Veterans Affairs Dept |
| mn-state-colleges-universities | MN St Colleges & Universities |

---

## Step 4 — Fiscal year coverage per table

### budgets

| source  | fiscal_year | count |
|---------|-------------|-------|
| budgets | 2020        | 1,860 |
| budgets | 2021        | 1,884 |
| budgets | 2022        | 1,828 |
| budgets | 2023        | 1,862 |
| budgets | 2024        | 1,877 |
| budgets | 2025        | 1,909 |
| budgets | 2026        | 1,835 |

### contracts (by start_date year)

| source   | fiscal_year | count |
|----------|-------------|-------|
| contracts | 1978 | 1 |
| contracts | 1990 | 1 |
| contracts | 1993 | 1 |
| contracts | 1998 | 1 |
| contracts | 1999 | 1 |
| contracts | 2000 | 7 |
| contracts | 2001 | 2 |
| contracts | 2002 | 4 |
| contracts | 2003 | 10 |
| contracts | 2004 | 6 |
| contracts | 2005 | 19 |
| contracts | 2006 | 32 |
| contracts | 2007 | 26 |
| contracts | 2008 | 69 |
| contracts | 2009 | 109 |
| contracts | 2010 | 278 |
| contracts | 2011 | 167 |
| contracts | 2012 | 289 |
| contracts | 2013 | 285 |
| contracts | 2014 | 315 |
| contracts | 2015 | 359 |
| contracts | 2016 | 372 |
| contracts | 2017 | 457 |
| contracts | 2018 | 438 |
| contracts | 2019 | 515 |
| contracts | 2020 | 1,063 |
| contracts | 2021 | 2,432 |
| contracts | 2022 | 3,829 |
| contracts | 2023 | 5,263 |
| contracts | 2024 | 11,219 |
| contracts | 2025 | 15,362 |
| contracts | 2026 | 393 |

### payments

(No rows — no fiscal coverage.)

### payroll

(No rows — no fiscal coverage.)

---

## Connection points (civic.orgs, civic.people, layers.*)

- **civic.orgs:** Join key is agency name. `checkbook.org_agency_map` maps `agency_name` → `org_slug` (20 depts). Budgets and contracts use free-text `agency`; names differ from `org_agency_map` (e.g. "Human Services Department" vs "Department of Human Services", "Employ & Econ Development Dept" vs "Employ & Econ Development Dept" in map). Use `org_agency_map` to resolve checkbook `agency` → `org_slug` for linking to civic orgs; expand map for agencies not yet mapped.
- **civic.people:** No direct link today. Payroll has `employee_name` (and job/agency) but table is empty. Contracts `payee` can be people or orgs; would need classification/normalization to tie to people.
- **layers.*:** Link by geography only if layers have agency/jurisdiction attributes. Payroll has `location_county_name` (future use when payroll is loaded). Contracts/payments have no geographic columns; linking would require payee or agency → address or jurisdiction in another source.

**Schema note:** Contracts use `agency` and `payee`; budgets use `agency`. Payments/payroll columns exist but currently have 0 rows.
