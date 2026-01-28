-- GerustThuis: CLEANUP ALLES
-- Run dit in Supabase SQL Editor om alles op te schonen
--
-- LET OP: Dit verwijdert ALLE data!

-- ============================================================
-- STAP 1: Verwijder alle data (in juiste volgorde vanwege FK's)
-- ============================================================

-- Aggregaties
TRUNCATE room_hourly_stats CASCADE;
TRUNCATE room_daily_stats CASCADE;

-- Alerts
TRUNCATE alerts CASCADE;
TRUNCATE alert_settings CASCADE;

-- RAW data
TRUNCATE measurements CASCADE;
TRUNCATE room_events CASCADE;

-- Woning structuur
TRUNCATE items CASCADE;
TRUNCATE rooms CASCADE;

-- Integraties
TRUNCATE hue_sync_log CASCADE;
TRUNCATE integrations CASCADE;

-- Households (behalve users)
TRUNCATE household_members CASCADE;
TRUNCATE households CASCADE;

-- Profiles (niet auth.users - die moet je via Dashboard verwijderen)
TRUNCATE profiles CASCADE;

-- ============================================================
-- STAP 2: Verwijder ongebruikte tabellen
-- ============================================================

-- Legacy/ongebruikte tabellen
DROP TABLE IF EXISTS sensor_events CASCADE;
DROP TABLE IF EXISTS hue_connections CASCADE;
DROP TABLE IF EXISTS dag_vectors CASCADE;
DROP TABLE IF EXISTS dag_vectors_met_stats CASCADE;
DROP TABLE IF EXISTS uur_verwachtingen CASCADE;

-- ============================================================
-- STAP 3: Verwijder oude functies
-- ============================================================

DROP FUNCTION IF EXISTS backfill_aggregations(INT);
DROP FUNCTION IF EXISTS sync_hue_room(UUID, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS sync_hue_item(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS get_my_room_ids();
DROP FUNCTION IF EXISTS check_nu();

-- ============================================================
-- STAP 4: Verificatie
-- ============================================================

SELECT 'Data verwijderd!' as status;

SELECT
    'households' as tabel, COUNT(*) as rows FROM households
UNION ALL SELECT 'household_members', COUNT(*) FROM household_members
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'integrations', COUNT(*) FROM integrations
UNION ALL SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL SELECT 'items', COUNT(*) FROM items
UNION ALL SELECT 'measurements', COUNT(*) FROM measurements
UNION ALL SELECT 'room_events', COUNT(*) FROM room_events;

-- ============================================================
-- STAP 5: Lijst van tabellen die nu bestaan
-- ============================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
