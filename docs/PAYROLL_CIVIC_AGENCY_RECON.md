# Payroll × Civic Agency & Name Match Reconnaissance

**Purpose:** Diagnose civic agencies with people, payroll agency name overlap, and exact name-match hit rate. Read-only.

---

## Query 1 — Total agency count and top 20 by people

| civic_agency | gov_type | person_count |
|--------------|----------|--------------|
| Minnesota House of Representatives | chamber | 134 |
| Minnesota Senate | chamber | 67 |
| Minnesota Supreme Court | court | 7 |
| State Auditor of Minnesota | elected_office | 1 |
| Department of Corrections | department | 1 |
| Department of Revenue | department | 1 |
| Department of Labor and Industry | department | 1 |
| Secretary of State of Minnesota | elected_office | 1 |
| Attorney General of Minnesota | elected_office | 1 |
| Department of Veterans Affairs | department | 1 |
| Department of Administration | department | 1 |
| Department of Commerce | department | 1 |
| Department of Public Safety | department | 1 |
| Department of Employment and Economic Development | department | 1 |
| Department of Human Services | department | 1 |
| Minnesota Management and Budget | department | 1 |
| Minnesota State Colleges & Universities | department | 1 |
| Department of Transportation | department | 1 |
| Department of Direct Care and Treatment | department | 1 |
| Department of Health | department | 1 |

**Note:** 20 agencies shown; all others also have person_count = 1.

---

## Query 2 — Total distinct agencies with people

| agencies_with_people |
|----------------------|
| 29 |

So **29 civic agencies** have at least one person (role) attached. These are the only agencies in scope for payroll→civic matching.

---

## Query 3 — Payroll agency names matching key words (closest to civic scope)

| agency_name | payroll_rows |
|-------------|--------------|
| Administration Dept | 3,476 |
| Agriculture Dept | 3,609 |
| Animal Health Board | 277 |
| Attorney General | 1,226 |
| Attorney General's Office | 1,389 |
| Behavioral Health & Therapy Bd | 44 |
| Commerce Dept | 2,439 |
| Corrections Dept | 29,316 |
| Court of Appeals | 680 |
| Education Department | 2,923 |
| Governors Office | 473 |
| Health Department | 12,588 |
| Housing Finance Agency | 1,831 |
| Human Services Dept | 44,665 |
| Labor & Industry Dept | 3,260 |
| Military Affairs Dept | 3,117 |
| Natural Resources Dept | 20,497 |
| Office of Higher Education | 519 |
| Ombudsperson for Corrections | 25 |
| Perpich Ctr For Arts Education | 465 |
| Public Safety Dept | 13,536 |
| Revenue Dept | 9,419 |
| Senate | 1,416 |
| Supreme Court | 3,355 |
| Transportation Dept | 35,110 |
| Workers Comp Court of Appeals | 76 |

