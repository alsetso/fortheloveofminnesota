# Payroll × Civic Reconnaissance Report

**Purpose:** Diagnostic queries on `checkbook.payroll` and `civic.people` / `civic.agencies` to inform match logic design. No database changes — read-only.

---

## Query 1 — Row count and fiscal year range

| fiscal_year | rows   |
|-------------|--------|
| 2020        | 73,348 |
| 2021        | 72,840 |
| 2022        | 74,649 |
| 2023        | 74,813 |
| 2024        | 75,137 |
| 2025        | 76,218 |

**Total rows:** 447,005  
**Fiscal years:** 2020–2025 (six years).

---

## Query 2 — Sample 50 random `employee_name` values

| employee_name |
|---------------|
| Bergstrom,Robert K |
| Martire,Alexis Charlene |
| Belille,Rosann M |
| Connell,Ashley Kay |
| Hintz,Jennifer R |
| Pearo,Jessica |
| Brown,Heather |
| Gaulrapp,Madison Ashley |
| Rundquist,Jordan |
| Sheridan-Giese,John Anthony |
| King,Jack Robert |
| Johnson,Gregory Robert |
| Ballard,Janine Jenna |
| Lee,Jennifer |
| Peltzer,Nicole |
| Rugroden,David |
| Miller,Joseph Lyle |
| Bailey,Ramona M |
| Bauer,Kaylee Ann Sharp |
| Yang,Fue |
| Wilmer,Hailey Rebecca |
| Crabtree,Cicely |
| Johnson,Alicia A |
| Eide,Ruth Ann |
| Walter,Dennis E |
| Gamst,Chrissy K |
| Johnson,Jacquelyn L |
| Benjamin Lewis,Yolanda Garcia |
| Cavanaugh,Christine Joy Noelle |
| Levercom,Jamie M |
| Paulson,Anne M |
| Strasser,Cory W |
| MacDonald,Ann |
| Yang,Kerlien |
| Gaylord,Simon J |
| Sweazey,Taylor Hannah Marie |
| Johnston,Troy D |
| Stimmler,Paul A |
| Mueller,Brandon Walter |
| Bleichner,Susan G |
| Longanecker,Scott M |
| Facciotto,Anthony Michael |
| Mathias,Bridgette M |
| Sorensen,James M. |
| Donoho,Dale A |
| Case,Shaun Michel |
| Beck,David Michael |
| Coleman,Janel Christa |
| Schramm,Perry George |
| Doume,Aicha K |

**Finding:** Payroll names are almost always **`Last,First`** with **no space after the comma** (e.g. `Bergstrom,Robert K`). One sample has a compound last name and two parts after the comma: `Benjamin Lewis,Yolanda Garcia`.

---

## Query 3 — Name format patterns

Original pattern counts (as run):

| Pattern | Count | Note |
|---------|-------|------|
| all_caps | 152 | `employee_name = upper(employee_name)` |
| last_first_comma | 0 | Pattern was `'%, %'` (comma + space) — payroll uses comma **no** space |
| business_names | 13 | Contains Inc/LLC/Corp |
| has_dr_prefix | 0 | Dr. or Dr prefix |
| initial_first | 0 | Starts with "A. " etc. |
| middle_initial | 41 | Space + single letter + period somewhere |
| has_suffix | 2,661 | Jr/Sr/III etc. |

**Follow-up check (comma usage):**

| Pattern | Count |
|---------|--------|
| has_comma (any) | 447,004 |
| comma_space | 0 |
| total rows | 447,005 |

So **effectively every row** uses a comma in the name (one row has no comma). Format is **`Last,First`** with no space after the comma. Middle initials and suffixes are present; business names and all-caps are rare.

---

## Query 4 — Sample `agency_name` values (first 60 by name)

