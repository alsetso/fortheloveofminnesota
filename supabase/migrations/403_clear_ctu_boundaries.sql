-- Clear all CTU boundaries records
DELETE FROM civic.ctu_boundaries;

-- Verify the table is empty
SELECT COUNT(*) as remaining_count FROM civic.ctu_boundaries;

