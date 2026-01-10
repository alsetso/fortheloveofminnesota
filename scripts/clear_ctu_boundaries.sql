-- Clear all CTU boundaries data
DELETE FROM civic.ctu_boundaries;

-- Reset sequence if using auto-increment (we're using UUIDs, so not needed)
-- But we can verify the table is empty
SELECT COUNT(*) as remaining_count FROM civic.ctu_boundaries;

