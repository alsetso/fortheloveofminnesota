# Checkbook — Budget agency totals and civic.orgs mapping (raw output)

Two-query audit: distinct budget agencies with totals and year coverage; which are already mapped in `checkbook.org_agency_map` (→ civic.orgs).

---

## Step 1 — Every distinct budget agency with totals and year coverage

| agency | years_present | first_year | last_year | total_all_years |
|--------|---------------|------------|-----------|-----------------|
| Department of Human Services | 7 | 2020 | 2026 | 171551554302.74 |
| Education Department | 7 | 2020 | 2026 | 87725736327.99 |
| Transportation Dept | 7 | 2020 | 2026 | 33021006497.61 |
| Public Employees Retire Assoc | 7 | 2020 | 2026 | 18420672823.11 |
| Revenue Intergovt Payments | 7 | 2020 | 2026 | 17529788129.09 |
| MN St Colleges & Universities | 7 | 2020 | 2026 | 14482348201.86 |
| Teachers Retirement Assoc | 7 | 2020 | 2026 | 14376146975.22 |
| Mn Management & Budget | 7 | 2020 | 2026 | 11193306023.02 |
| Mmb Debt Service | 7 | 2020 | 2026 | 9802836663.12 |
| Employ & Econ Development Dept | 7 | 2020 | 2026 | 9318864151.75 |
| MN State Retirement System | 7 | 2020 | 2026 | 8741541600.72 |
| Health Department | 7 | 2020 | 2026 | 7408238427.80 |
| Natural Resources Dept | 7 | 2020 | 2026 | 6893450914.20 |
| Public Safety Dept | 7 | 2020 | 2026 | 6436499759.30 |
| Corrections Dept | 7 | 2020 | 2026 | 5740704599.90 |
| University Of Minnesota | 7 | 2020 | 2026 | 5667259641.30 |
| MN.IT Services | 7 | 2020 | 2026 | 5126461004.66 |
| Housing Finance Agency | 7 | 2020 | 2026 | 4950059631.53 |
| Public Facilities Authority | 7 | 2020 | 2026 | 4203791505.07 |
| Metropolitan Council | 7 | 2020 | 2026 | 3843042959.89 |
| Commerce Dept | 7 | 2020 | 2026 | 3823481130.38 |
| Pollution Control Agency | 7 | 2020 | 2026 | 3758793568.58 |
| Children Youth & Families Dept | 3 | 2024 | 2026 | 3352447803.22 |
| Administration Dept | 7 | 2020 | 2026 | 3044369136.21 |
| Office of Higher Education | 7 | 2020 | 2026 | 2904383518.12 |
| Trial Courts | 7 | 2020 | 2026 | 2596294488.12 |
| Veterans Affairs Dept | 7 | 2020 | 2026 | 1443802926.41 |
| Revenue Dept | 7 | 2020 | 2026 | 1380184645.81 |
| Agriculture Dept | 7 | 2020 | 2026 | 1285028355.21 |
| Water & Soil Resources Board | 7 | 2020 | 2026 | 1104218161.99 |
| Mmb Non-operating | 7 | 2020 | 2026 | 1040670708.34 |
| Military Affairs Dept | 7 | 2020 | 2026 | 1015538645.27 |
| Board Of Public Defense | 7 | 2020 | 2026 | 912667453.55 |
| Labor & Industry Dept | 7 | 2020 | 2026 | 878271384.47 |
| Iron Range Resources & Rehab | 7 | 2020 | 2026 | 853996758.20 |
| Direct Care and Treatment | 2 | 2025 | 2026 | 808384107.09 |
| Supreme Court | 7 | 2020 | 2026 | 587441290.10 |
| Attorney General | 7 | 2020 | 2026 | 387223362.05 |
| Arts Board | 7 | 2020 | 2026 | 333803656.84 |
| Minnesota Zoological Garden | 7 | 2020 | 2026 | 332682498.26 |
| Historical Society | 7 | 2020 | 2026 | 322219036.37 |
| House of Representatives | 7 | 2020 | 2026 | 315541845.94 |
| MNsure | 7 | 2020 | 2026 | 287853137.53 |
| Senate | 7 | 2020 | 2026 | 278018530.09 |
| LCC-Leg Coordinating Comm | 7 | 2020 | 2026 | 172402252.29 |
| Explore Minnesota Tourism | 7 | 2020 | 2026 | 168682292.21 |
| Secretary of State | 7 | 2020 | 2026 | 165139756.16 |
| Guardian ad Litem Board | 7 | 2020 | 2026 | 163459329.84 |
| Mn State Academies | 7 | 2020 | 2026 | 142817105.81 |
| Lottery | 7 | 2020 | 2026 | 115855504.60 |
| Court Of Appeals | 7 | 2020 | 2026 | 98515373.14 |
| Investment Board | 7 | 2020 | 2026 | 88199842.79 |
| Administrative Hearings | 7 | 2020 | 2026 | 88056328.58 |
| Peace Officer Board (POST) | 7 | 2020 | 2026 | 82088987.58 |
| Public Utilities Comm | 7 | 2020 | 2026 | 81620489.14 |
| State Auditor | 7 | 2020 | 2026 | 79902563.74 |
| Cannabis Management Office | 3 | 2024 | 2026 | 79832651.60 |
| Legislative Auditor | 7 | 2020 | 2026 | 68697903.24 |
| Governors Office | 7 | 2020 | 2026 | 60243382.26 |
| Humanities Center | 7 | 2020 | 2026 | 59164000.00 |
| Perpich Ctr For Arts Education | 7 | 2020 | 2026 | 57749437.27 |
| Board of Teaching | 7 | 2020 | 2026 | 54029239.89 |
| Animal Health Board | 7 | 2020 | 2026 | 50723124.77 |
| Human Rights Dept | 7 | 2020 | 2026 | 47776809.20 |
| Climate Innovn Finance Authrty | 3 | 2024 | 2026 | 45677802.56 |
| Pharmacy Board | 7 | 2020 | 2026 | 44459492.76 |
| State Board of Civil Legal Aid | 2 | 2025 | 2026 | 42528000.00 |
| Office of Emergency Med Svc | 2 | 2025 | 2026 | 42301853.78 |
| Nursing Board | 7 | 2020 | 2026 | 39318557.61 |
| Medical Practice Board | 7 | 2020 | 2026 | 39183952.06 |
| Racing Commission | 7 | 2020 | 2026 | 38375399.74 |
| Gambling Control Board | 7 | 2020 | 2026 | 34145522.03 |
| Agriculture Utilization Resrch | 7 | 2020 | 2026 | 31671000.00 |
| Amateur Sports Comm | 7 | 2020 | 2026 | 29624457.30 |
| Emergency Medical Services Bd | 7 | 2020 | 2026 | 28764929.17 |
| Science Museum | 7 | 2020 | 2026 | 22229119.00 |
| Cosmetologist Exam Board | 7 | 2020 | 2026 | 21847419.04 |
| Ombud Mental Hlth & Dev Dis | 7 | 2020 | 2026 | 20545667.35 |
| Dentistry Board | 7 | 2020 | 2026 | 20161203.27 |
| Indian Affairs Council | 7 | 2020 | 2026 | 19291651.53 |
| Bureau of Mediation Services | 7 | 2020 | 2026 | 18801019.67 |
| Campaign Fin & Public Discl Bd | 7 | 2020 | 2026 | 18320552.90 |
| Workers Comp Court of Appeals | 7 | 2020 | 2026 | 16720474.71 |
| State Competency Attainment Bd | 4 | 2023 | 2026 | 16432055.47 |
| Tax Court | 7 | 2020 | 2026 | 13518007.28 |
| Social Work Board | 7 | 2020 | 2026 | 11938614.86 |
| Disability Council | 7 | 2020 | 2026 | 11711228.44 |
| Psychology Board | 7 | 2020 | 2026 | 11534471.10 |
| Cannabis Expungement Board | 3 | 2024 | 2026 | 9890000.00 |
| Exec for LT Svcs & Supports Bd | 7 | 2020 | 2026 | 9573036.41 |
| Sentencing Guidelines Comm | 7 | 2020 | 2026 | 7202678.48 |
| Minn Conservation Corps | 7 | 2020 | 2026 | 6992272.75 |
| Behavioral Health & Therapy Bd | 7 | 2020 | 2026 | 6363498.02 |
| Architecture, Engineering Bd | 7 | 2020 | 2026 | 5437386.01 |
| MN Secure Choice Retirement Bd | 3 | 2024 | 2026 | 5419518.78 |
| Accountancy Board | 7 | 2020 | 2026 | 5081724.26 |
| Chiropractors Board | 7 | 2020 | 2026 | 4934927.70 |
| Ombudsperson for Families | 7 | 2020 | 2026 | 4929250.49 |
| Capitol Area Architect | 7 | 2020 | 2026 | 4642762.39 |
| Ombudsperson for Corrections | 5 | 2022 | 2026 | 4596608.50 |
| Council for MN of African Heri | 7 | 2020 | 2026 | 4488462.60 |
| Physical Therapy Board | 7 | 2020 | 2026 | 4061608.88 |
| Asian-Pacific Council | 7 | 2020 | 2026 | 4026230.93 |
| Judicial Standards Board | 7 | 2020 | 2026 | 3982127.66 |
| MN Council on Latino Affairs | 7 | 2020 | 2026 | 3960310.90 |
| Occupational Therapy Pract Bd | 7 | 2020 | 2026 | 3181387.62 |
| Private Detective Board | 7 | 2020 | 2026 | 3158621.21 |
| Marriage & Family Therapy | 7 | 2020 | 2026 | 2885351.93 |
| Clemency Review Commission | 2 | 2025 | 2026 | 2676265.57 |
| Barber Examiners Board | 7 | 2020 | 2026 | 2628182.45 |
| Veterinary Medicine Board | 7 | 2020 | 2026 | 2597999.73 |
| Foster Youth Ombudsperson | 4 | 2023 | 2026 | 2323337.65 |
| Higher Ed Facilities Authority | 7 | 2020 | 2026 | 2183132.52 |
| Rare Disease Advisory Council | 4 | 2023 | 2026 | 1963328.34 |
| Optometry Board | 7 | 2020 | 2026 | 1643661.66 |
| LGBTQIA2S+ Minnesotans Council | 3 | 2024 | 2026 | 1591245.92 |
| Ombud American Indian Families | 5 | 2022 | 2026 | 1554266.10 |
| Podiatric Medicine Board | 7 | 2020 | 2026 | 1316997.72 |
| Dietetics & Nutrition Practice | 7 | 2020 | 2026 | 1316216.01 |
| Uniform Laws Commission | 7 | 2020 | 2026 | 634526.66 |
| Appellate Counsel & Trg Office | 3 | 2024 | 2026 | 0.00 |
| Combative Sports Commission | 7 | 2020 | 2026 | 0.00 |
| Ombuds Family Child Care | 1 | 2026 | 2026 | 0.00 |

