-- GerustThuis: Measurements Schema (RAW data opslag)
-- Run dit in Supabase SQL Editor
--
-- Dit is de BRON van alle data. Alles wordt hier opgeslagen.
-- Aggregaties worden hieruit berekend.

-- ============================================================
-- STAP 1: Drop oude measurements tabel en maak nieuwe
-- ============================================================

-- Backup oude data als die er is (optioneel)
-- CREATE TABLE measurements_backup AS SELECT * FROM measurements;

-- Drop oude tabel
DROP TABLE IF EXISTS measurements CASCADE;

-- ============================================================
-- STAP 2: Nieuwe measurements tabel
-- ============================================================

CREATE TABLE measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Welk item (sensor/lamp/switch)
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

    -- Wat wordt gemeten
    capability VARCHAR(50) NOT NULL,
    -- Mogelijke capabilities:
    -- Sensors: presence, temperature, lightlevel, battery, contact
    -- Lights: on, brightness, color_temp, hue, saturation, reachable
    -- Switches: button_event, battery

    -- De waarde (JSONB voor flexibiliteit)
    value JSONB NOT NULL,
    -- Voorbeelden:
    -- presence: true/false
    -- temperature: 21.5
    -- brightness: 254
    -- button_event: {"button": 1, "event": "short_release"}

    -- Wanneer gemeten (van de sensor/Hue API)
    recorded_at TIMESTAMPTZ NOT NULL,

    -- Wanneer opgeslagen in onze database
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAP 3: Indexes voor snelle queries
-- ============================================================

-- Primaire query: haal metingen op voor een item in tijdrange
CREATE INDEX idx_measurements_item_recorded
ON measurements(item_id, recorded_at DESC);

-- Query: alle metingen van bepaalde capability
CREATE INDEX idx_measurements_capability_recorded
ON measurements(capability, recorded_at DESC);

-- Query: recente metingen (voor dashboard)
CREATE INDEX idx_measurements_recorded
ON measurements(recorded_at DESC);

-- Query: specifieke capability van een item
CREATE INDEX idx_measurements_item_capability
ON measurements(item_id, capability, recorded_at DESC);

-- ============================================================
-- STAP 4: Partitioning voorbereiden (voor grote datasets)
-- ============================================================

-- We partitioneren later op recorded_at als de tabel groot wordt
-- Voor nu is een enkele tabel met indexes voldoende

-- ============================================================
-- STAP 5: RLS Policies
-- ============================================================

ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

-- Users kunnen metingen zien van items in hun household
CREATE POLICY "measurements_select" ON measurements
FOR SELECT USING (
    item_id IN (
        SELECT id FROM items
        WHERE household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Users kunnen metingen toevoegen voor hun household items
CREATE POLICY "measurements_insert" ON measurements
FOR INSERT WITH CHECK (
    item_id IN (
        SELECT id FROM items
        WHERE household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- ============================================================
-- STAP 6: Helper function om measurement toe te voegen
-- ============================================================

CREATE OR REPLACE FUNCTION add_measurement(
    p_item_id UUID,
    p_capability VARCHAR(50),
    p_value JSONB,
    p_recorded_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO measurements (item_id, capability, value, recorded_at)
    VALUES (p_item_id, p_capability, p_value, p_recorded_at)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- ============================================================
-- STAP 7: Helper function om batch measurements toe te voegen
-- ============================================================

CREATE OR REPLACE FUNCTION add_measurements_batch(
    p_measurements JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
    v_measurement JSONB;
BEGIN
    -- Input format: [{"item_id": "...", "capability": "...", "value": ..., "recorded_at": "..."}]
    FOR v_measurement IN SELECT * FROM jsonb_array_elements(p_measurements)
    LOOP
        INSERT INTO measurements (item_id, capability, value, recorded_at)
        VALUES (
            (v_measurement->>'item_id')::UUID,
            v_measurement->>'capability',
            v_measurement->'value',
            COALESCE((v_measurement->>'recorded_at')::TIMESTAMPTZ, NOW())
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- ============================================================
-- STAP 8: View voor laatste waarde per item/capability
-- ============================================================

CREATE OR REPLACE VIEW latest_measurements AS
SELECT DISTINCT ON (item_id, capability)
    item_id,
    capability,
    value,
    recorded_at
FROM measurements
ORDER BY item_id, capability, recorded_at DESC;

-- ============================================================
-- STAP 9: Cleanup function (oude data verwijderen)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_measurements(
    p_days_to_keep INT DEFAULT 90
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM measurements
    WHERE recorded_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- ============================================================
-- Verificatie
-- ============================================================

SELECT 'measurements tabel aangemaakt!' as status;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'measurements'
ORDER BY ordinal_position;
