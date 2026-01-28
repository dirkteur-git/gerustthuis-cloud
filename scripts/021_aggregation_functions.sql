-- GerustThuis: Aggregatie Functies
-- Run dit in Supabase SQL Editor (na 020_measurements_schema.sql)
--
-- Deze functies aggregeren RAW data naar uur/dag statistieken

-- ============================================================
-- STAP 1: Room hourly stats tabel (hergebruik bestaande of maak nieuw)
-- ============================================================

CREATE TABLE IF NOT EXISTS room_hourly_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    hour_start TIMESTAMPTZ NOT NULL,

    -- Event counts
    motion_count INT DEFAULT 0,
    door_count INT DEFAULT 0,
    light_count INT DEFAULT 0,
    total_events INT DEFAULT 0,

    -- Sensor stats (gemiddelden over het uur)
    avg_temperature DECIMAL(4,1),
    min_temperature DECIMAL(4,1),
    max_temperature DECIMAL(4,1),
    avg_lightlevel INT,

    -- Light usage
    lights_on_minutes INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, hour_start)
);

CREATE INDEX IF NOT EXISTS idx_hourly_stats_room_time
ON room_hourly_stats(room_id, hour_start DESC);

-- ============================================================
-- STAP 2: Room daily stats tabel
-- ============================================================

CREATE TABLE IF NOT EXISTS room_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Event totals
    total_motion INT DEFAULT 0,
    total_door INT DEFAULT 0,
    total_light INT DEFAULT 0,
    total_events INT DEFAULT 0,

    -- Activity window
    first_activity TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    active_hours INT[], -- Array van uren met activiteit [7,8,9,12,18,19,20]

    -- Temperature stats
    avg_temperature DECIMAL(4,1),
    min_temperature DECIMAL(4,1),
    max_temperature DECIMAL(4,1),

    -- Light usage
    total_light_minutes INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_room_date
ON room_daily_stats(room_id, date DESC);

-- ============================================================
-- STAP 3: RLS voor stats tabellen
-- ============================================================

ALTER TABLE room_hourly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_daily_stats ENABLE ROW LEVEL SECURITY;

