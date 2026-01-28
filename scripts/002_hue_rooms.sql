-- GerustThuis: Hue Rooms Sync
-- Run dit in Supabase SQL Editor (na 001_households.sql)

-- ============================================================
-- STAP 1: Voeg Hue-specifieke kolommen toe aan rooms
-- ============================================================

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS hue_group_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hue_class VARCHAR(50),  -- e.g., 'living_room', 'bedroom'
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ============================================================
-- STAP 2: Voeg room_id toe aan items (i.p.v. location string)
-- ============================================================

ALTER TABLE items
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hue_unique_id VARCHAR(100);

-- Index voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_items_room ON items(room_id);
CREATE INDEX IF NOT EXISTS idx_items_hue_unique_id ON items(hue_unique_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hue_group ON rooms(integration_id, hue_group_id);

-- ============================================================
-- STAP 3: Maak hue_sync_log tabel voor sync tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS hue_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(20) NOT NULL, -- 'rooms', 'sensors', 'lights', 'full'
    status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
    rooms_synced INT DEFAULT 0,
    items_synced INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hue_sync_log_integration ON hue_sync_log(integration_id);

-- ============================================================
-- STAP 4: RLS voor hue_sync_log
-- ============================================================

ALTER TABLE hue_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
ON hue_sync_log FOR SELECT
USING (
    integration_id IN (
        SELECT id FROM integrations
        WHERE household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- ============================================================
-- STAP 5: Helper function om Hue rooms te synchen
-- ============================================================

-- Deze function kan worden aangeroepen vanuit de frontend
-- Na het ophalen van rooms via de Hue API

CREATE OR REPLACE FUNCTION sync_hue_room(
    p_integration_id UUID,
    p_hue_group_id VARCHAR,
    p_name VARCHAR,
    p_hue_class VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_room_id UUID;
    v_household_id UUID;
BEGIN
    -- Get household from integration
    SELECT household_id INTO v_household_id
    FROM integrations
    WHERE id = p_integration_id;

    -- Check if room already exists
    SELECT id INTO v_room_id
    FROM rooms
    WHERE integration_id = p_integration_id
      AND hue_group_id = p_hue_group_id;

    IF v_room_id IS NOT NULL THEN
        -- Update existing room
        UPDATE rooms
        SET name = p_name,
            hue_class = p_hue_class,
            last_synced_at = NOW()
        WHERE id = v_room_id;
    ELSE
        -- Create new room
        INSERT INTO rooms (name, household_id, integration_id, hue_group_id, hue_class, last_synced_at)
        VALUES (p_name, v_household_id, p_integration_id, p_hue_group_id, p_hue_class, NOW())
        RETURNING id INTO v_room_id;
    END IF;

    RETURN v_room_id;
END;
$$;

-- ============================================================
-- STAP 6: Helper function om Hue items te synchen
-- ============================================================

CREATE OR REPLACE FUNCTION sync_hue_item(
    p_room_id UUID,
    p_hue_unique_id VARCHAR,
    p_name VARCHAR,
    p_type VARCHAR,
    p_config JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_id UUID;
    v_household_id UUID;
    v_integration_id UUID;
BEGIN
    -- Get household and integration from room
    SELECT household_id, integration_id INTO v_household_id, v_integration_id
    FROM rooms
    WHERE id = p_room_id;

    -- Check if item already exists
    SELECT id INTO v_item_id
    FROM items
    WHERE hue_unique_id = p_hue_unique_id;

    IF v_item_id IS NOT NULL THEN
        -- Update existing item
        UPDATE items
        SET name = p_name,
            room_id = p_room_id,
            config = p_config
        WHERE id = v_item_id;
    ELSE
        -- Create new item
        INSERT INTO items (name, type, room_id, household_id, integration_id, hue_unique_id, config)
        VALUES (p_name, p_type, p_room_id, v_household_id, v_integration_id, p_hue_unique_id, p_config)
        RETURNING id INTO v_item_id;
    END IF;

    RETURN v_item_id;
END;
$$;

-- ============================================================
-- Verificatie
-- ============================================================

SELECT
    'rooms with hue_group_id' as check_type,
    COUNT(*) as count
FROM rooms
WHERE hue_group_id IS NOT NULL

UNION ALL

SELECT
    'items with room_id',
    COUNT(*)
FROM items
WHERE room_id IS NOT NULL

UNION ALL

SELECT
    'items with hue_unique_id',
    COUNT(*)
FROM items
WHERE hue_unique_id IS NOT NULL;
