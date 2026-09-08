-- SUPERSEDED by 20260810_world_foundation_phase0_lock.sql
--
-- This file originally attempted a bbox filter using p_ctu_unit_ids text[].
-- Production uses uuid[] for CTU unit ids, and the correct bbox shipping
-- migration is world_foundation_phase0_lock (applied remotely).
--
-- Kept as a no-op so local migration order stays stable.

SELECT 1;
