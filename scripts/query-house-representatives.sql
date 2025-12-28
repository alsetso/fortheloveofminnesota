-- Query to get all US House Representatives from Minnesota
-- This pulls data from the civic schema using the terms/leaders/positions/jurisdictions structure

SELECT 
  t.id AS term_id,
  l.id AS leader_id,
  l.mn_id,
  l.full_name,
  l.slug AS leader_slug,
  l.party,
  l.profile_image_url,
  l.official_url,
  p.id AS position_id,
  p.title AS position_title,
  p.slug AS position_slug,
  p.branch,
  p.level,
  p.authority_rank,
  j.id AS jurisdiction_id,
  j.name AS jurisdiction_name,
  j.slug AS jurisdiction_slug,
  j.type AS jurisdiction_type,
  t.start_date,
  t.end_date,
  t.is_current,
  t.is_leadership,
  t.created_at
FROM civic.terms t
JOIN civic.leaders l ON t.leader_id = l.id
JOIN civic.positions p ON t.position_id = p.id
JOIN civic.jurisdictions j ON t.jurisdiction_id = j.id
WHERE p.slug = 'us-representative'
  AND p.level = 'Federal'
  AND t.is_current = true
ORDER BY j.slug; -- Order by district (mn-01, mn-02, etc.)

-- Alternative: Get all terms (including historical)
-- SELECT * FROM civic.terms t
-- JOIN civic.leaders l ON t.leader_id = l.id
-- JOIN civic.positions p ON t.position_id = p.id
-- JOIN civic.jurisdictions j ON t.jurisdiction_id = j.id
-- WHERE p.slug = 'us-representative'
-- ORDER BY t.start_date DESC, j.slug;

