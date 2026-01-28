-- GerustThuis: Household/Tenant Structuur
--
-- VEREIST: Run eerst 000_base_schema.sql als de tabellen nog niet bestaan!
--
-- Run dit in Supabase SQL Editor

-- ============================================================
-- STAP 1: Maak households tabel
-- ============================================================

CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAP 2: Maak household_members tabel
-- ============================================================

CREATE TABLE IF NOT EXISTS household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(household_id, user_id)
);

-- ============================================================
-- STAP 3: Voeg household_id toe aan bestaande tabellen
-- ============================================================

-- Integrations
ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;

-- Rooms
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;

-- Items
ALTER TABLE items
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;

-- Profiles (voor snelle lookup van huidige household)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;

-- ============================================================
-- STAP 4: Maak indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_integrations_household ON integrations(household_id);
CREATE INDEX IF NOT EXISTS idx_rooms_household ON rooms(household_id);
CREATE INDEX IF NOT EXISTS idx_items_household ON items(household_id);

-- ============================================================
-- STAP 5: Enable RLS
-- ============================================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STAP 6: RLS Policies voor households
-- ============================================================

-- Users kunnen hun eigen households zien
CREATE POLICY "Users can view own households"
ON households FOR SELECT
USING (
    id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Users kunnen households aanmaken
CREATE POLICY "Users can create households"
ON households FOR INSERT
WITH CHECK (true);

-- Alleen admins kunnen household updaten
CREATE POLICY "Admins can update households"
ON households FOR UPDATE
USING (
    id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Alleen admins kunnen households verwijderen
CREATE POLICY "Admins can delete households"
ON households FOR DELETE
USING (
    id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- STAP 7: RLS Policies voor household_members
-- ============================================================

-- Members kunnen andere members in hun household zien
CREATE POLICY "Members can view household members"
ON household_members FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Admins kunnen members toevoegen
CREATE POLICY "Admins can add members"
ON household_members FOR INSERT
WITH CHECK (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    -- Of het is de eerste member (bij aanmaken household)
    NOT EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = household_members.household_id
    )
);

-- Admins kunnen members verwijderen
CREATE POLICY "Admins can remove members"
ON household_members FOR DELETE
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- STAP 8: Update RLS policies voor integrations
-- ============================================================

-- Verwijder oude policies als ze bestaan
DROP POLICY IF EXISTS "Users can view own integrations" ON integrations;
DROP POLICY IF EXISTS "Users can insert own integrations" ON integrations;
DROP POLICY IF EXISTS "Users can update own integrations" ON integrations;
DROP POLICY IF EXISTS "Users can delete own integrations" ON integrations;

-- Nieuwe household-based policies
CREATE POLICY "Users can view household integrations"
ON integrations FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
    OR household_id IS NULL -- Legacy data
);

CREATE POLICY "Users can insert household integrations"
ON integrations FOR INSERT
WITH CHECK (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update household integrations"
ON integrations FOR UPDATE
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Users can delete household integrations"
ON integrations FOR DELETE
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- STAP 9: Update RLS policies voor rooms
-- ============================================================

-- Verwijder oude policies als ze bestaan
DROP POLICY IF EXISTS "Public can view rooms" ON rooms;
DROP POLICY IF EXISTS "Users can view rooms" ON rooms;

-- Nieuwe household-based policy
CREATE POLICY "Users can view household rooms"
ON rooms FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
    OR household_id IS NULL -- Legacy data
);

CREATE POLICY "Users can manage household rooms"
ON rooms FOR ALL
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- ============================================================
-- STAP 10: Update RLS policies voor items
-- ============================================================

-- Verwijder oude policies als ze bestaan
DROP POLICY IF EXISTS "Public can view items" ON items;
DROP POLICY IF EXISTS "Users can view items" ON items;

-- Nieuwe household-based policy
CREATE POLICY "Users can view household items"
ON items FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
    OR household_id IS NULL -- Legacy data
);

-- ============================================================
-- STAP 11: Helper function voor huidige household
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_household()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT household_id
    FROM household_members
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- ============================================================
-- Verificatie
-- ============================================================

SELECT 'households' as table_name, COUNT(*) as row_count FROM households
UNION ALL
SELECT 'household_members', COUNT(*) FROM household_members
UNION ALL
SELECT 'integrations with household', COUNT(*) FROM integrations WHERE household_id IS NOT NULL
UNION ALL
SELECT 'rooms with household', COUNT(*) FROM rooms WHERE household_id IS NOT NULL;
