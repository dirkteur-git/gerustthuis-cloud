-- GerustThuis: Alerts System
-- Run dit in Supabase SQL Editor

-- ============================================================
-- STAP 1: Alerts Tabel
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- no_activity, unusual_pattern, low_battery, sensor_offline
    severity VARCHAR(20) DEFAULT 'warning', -- info, warning, critical
    title VARCHAR(255) NOT NULL,
    message TEXT,
    room_name VARCHAR(255),
    sensor_id VARCHAR(255),
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAP 2: Alert Settings per Household
-- ============================================================

CREATE TABLE IF NOT EXISTS alert_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    -- Inactivity settings
    no_activity_threshold_minutes INT DEFAULT 120, -- 2 hours
    -- Quiet hours (no alerts during sleep)
    quiet_hours_start TIME DEFAULT '23:00',
    quiet_hours_end TIME DEFAULT '07:00',
    -- Notification preferences
    email_alerts BOOLEAN DEFAULT true,
    push_alerts BOOLEAN DEFAULT true,
    -- Email recipients
    alert_emails TEXT[], -- Array of email addresses
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(household_id)
);

-- ============================================================
-- STAP 3: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_alerts_household_created
ON alerts(household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged
ON alerts(acknowledged, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_type
ON alerts(type);

-- ============================================================
-- STAP 4: Enable RLS
-- ============================================================

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STAP 5: RLS Policies for Alerts
-- ============================================================

-- Users can view their household's alerts
CREATE POLICY "Users can view household alerts"
ON alerts FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Users can acknowledge alerts
CREATE POLICY "Users can acknowledge alerts"
ON alerts FOR UPDATE
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Service role can insert alerts
CREATE POLICY "Service can insert alerts"
ON alerts FOR INSERT
WITH CHECK (true);

-- ============================================================
-- STAP 6: RLS Policies for Alert Settings
-- ============================================================

-- Users can view their household's settings
CREATE POLICY "Users can view household alert settings"
ON alert_settings FOR SELECT
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Admins can update settings
CREATE POLICY "Admins can manage alert settings"
ON alert_settings FOR ALL
USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- STAP 7: Trigger to Create Default Settings
-- ============================================================

-- Auto-create alert settings when household is created
CREATE OR REPLACE FUNCTION create_default_alert_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO alert_settings (household_id)
    VALUES (NEW.id)
    ON CONFLICT (household_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_household_created_settings ON households;
CREATE TRIGGER on_household_created_settings
    AFTER INSERT ON households
    FOR EACH ROW
    EXECUTE FUNCTION create_default_alert_settings();

-- ============================================================
-- STAP 8: Enable Realtime for Alerts
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- ============================================================
-- Verificatie
-- ============================================================

SELECT 'alerts tables created!' as status;

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('alerts', 'alert_settings');
