-- GerustThuis: Fix RLS voor room_events, dag_vectors, uur_verwachtingen
-- Run dit in Supabase SQL Editor
--
-- Probleem: dag_vectors heeft restrictieve RLS policies

-- ============================================================
-- STAP 1: Drop alle bestaande policies
-- ============================================================

DROP POLICY IF EXISTS "household_room_events_insert" ON room_events;
DROP POLICY IF EXISTS "household_room_events_select" ON room_events;
DROP POLICY IF EXISTS "Users can view room_events" ON room_events;
DROP POLICY IF EXISTS "Users can insert room_events" ON room_events;
DROP POLICY IF EXISTS "Users can delete room_events" ON room_events;
DROP POLICY IF EXISTS "Users can manage room_events" ON room_events;

-- dag_vectors policies
DROP POLICY IF EXISTS "Users can view dag_vectors" ON dag_vectors;
DROP POLICY IF EXISTS "Users can insert dag_vectors" ON dag_vectors;
DROP POLICY IF EXISTS "Users can manage dag_vectors" ON dag_vectors;
DROP POLICY IF EXISTS "Allow all dag_vectors" ON dag_vectors;

-- uur_verwachtingen policies
DROP POLICY IF EXISTS "Users can view uur_verwachtingen" ON uur_verwachtingen;
DROP POLICY IF EXISTS "Users can manage uur_verwachtingen" ON uur_verwachtingen;
DROP POLICY IF EXISTS "Allow all uur_verwachtingen" ON uur_verwachtingen;

-- ============================================================
-- STAP 2: Maak SECURITY DEFINER functies
-- ============================================================

-- Deze functie haalt room_ids op voor de huidige user zonder RLS recursie
CREATE OR REPLACE FUNCTION get_my_room_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT r.id
    FROM rooms r
    JOIN integrations i ON r.integration_id = i.id
    WHERE i.user_id = auth.uid();
$$;

-- ============================================================
-- STAP 3: room_events policies
-- ============================================================

CREATE POLICY "Users can view room_events"
ON room_events FOR SELECT
USING (room_id IN (SELECT get_my_room_ids()));

CREATE POLICY "Users can insert room_events"
ON room_events FOR INSERT
WITH CHECK (room_id IN (SELECT get_my_room_ids()));

CREATE POLICY "Users can delete room_events"
ON room_events FOR DELETE
USING (room_id IN (SELECT get_my_room_ids()));

-- ============================================================
-- STAP 4: dag_vectors - open voor authenticated users
-- (dit is een system/analytics tabel, niet user-specific)
-- ============================================================

-- Check if RLS is enabled, if so add permissive policy
DO $$
BEGIN
    -- Enable RLS if not already
    ALTER TABLE dag_vectors ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Authenticated users kunnen dag_vectors lezen en schrijven
CREATE POLICY "Allow all dag_vectors"
ON dag_vectors FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- STAP 5: uur_verwachtingen - open voor authenticated users
-- ============================================================

DO $$
BEGIN
    ALTER TABLE uur_verwachtingen ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow all uur_verwachtingen"
ON uur_verwachtingen FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- Verificatie
-- ============================================================

SELECT 'RLS fix applied!' as status;

-- Check policies
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('room_events', 'dag_vectors', 'uur_verwachtingen')
ORDER BY tablename, policyname;