**26** distinct payroll agency names match the keyword filter. These are the payroll strings that need mapping to civic agency names (e.g. **Administration Dept** → **Department of Administration**, **Attorney General** / **Attorney General's Office** → **Attorney General of Minnesota**). No payroll names in this set for House (would need e.g. “House” or “Representatives”); **Senate** and **Supreme Court** appear.

---

## Query 4 — Civic people with parsed Last,First and agency (full list)

Parsing rule: `Last,First` = last word of `name` + comma + first word of `name` (so middle names/initials dropped in parsed form).

Sample (first 30 rows):

| civic_name | parsed_last_first | civic_agency |
|------------|-------------------|--------------|
| Keith Ellison | Ellison,Keith | Attorney General of Minnesota |
| Tamar Gronvall | Gronvall,Tamar | Department of Administration |
| Thom Petersen | Petersen,Thom | Department of Agriculture |
| Tikki Brown | Brown,Tikki | Department of Children, Youth and Families |
| Grace Arnold | Arnold,Grace | Department of Commerce |
| Paul Schnell | Schnell,Paul | Department of Corrections |
| Marshall E. Smith | Smith,Marshall | Department of Direct Care and Treatment |
| Willie Jett | Jett,Willie | Department of Education |
| Matt Varilek | Varilek,Matt | Department of Employment and Economic Development |
| Brooke Cunningham | Cunningham,Brooke | Department of Health |
| Rebecca Lucero | Lucero,Rebecca | Department of Human Rights |
| Shireen Gandhi | Gandhi,Shireen | Department of Human Services |
| Nicole Blissenbach | Blissenbach,Nicole | Department of Labor and Industry |
| Shawn P. Manke | Manke,Shawn | Department of Military Affairs |
| Sarah Strommen | Strommen,Sarah | Department of Natural Resources |
| Bob Jacobson | Jacobson,Bob | Department of Public Safety |
| Paul Marquart | Marquart,Paul | Department of Revenue |
| Nancy Daubenberger | Daubenberger,Nancy | Department of Transportation |
| Brad Lindsay | Lindsay,Brad | Department of Veterans Affairs |
| Tim Walz | Walz,Tim | Governor of Minnesota |
| Peggy Flanagan | Flanagan,Peggy | Lieutenant Governor of Minnesota |
| Tracy Smith | Smith,Tracy | Minnesota Court of Appeals |
| Aaron Repinski | Repinski,Aaron | Minnesota House of Representatives |
| ... | ... | ... |

**Parsing caveats:**
- **Scott Van Binsbergen** → `Binsbergen,Scott` (last word is “Binsbergen”; “Van” lost).
- **Mary Frances Clardy** → `Clardy,Mary` (middle name “Frances” dropped).
- **Kaohly Vang Her** → `Her,Kaohly` (last word “Her” is likely not surname).
- **D. Scott Dibble** → `Dibble,D.` (first word “D.” as “first name”).
- **Bobby Joe Champion** → `Champion,Bobby` (“Joe” dropped).

Full result set has one row per (person, agency) role; same person can appear under one agency only in this list.

---

## Query 5 — Exact payroll hit test (parsed Last,First vs payroll employee_name)

Same parsing as Query 4; for each civic person we count payroll rows where `pay.employee_name` equals the parsed `Last,First` string.

**Rows with exact_payroll_hits > 0 (only these match exactly):**

| civic_name | parsed_last_first | civic_agency | exact_payroll_hits |
|------------|-------------------|--------------|--------------------|
| Mark T. Johnson | Johnson,Mark | Minnesota Senate | 20 |
| Grace Arnold | Arnold,Grace | Department of Commerce | 6 |
| Sarah Strommen | Strommen,Sarah | Department of Natural Resources | 6 |
| Tom Murphy | Murphy,Tom | Minnesota House of Representatives | 6 |
| Rebecca Lucero | Lucero,Rebecca | Department of Human Rights | 6 |
| Brooke Cunningham | Cunningham,Brooke | Department of Health | 4 |
| Nathan Coulter | Coulter,Nathan | Minnesota House of Representatives | 3 |
| Paul Anderson | Anderson,Paul | Minnesota House of Representatives | 2 |
| Anquam Mahamoud | Mahamoud,Anquam | Minnesota House of Representatives | 1 |
| Nathan Nelson | Nelson,Nathan | Minnesota House of Representatives | 1 |

**All other civic people in the list have exact_payroll_hits = 0** under this exact-match test (same 29 agencies, full person list as in Query 4).

So with **“last word + comma + first word”** only:
- **10 people** get at least one exact payroll hit.
- **Mark T. Johnson** has 20 hits (common name; likely needs agency + other disambiguation).
- Most others fail because payroll uses **full first name + middle initial** (e.g. `Smith,Marshall E.` vs parsed `Smith,Marshall`), or different spelling/nickname (e.g. **Keith Ellison** → `Ellison,Keith` may exist as `Ellison,Keith M.` or similar in payroll).

---

## Summary for match logic

1. **Agencies in scope:** 29 civic agencies have people; payroll has 26+ distinct agency names that overlap by keywords. Need a **payroll agency_name → civic.agencies** mapping (and possibly multiple payroll names → one civic agency, e.g. Attorney General + Attorney General's Office).
2. **Exact name match is weak:** Only 10 civic people match payroll on parsed `Last,First` exactly. Match logic should add:
   - **Fuzzy / normalized name** (e.g. strip middle initial, nickname table, trim punctuation).
   - **Agency constraint:** require same (mapped) agency or at least compatible agency to reduce false positives (e.g. “Mark T. Johnson”).
3. **Parsing limits:** “Last = last word, First = first word” breaks compound last names (Van Binsbergen), multi-part first names (Mary Frances), and suffix-like last words (Her). Design match rules and display so these cases are handled or flagged.
4. **House:** No payroll agency in the keyword list for “House” or “Representatives”; if legislators are paid under a different payroll agency name, that string needs to be identified and added to the mapping.

Use this report to design payroll↔civic agency mapping and name-match logic; no DB changes were made.