-- Users kunnen stats zien van rooms in hun household
CREATE POLICY "hourly_stats_select" ON room_hourly_stats
FOR SELECT USING (
    room_id IN (
        SELECT id FROM rooms
        WHERE household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "daily_stats_select" ON room_daily_stats
FOR SELECT USING (
    room_id IN (
        SELECT id FROM rooms
        WHERE household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- ============================================================
-- STAP 4: Functie om uur stats te berekenen
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_hourly_stats(
    p_hour_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    rooms_processed INT,
    stats_created INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hour_start TIMESTAMPTZ;
    v_hour_end TIMESTAMPTZ;
    v_rooms_processed INT := 0;
    v_stats_created INT := 0;
BEGIN
    -- Default: vorig uur
    IF p_hour_start IS NULL THEN
        v_hour_start := date_trunc('hour', NOW() - INTERVAL '1 hour');
    ELSE
        v_hour_start := date_trunc('hour', p_hour_start);
    END IF;
    v_hour_end := v_hour_start + INTERVAL '1 hour';

    -- Bereken stats voor elke room
    INSERT INTO room_hourly_stats (
        room_id,
        hour_start,
        motion_count,
        door_count,
        light_count,
        total_events,
        avg_temperature,
        min_temperature,
        max_temperature,
        avg_lightlevel
    )
    SELECT
        r.id AS room_id,
        v_hour_start AS hour_start,
        COALESCE(SUM(CASE WHEN re.source = 'motion' THEN 1 ELSE 0 END), 0) AS motion_count,
        COALESCE(SUM(CASE WHEN re.source = 'door' THEN 1 ELSE 0 END), 0) AS door_count,
        COALESCE(SUM(CASE WHEN re.source = 'light' THEN 1 ELSE 0 END), 0) AS light_count,
        COALESCE(COUNT(re.id), 0) AS total_events,
        -- Temperature stats van measurements
        (
            SELECT AVG((m.value)::DECIMAL)
            FROM measurements m
            JOIN items i ON m.item_id = i.id
            WHERE i.room_id = r.id
            AND m.capability = 'temperature'
            AND m.recorded_at >= v_hour_start
            AND m.recorded_at < v_hour_end
        ) AS avg_temperature,
        (
            SELECT MIN((m.value)::DECIMAL)
            FROM measurements m
            JOIN items i ON m.item_id = i.id
            WHERE i.room_id = r.id
            AND m.capability = 'temperature'
            AND m.recorded_at >= v_hour_start
            AND m.recorded_at < v_hour_end
        ) AS min_temperature,
        (
            SELECT MAX((m.value)::DECIMAL)
            FROM measurements m
            JOIN items i ON m.item_id = i.id
            WHERE i.room_id = r.id
            AND m.capability = 'temperature'
            AND m.recorded_at >= v_hour_start
            AND m.recorded_at < v_hour_end
        ) AS max_temperature,
        (
            SELECT AVG((m.value)::INT)
            FROM measurements m
            JOIN items i ON m.item_id = i.id
            WHERE i.room_id = r.id
            AND m.capability = 'lightlevel'
            AND m.recorded_at >= v_hour_start
            AND m.recorded_at < v_hour_end
        ) AS avg_lightlevel
    FROM rooms r
    LEFT JOIN room_events re ON re.room_id = r.id
        AND re.recorded_at >= v_hour_start
        AND re.recorded_at < v_hour_end
    GROUP BY r.id
    ON CONFLICT (room_id, hour_start)
    DO UPDATE SET
        motion_count = EXCLUDED.motion_count,
        door_count = EXCLUDED.door_count,
        light_count = EXCLUDED.light_count,
        total_events = EXCLUDED.total_events,
        avg_temperature = EXCLUDED.avg_temperature,
        min_temperature = EXCLUDED.min_temperature,
        max_temperature = EXCLUDED.max_temperature,
        avg_lightlevel = EXCLUDED.avg_lightlevel;

    GET DIAGNOSTICS v_stats_created = ROW_COUNT;

    SELECT COUNT(DISTINCT id) INTO v_rooms_processed FROM rooms;

    RETURN QUERY SELECT v_rooms_processed, v_stats_created;
END;
$$;

-- ============================================================
-- STAP 5: Functie om dag stats te berekenen
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_daily_stats(
    p_date DATE DEFAULT NULL
)
RETURNS TABLE (
    rooms_processed INT,
    stats_created INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date DATE;
    v_rooms_processed INT := 0;
    v_stats_created INT := 0;
BEGIN
    -- Default: gisteren
    IF p_date IS NULL THEN
        v_date := CURRENT_DATE - INTERVAL '1 day';
    ELSE
        v_date := p_date;
    END IF;

    -- Bereken dag stats vanuit uur stats
    INSERT INTO room_daily_stats (
        room_id,
        date,
        total_motion,
        total_door,
        total_light,
        total_events,
        first_activity,
        last_activity,
        active_hours,
        avg_temperature,
        min_temperature,
        max_temperature
    )
    SELECT
        h.room_id,
        v_date AS date,
        SUM(h.motion_count)::INT AS total_motion,
        SUM(h.door_count)::INT AS total_door,
        SUM(h.light_count)::INT AS total_light,
        SUM(h.total_events)::INT AS total_events,
        MIN(CASE WHEN h.total_events > 0 THEN h.hour_start END) AS first_activity,
        MAX(CASE WHEN h.total_events > 0 THEN h.hour_start END) AS last_activity,
        ARRAY_AGG(DISTINCT EXTRACT(HOUR FROM h.hour_start)::INT ORDER BY EXTRACT(HOUR FROM h.hour_start)::INT)
            FILTER (WHERE h.total_events > 0) AS active_hours,
        AVG(h.avg_temperature) AS avg_temperature,
        MIN(h.min_temperature) AS min_temperature,
        MAX(h.max_temperature) AS max_temperature
    FROM room_hourly_stats h
    WHERE h.hour_start >= v_date::TIMESTAMPTZ
      AND h.hour_start < (v_date + 1)::TIMESTAMPTZ
    GROUP BY h.room_id
    ON CONFLICT (room_id, date)
    DO UPDATE SET
        total_motion = EXCLUDED.total_motion,
        total_door = EXCLUDED.total_door,
        total_light = EXCLUDED.total_light,
        total_events = EXCLUDED.total_events,
        first_activity = EXCLUDED.first_activity,
        last_activity = EXCLUDED.last_activity,
        active_hours = EXCLUDED.active_hours,
        avg_temperature = EXCLUDED.avg_temperature,
        min_temperature = EXCLUDED.min_temperature,
        max_temperature = EXCLUDED.max_temperature;

    GET DIAGNOSTICS v_stats_created = ROW_COUNT;

    SELECT COUNT(DISTINCT room_id) INTO v_rooms_processed
    FROM room_hourly_stats
    WHERE hour_start >= v_date::TIMESTAMPTZ
      AND hour_start < (v_date + 1)::TIMESTAMPTZ;

    RETURN QUERY SELECT v_rooms_processed, v_stats_created;
END;
$$;

-- ============================================================
-- STAP 6: Functie om historische data te aggregeren (backfill)
-- ============================================================

CREATE OR REPLACE FUNCTION backfill_stats(
    p_days_back INT DEFAULT 7
)
RETURNS TABLE (
    date_processed DATE,
    hourly_stats INT,
    daily_stats INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date DATE;
    v_hour TIMESTAMPTZ;
    v_hourly INT;
    v_daily INT;
BEGIN
    -- Loop door elke dag
    FOR v_date IN SELECT generate_series(
        CURRENT_DATE - p_days_back,
        CURRENT_DATE - 1,
        '1 day'::INTERVAL
    )::DATE
    LOOP
        v_hourly := 0;

        -- Bereken hourly stats voor elk uur van de dag
        FOR v_hour IN SELECT generate_series(
            v_date::TIMESTAMPTZ,
            v_date::TIMESTAMPTZ + INTERVAL '23 hours',
            '1 hour'::INTERVAL
        )
        LOOP
            PERFORM calculate_hourly_stats(v_hour);
            v_hourly := v_hourly + 1;
        END LOOP;

        -- Bereken daily stats
        PERFORM calculate_daily_stats(v_date);
        v_daily := 1;

        RETURN QUERY SELECT v_date, v_hourly, v_daily;
    END LOOP;
END;
$$;

-- ============================================================
-- STAP 7: View voor dashboard (snelle access tot huidige status)
-- ============================================================

CREATE OR REPLACE VIEW room_current_status AS
SELECT
    r.id AS room_id,
    r.name AS room_name,
    r.household_id,
    -- Laatste activiteit
    (
        SELECT MAX(recorded_at)
        FROM room_events
        WHERE room_id = r.id
    ) AS last_activity,
    -- Events vandaag
    (
        SELECT COUNT(*)
        FROM room_events
        WHERE room_id = r.id
        AND recorded_at >= CURRENT_DATE
    ) AS events_today,
    -- Huidige temperatuur (laatste meting)
    (
        SELECT (m.value)::DECIMAL
        FROM measurements m
        JOIN items i ON m.item_id = i.id
        WHERE i.room_id = r.id
        AND m.capability = 'temperature'
        ORDER BY m.recorded_at DESC
        LIMIT 1
    ) AS current_temperature,
    -- Aantal actieve sensoren
    (
        SELECT COUNT(*)
        FROM items
        WHERE room_id = r.id
        AND type = 'sensor'
    ) AS sensor_count,
    -- Aantal lampen
    (
        SELECT COUNT(*)
        FROM items
        WHERE room_id = r.id
        AND type = 'light'
    ) AS light_count
FROM rooms r;

-- ============================================================
-- Verificatie
-- ============================================================

SELECT 'Aggregatie functies aangemaakt!' as status;

-- Test hourly stats
-- SELECT * FROM calculate_hourly_stats();

-- Test daily stats
-- SELECT * FROM calculate_daily_stats();

-- Test backfill
-- SELECT * FROM backfill_stats(7);
