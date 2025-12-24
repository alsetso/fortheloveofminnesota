-- Add notes column to civic.leaders for contextual information

-- ============================================================================
-- STEP 1: Add notes column
-- ============================================================================

ALTER TABLE civic.leaders ADD COLUMN notes TEXT;

-- ============================================================================
-- STEP 2: Update public view to include notes
-- ============================================================================

CREATE OR REPLACE VIEW public.leaders AS SELECT * FROM civic.leaders;

-- ============================================================================
-- STEP 3: Populate notes for existing leaders
-- ============================================================================

-- Tim Walz
UPDATE civic.leaders SET notes = '2024 Democratic VP candidate (Harris ticket). Former U.S. Representative (MN-01, 2007-2019). Former high school teacher and football coach. Army National Guard veteran (24 years). Governor since 2019.'
WHERE slug = 'tim-walz';

-- Peggy Flanagan
UPDATE civic.leaders SET notes = 'First Native American woman elected to statewide executive office in U.S. history. Member of White Earth Band of Ojibwe. Potential 2026 U.S. Senate candidate. Former state representative (2015-2019).'
WHERE slug = 'peggy-flanagan';

-- Steve Simon
UPDATE civic.leaders SET notes = 'Secretary of State since 2015. Former state representative (2005-2015). Known for election security and voting access initiatives. Led expansion of early voting in Minnesota.'
WHERE slug = 'steve-simon';

-- Keith Ellison
UPDATE civic.leaders SET notes = 'First Muslim elected to U.S. Congress (2007-2019). First African American elected to statewide office in Minnesota. Former DNC Deputy Chair. Attorney General since 2019. Led prosecution in Derek Chauvin trial.'
WHERE slug = 'keith-ellison';

-- Julie Blaha
UPDATE civic.leaders SET notes = 'State Auditor since 2019. Former teacher and education advocate. First woman elected State Auditor in Minnesota. Focus on local government accountability.'
WHERE slug = 'julie-blaha';

-- Amy Klobuchar
UPDATE civic.leaders SET notes = 'Senior U.S. Senator from Minnesota (since 2007). 2020 presidential candidate. Ranking member of Senate Judiciary Committee. Known for bipartisan legislation. Fourth term (2025-2031).'
WHERE slug = 'amy-klobuchar';

-- Tina Smith
UPDATE civic.leaders SET notes = 'Announced February 2025 she will NOT seek re-election in 2026. Appointed to Senate 2018 after Al Franken resignation. Former Lieutenant Governor (2015-2018). Former Planned Parenthood executive.'
WHERE slug = 'tina-smith';

-- Natalie Hudson
UPDATE civic.leaders SET notes = 'First Black Chief Justice in Minnesota history. Appointed October 2023 by Gov. Walz. Re-elected November 2024 (63% of vote). On MN Supreme Court since 2015. Former public defender.'
WHERE slug = 'natalie-hudson';

-- Erin Murphy
UPDATE civic.leaders SET notes = 'Senate Majority Leader since February 2024. Former state representative (2007-2018). 2018 DFL gubernatorial candidate. Nurse by profession. Represents St. Paul.'
WHERE slug = 'erin-murphy';

-- Lisa Demuth
UPDATE civic.leaders SET notes = 'First speaker of color in Minnesota House history. Became Speaker February 2025 via power-sharing agreement (67-67 split). Announced run for Governor 2026 seeking Trump endorsement. Represents Cold Spring area.'
WHERE slug = 'lisa-demuth';

-- Mark Johnson
UPDATE civic.leaders SET notes = 'Senate Minority Leader since February 2025. Former Senate Assistant Minority Leader. Represents East Grand Forks area (District 1). Focus on rural Minnesota issues.'
WHERE slug = 'mark-johnson';

-- Zack Stephenson
UPDATE civic.leaders SET notes = 'House DFL Caucus Leader since June 2025 (following Melissa Hortman assassination). State representative since 2019. Represents Coon Rapids. Attorney by profession.'
WHERE slug = 'zack-stephenson';

-- Tom Emmer
UPDATE civic.leaders SET notes = 'U.S. House Majority Whip (#3 Republican in Congress). Elected Whip October 2023. Was briefly Speaker-designate for 4 hours. U.S. Representative since 2015. Former MN state representative and MNGOP chair.'
WHERE slug = 'tom-emmer';

-- Betty McCollum
UPDATE civic.leaders SET notes = 'Most senior Minnesota U.S. Representative (since 2001). Ranking member of House Defense Appropriations Subcommittee. Former state representative. Known for Native American advocacy.'
WHERE slug = 'betty-mccollum';

-- Ilhan Omar
UPDATE civic.leaders SET notes = 'First Somali-American elected to U.S. Congress. First woman of color to represent Minnesota in Congress. Member of "The Squad." U.S. Representative since 2019. Refugee from Somalia.'
WHERE slug = 'ilhan-omar';

-- Angie Craig
UPDATE civic.leaders SET notes = 'Announced candidacy for U.S. Senate 2026 (Tina Smith seat). U.S. Representative since 2019. Only openly LGBTQ+ member of MN congressional delegation. Former healthcare executive.'
WHERE slug = 'angie-craig';

-- Brad Finstad
UPDATE civic.leaders SET notes = 'U.S. Representative since 2022 (special election after Jim Hagedorn death). Former USDA Rural Development State Director. Fourth-generation farmer from southern Minnesota.'
WHERE slug = 'brad-finstad';

-- Kelly Morrison
UPDATE civic.leaders SET notes = 'Newest member of MN delegation (took office January 2025). Succeeded Dean Phillips who ran for president. OB-GYN physician. First woman to represent MN-03.'
WHERE slug = 'kelly-morrison';

-- Michelle Fischbach
UPDATE civic.leaders SET notes = 'U.S. Representative since 2021. Former Minnesota Lieutenant Governor (2018, briefly). Former MN Senate President. Only person to hold both Lt. Gov and U.S. Rep positions from Minnesota.'
WHERE slug = 'michelle-fischbach';

-- Pete Stauber
UPDATE civic.leaders SET notes = 'U.S. Representative since 2019. Former Duluth police officer and detective. Former professional hockey player. Represents Iron Range and northeastern Minnesota.'
WHERE slug = 'pete-stauber';




