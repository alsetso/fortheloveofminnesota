-- Clear all CTU boundaries data
DELETE FROM layers.cities_and_towns;

-- Reset sequence if using auto-increment (we're using UUIDs, so not needed)
-- But we can verify the table is empty
SELECT COUNT(*) as remaining_count FROM layers.cities_and_towns;