---

## Step 2 — Which agencies are already mapped vs unmapped

| agency | total_budget | already_mapped |
|--------|--------------|-----------------|
| Department of Human Services | 171551554302.74 | dept-human-services |
| Education Department | 87725736327.99 | dept-education |
| Transportation Dept | 33021006497.61 | dept-transportation |
| Public Employees Retire Assoc | 18420672823.11 | |
| Revenue Intergovt Payments | 17529788129.09 | |
| MN St Colleges & Universities | 14482348201.86 | mn-state-colleges-universities |
| Teachers Retirement Assoc | 14376146975.22 | |
| Mn Management & Budget | 11193306023.02 | dept-management-budget |
| Mmb Debt Service | 9802836663.12 | |
| Employ & Econ Development Dept | 9318864151.75 | dept-employment-economic-dev |
| MN State Retirement System | 8741541600.72 | |
| Health Department | 7408238427.80 | dept-health |
| Natural Resources Dept | 6893450914.20 | dept-natural-resources |
| Public Safety Dept | 6436499759.30 | dept-public-safety |
| Corrections Dept | 5740704599.90 | dept-corrections |
| University Of Minnesota | 5667259641.30 | |
| MN.IT Services | 5126461004.66 | |
| Housing Finance Agency | 4950059631.53 | |
| Public Facilities Authority | 4203791505.07 | |
| Metropolitan Council | 3843042959.89 | |
| Commerce Dept | 3823481130.38 | dept-commerce |
| Pollution Control Agency | 3758793568.58 | |
| Children Youth & Families Dept | 3352447803.22 | dept-children-youth-families |
| Administration Dept | 3044369136.21 | dept-administration |
| Office of Higher Education | 2904383518.12 | |
| Trial Courts | 2596294488.12 | |
| Veterans Affairs Dept | 1443802926.41 | dept-veterans-affairs |
| Revenue Dept | 1380184645.81 | dept-revenue |
| Agriculture Dept | 1285028355.21 | dept-agriculture |
| Water & Soil Resources Board | 1104218161.99 | |
| Mmb Non-operating | 1040670708.34 | |
| Military Affairs Dept | 1015538645.27 | dept-military-affairs |
| Board Of Public Defense | 912667453.55 | |
| Labor & Industry Dept | 878271384.47 | dept-labor-industry |
| Iron Range Resources & Rehab | 853996758.20 | |
| Direct Care and Treatment | 808384107.09 | dept-direct-care-treatment |
| Supreme Court | 587441290.10 | |
| Attorney General | 387223362.05 | |
| Arts Board | 333803656.84 | |
| Minnesota Zoological Garden | 332682498.26 | |
| Historical Society | 322219036.37 | |
| House of Representatives | 315541845.94 | |
| MNsure | 287853137.53 | |
| Senate | 278018530.09 | |
| LCC-Leg Coordinating Comm | 172402252.29 | |
| Explore Minnesota Tourism | 168682292.21 | |
| Secretary of State | 165139756.16 | |
| Guardian ad Litem Board | 163459329.84 | |
| Mn State Academies | 142817105.81 | |
| Lottery | 115855504.60 | |
| Court Of Appeals | 98515373.14 | |
| Investment Board | 88199842.79 | |
| Administrative Hearings | 88056328.58 | |
| Peace Officer Board (POST) | 82088987.58 | |
| Public Utilities Comm | 81620489.14 | |
| State Auditor | 79902563.74 | |
| Cannabis Management Office | 79832651.60 | |
| Legislative Auditor | 68697903.24 | |
| Governors Office | 60243382.26 | |
| Humanities Center | 59164000.00 | |
| Perpich Ctr For Arts Education | 57749437.27 | |
| Board of Teaching | 54029239.89 | |
| Animal Health Board | 50723124.77 | |
| Human Rights Dept | 47776809.20 | dept-human-rights |
| Climate Innovn Finance Authrty | 45677802.56 | |
| State Board of Civil Legal Aid | 42528000.00 | |
| Office of Emergency Med Svc | 42301853.78 | |
| Nursing Board | 39318557.61 | |
| Medical Practice Board | 39183952.06 | |
| Racing Commission | 38375399.74 | |
| Gambling Control Board | 34145522.03 | |
| Agriculture Utilization Resrch | 31671000.00 | |
| Amateur Sports Comm | 29624457.30 | |
| Emergency Medical Services Bd | 28764929.17 | |
| Science Museum | 22229119.00 | |
| Cosmetologist Exam Board | 21847419.04 | |
| Ombud Mental Hlth & Dev Dis | 20545667.35 | |
| Dentistry Board | 20161203.27 | |
| Indian Affairs Council | 19291651.53 | |
| Bureau of Mediation Services | 18801019.67 | |
| Campaign Fin & Public Discl Bd | 18320552.90 | |
| Workers Comp Court of Appeals | 16720474.71 | |
| State Competency Attainment Bd | 16432055.47 | |
| Tax Court | 13518007.28 | |
| Social Work Board | 11938614.86 | |
| Disability Council | 11711228.44 | |
| Psychology Board | 11534471.10 | |
| Cannabis Expungement Board | 9890000.00 | |
| Exec for LT Svcs & Supports Bd | 9573036.41 | |
| Sentencing Guidelines Comm | 7202678.48 | |
| Minn Conservation Corps | 6992272.75 | |
| Behavioral Health & Therapy Bd | 6363498.02 | |
| Architecture, Engineering Bd | 5437386.01 | |
| MN Secure Choice Retirement Bd | 5419518.78 | |
| Accountancy Board | 5081724.26 | |
| Chiropractors Board | 4934927.70 | |
| Ombudsperson for Families | 4929250.49 | |
| Capitol Area Architect | 4642762.39 | |
| Ombudsperson for Corrections | 4596608.50 | |
| Council for MN of African Heri | 4488462.60 | |
| Physical Therapy Board | 4061608.88 | |
| Asian-Pacific Council | 4026230.93 | |
| Judicial Standards Board | 3982127.66 | |
| MN Council on Latino Affairs | 3960310.90 | |
| Occupational Therapy Pract Bd | 3181387.62 | |
| Private Detective Board | 3158621.21 | |
| Marriage & Family Therapy | 2885351.93 | |
| Clemency Review Commission | 2676265.57 | |
| Barber Examiners Board | 2628182.45 | |
| Veterinary Medicine Board | 2597999.73 | |
| Foster Youth Ombudsperson | 2323337.65 | |
| Higher Ed Facilities Authority | 2183132.52 | |
| Rare Disease Advisory Council | 1963328.34 | |
| Optometry Board | 1643661.66 | |
| LGBTQIA2S+ Minnesotans Council | 1591245.92 | |
| Ombud American Indian Families | 1554266.10 | |
| Podiatric Medicine Board | 1316997.72 | |
| Dietetics & Nutrition Practice | 1316216.01 | |
| Uniform Laws Commission | 634526.66 | |
| Appellate Counsel & Trg Office | 0.00 | |
| Combative Sports Commission | 0.00 | |
| Ombuds Family Child Care | 0.00 | |

---

*Blank `already_mapped` = not in `checkbook.org_agency_map` (unmapped for civic.orgs).*
