-- GerustThuis: Basis Database Schema
-- Run dit EERST in Supabase SQL Editor voordat je andere scripts runt
-- Dit script maakt alle basis tabellen aan

-- ============================================================
-- STAP 1: Reference Tables
-- ============================================================

-- Integration types (hue, homey, home_assistant, etc.)
CREATE TABLE IF NOT EXISTS integration_types (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config_schema JSONB DEFAULT '{}'
);

-- Item types (motion_sensor, contact_sensor, light, etc.)
CREATE TABLE IF NOT EXISTS item_types (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    state_schema JSONB DEFAULT '{}',
    value_schema JSONB DEFAULT '{}'
);

-- ============================================================
-- STAP 2: Seed Reference Data
-- ============================================================

INSERT INTO integration_types (code, name, description) VALUES
    ('hue', 'Philips Hue', 'Philips Hue Bridge via cloud API'),
    ('homey', 'Homey', 'Athom Homey smart home hub'),
    ('home_assistant', 'Home Assistant', 'Home Assistant instance')
ON CONFLICT (code) DO NOTHING;

INSERT INTO item_types (code, name, category) VALUES
    ('motion_sensor', 'Bewegingssensor', 'sensor'),
    ('contact_sensor', 'Contactsensor', 'sensor'),
    ('temperature_sensor', 'Temperatuursensor', 'sensor'),
    ('light_level_sensor', 'Lichtsensor', 'sensor'),
    ('sensor', 'Sensor', 'sensor'),
    ('light', 'Lamp', 'actuator'),
    ('switch', 'Schakelaar', 'actuator'),
    ('button', 'Knop/Dimmer', 'sensor'),
    ('bridge', 'Bridge/Hub', 'bridge')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STAP 3: Core Tables
-- ============================================================

-- Profiles (extended auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'consumer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations (Hue, Home Assistant, etc.)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL REFERENCES integration_types(code),
    name VARCHAR(100) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items (sensors, lights, etc.)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    type VARCHAR(50) NOT NULL REFERENCES item_types(code),
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    config JSONB DEFAULT '{}',
    state JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Measurements (sensor data)
CREATE TABLE IF NOT EXISTS measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) DEFAULT 'sync',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room Events (motion, door, light events per room)
CREATE TABLE IF NOT EXISTS room_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL, -- 'motion', 'door', 'light'
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dag Vectors (daily activity patterns)
CREATE TABLE IF NOT EXISTS dag_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    datum DATE NOT NULL UNIQUE,
    vector DECIMAL[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uur Verwachtingen (hourly expectations)
CREATE TABLE IF NOT EXISTS uur_verwachtingen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uur INT NOT NULL CHECK (uur >= 0 AND uur < 24),
    verwacht DECIMAL,
    std DECIMAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(uur)
);

-- ============================================================
-- STAP 4: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_measurements_item_recorded ON measurements(item_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_recorded ON measurements(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_integration ON items(integration_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_room_events_room ON room_events(room_id);
CREATE INDEX IF NOT EXISTS idx_room_events_recorded ON room_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_dag_vectors_datum ON dag_vectors(datum DESC);

-- ============================================================
-- STAP 5: Enable RLS
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STAP 6: Basic RLS Policies (will be updated by 001_households.sql)
-- ============================================================

-- Profiles: users can view/update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Integrations: basic policy (will be replaced by household-based)
DROP POLICY IF EXISTS "Users can manage own integrations" ON integrations;
DROP POLICY IF EXISTS "Legacy data is public" ON integrations;
CREATE POLICY "Users can manage own integrations" ON integrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Legacy data is public" ON integrations FOR SELECT USING (user_id IS NULL);

-- Items: basic policy
DROP POLICY IF EXISTS "Users can view items" ON items;
DROP POLICY IF EXISTS "Public can view items" ON items;
CREATE POLICY "Public can view items" ON items FOR SELECT USING (true);

-- Rooms: basic policy
DROP POLICY IF EXISTS "Public can view rooms" ON rooms;
CREATE POLICY "Public can view rooms" ON rooms FOR SELECT USING (true);

-- Room Events: basic policy
DROP POLICY IF EXISTS "Public can view room_events" ON room_events;
CREATE POLICY "Public can view room_events" ON room_events FOR SELECT USING (true);

-- Measurements: basic policy
DROP POLICY IF EXISTS "Public can view measurements" ON measurements;
CREATE POLICY "Public can view measurements" ON measurements FOR SELECT USING (true);

-- ============================================================
-- Verificatie
-- ============================================================

SELECT 'Basis schema aangemaakt!' as status;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