| agency_name |
|-------------|
| Accountancy Board |
| Administration Dept |
| Administrative Hearings |
| African Heritage Council |
| Agriculture Dept |
| Amateur Sports Comm |
| Animal Health Board |
| Architecture, Engineering Bd |
| Arts Board |
| Asian-Pacific Council |
| Attorney General |
| Attorney General's Office |
| Barber Examiners Board |
| Behavioral Health & Therapy Bd |
| Bureau of Mediation Services |
| Campaign Fin & Public Discl Bd |
| Cannabis Expungement Board |
| Cannabis Management Office |
| Capitol Area Architect |
| Children Youth & Families Dept |
| Chiropractors Board |
| Climate Innovn Finance Authrty |
| Commerce Dept |
| Corrections Dept |
| Cosmetologist Exam Board |
| Court of Appeals |
| Dentistry Board |
| Dietetics & Nutrition Practice |
| Direct Care and Treatment Dept |
| Disability Council |
| Economic Security Dept |
| Education Department |
| Emergency Medical Services Bd |
| Emergency Medical Srvcs Office |
| Employ & Econ Development Dept |
| Exec for LT Svcs & Supports Bd |
| Explore Minnesota |
| Explore Minnesota Tourism |
| Foster Youth Ombudsperson |
| Gambling Control Board |
| Governors Office |
| Guardian ad Litem Board |
| Health Department |
| Higher Ed Facilities Authority |
| Housing Finance Agency |
| Human Rights Dept |
| Human Services Dept |
| Indian Affairs Council |
| Investment Board |
| Iron Range Resources & Rehab |
| Judicial Standards Board |
| Labor & Industry Dept |
| Latino Affairs Council |
| Legislative Auditor |
| Legislative Coordinating Comm |
| LGBTQIA2S+ Minnesotans Council |
| Lottery |
| Marriage & Family Therapy |
| Medical Practice Board |
| Military Affairs Dept |

**Findings:** Abbreviations (Dept, Bd, Comm, Srvcs, Authrty, Innovn), “Attorney General” vs “Attorney General's Office”, “Explore Minnesota” vs “Explore Minnesota Tourism”, “Direct Care and Treatment Dept” vs civic “Department of Direct Care and Treatment” — so **agency name normalization / mapping will be required** for matching to `civic.agencies`.

---

## Query 5 — Sample `civic.people` names and agencies (30 rows)

| name | agency_name |
|------|-------------|
| Mary Frances Clardy | Minnesota House of Representatives |
| Brion Curran | Minnesota House of Representatives |
| Xp Lee | Minnesota House of Representatives |
| Kristi Pursell | Minnesota House of Representatives |
| Steven Jacob | Minnesota House of Representatives |
| Marshall E. Smith | Department of Direct Care and Treatment |
| Bill Lieske | Minnesota Senate |
| Sarah Hennesy | Minnesota Supreme Court |
| Margaret Chutich | Minnesota Supreme Court |
| Julia E. Coleman | Minnesota Senate |
| Nathan Nelson | Minnesota House of Representatives |
| Nicole Blissenbach | Department of Labor and Industry |
| Ginny Klevorn | Minnesota House of Representatives |
| Max Rymer | Minnesota House of Representatives |
| John Marty | Minnesota Senate |
| Pam Altendorf | Minnesota House of Representatives |
| Leon Lillie | Minnesota House of Representatives |
| Kari Rehrauer | Minnesota House of Representatives |
| Jimmy Gordon | Minnesota House of Representatives |
| Tina Liebling | Minnesota House of Representatives |
| Rebecca Lucero | Department of Human Rights |
| Jim Carlson | Minnesota Senate |
| Paul Anderson | Minnesota House of Representatives |
| Keith Ellison | Attorney General of Minnesota |
| Andrew R. Lang | Minnesota Senate |
| Mary K. Kunesh | Minnesota Senate |
| Lucy Rehm | Minnesota House of Representatives |
| Anne McKeig | Minnesota Supreme Court |
| Samantha Vang | Minnesota House of Representatives |
| Patti Anderson | Minnesota House of Representatives |

**Findings:** Civic names are **`First Last`** (e.g. “Mary Frances Clardy”, “Marshall E. Smith”). Agency names are long-form (e.g. “Department of Direct Care and Treatment”, “Attorney General of Minnesota”, “Minnesota House of Representatives”) and do not match payroll’s shortened forms (e.g. “Direct Care and Treatment Dept”, “Attorney General” / “Attorney General's Office”) without a mapping layer.

---

## Summary for match logic design

1. **Payroll `employee_name`:** Consistently **`Last,First`** with **no space after the comma**. Parse by splitting on first comma; handle compound last names (e.g. “Benjamin Lewis,Yolanda Garcia”) and suffixes (Jr/Sr/III — 2,661 rows).
2. **Civic `people.name`:** **`First Last`** (and optional middle). Normalize for comparison (e.g. “Last, First” from payroll → “First Last” to compare to civic).
3. **Agency matching:** Payroll uses short/abbreviated names; civic uses full names. Need a **normalization or mapping table** (e.g. “Direct Care and Treatment Dept” → “Department of Direct Care and Treatment”; “Attorney General” / “Attorney General's Office” → “Attorney General of Minnesota”).
4. **Edge cases to handle:** ~13 business names (Inc/LLC/Corp), 152 all-caps, middle initials, and one row with no comma in `employee_name`.

Use this report to design name and agency match logic before writing any matching code.
