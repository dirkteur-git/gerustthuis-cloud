# GerustThuis - Database Schema

Dit document beschrijft alle tabellen, kolommen en hun doel.

---

## CORE - Users & Woningen

### `profiles`
Uitbreiding op Supabase auth.users met app-specifieke data.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Zelfde als auth.users.id |
| `email` | VARCHAR(255) | Email adres |
| `first_name` | VARCHAR(100) | Voornaam |
| `last_name` | VARCHAR(100) | Achternaam |
| `role` | VARCHAR(20) | 'consumer' of 'business' |
| `household_id` | UUID (FK) | Primaire woning van user |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |
| `updated_at` | TIMESTAMPTZ | Laatste wijziging |

### `households`
Een woning/huishouden. Alle data is gekoppeld aan een household.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `name` | VARCHAR(255) | Naam van de woning (bijv. "Bakker Woning") |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |
| `updated_at` | TIMESTAMPTZ | Laatste wijziging |

### `household_members`
Koppeling tussen users en households (multi-user support).

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `household_id` | UUID (FK) | Verwijzing naar household |
| `user_id` | UUID (FK) | Verwijzing naar auth.users |
| `role` | VARCHAR(20) | 'admin' of 'viewer' |
| `invited_at` | TIMESTAMPTZ | Wanneer uitgenodigd |
| `accepted_at` | TIMESTAMPTZ | Wanneer geaccepteerd |

---

## INTEGRATIES

### `integration_types`
Lookup tabel voor ondersteunde integraties.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `code` | VARCHAR(50) (PK) | 'hue', 'homey', 'home_assistant' |
| `name` | VARCHAR(100) | Display naam |
| `description` | TEXT | Beschrijving |
| `config_schema` | JSONB | JSON schema voor configuratie |

### `integrations`
Actieve integraties per household (bijv. Hue koppeling).

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `household_id` | UUID (FK) | Verwijzing naar household |
| `user_id` | UUID (FK) | User die koppeling maakte |
| `type` | VARCHAR(50) (FK) | Verwijzing naar integration_types |
| `name` | VARCHAR(100) | Naam (bijv. "Mijn Hue Bridge") |
| `config` | JSONB | Configuratie (tokens, bridge_username, etc.) |
| `status` | VARCHAR(20) | 'active', 'inactive', 'error' |
| `last_sync_at` | TIMESTAMPTZ | Laatste succesvolle sync |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |
| `updated_at` | TIMESTAMPTZ | Laatste wijziging |

### `hue_sync_log`
Logging van Hue sync operaties (voor debugging).

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `integration_id` | UUID (FK) | Verwijzing naar integration |
| `sync_type` | VARCHAR(20) | 'rooms', 'sensors', 'lights', 'full' |
| `status` | VARCHAR(20) | 'started', 'completed', 'failed' |
| `rooms_synced` | INT | Aantal gesyncte kamers |
| `items_synced` | INT | Aantal gesyncte items |
| `error_message` | TEXT | Foutmelding bij failure |
| `started_at` | TIMESTAMPTZ | Start tijd |
| `completed_at` | TIMESTAMPTZ | Eind tijd |

---

## WONING STRUCTUUR

### `rooms`
Kamers in de woning (gesynct vanuit Hue).

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `household_id` | UUID (FK) | Verwijzing naar household |
| `integration_id` | UUID (FK) | Verwijzing naar integration (Hue) |
| `name` | VARCHAR(100) | Naam van de kamer |
| `hue_group_id` | VARCHAR(50) | Hue group ID |
| `hue_class` | VARCHAR(50) | Hue room class ('living_room', 'bedroom', etc.) |
| `last_synced_at` | TIMESTAMPTZ | Laatste sync met Hue |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |
| `updated_at` | TIMESTAMPTZ | Laatste wijziging |

### `item_types`
Lookup tabel voor item types.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `code` | VARCHAR(50) (PK) | 'motion_sensor', 'contact_sensor', 'light', etc. |
| `name` | VARCHAR(100) | Display naam |
| `category` | VARCHAR(50) | 'sensor' of 'actuator' |
| `state_schema` | JSONB | JSON schema voor state |
| `value_schema` | JSONB | JSON schema voor values |

### `items`
Sensoren en lampen in de woning.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `household_id` | UUID (FK) | Verwijzing naar household |
| `integration_id` | UUID (FK) | Verwijzing naar integration |
| `room_id` | UUID (FK) | Verwijzing naar room (kan NULL zijn) |
| `type` | VARCHAR(50) (FK) | Verwijzing naar item_types |
| `name` | VARCHAR(100) | Naam van het item |
| `hue_unique_id` | VARCHAR(100) | Hue unique ID |
| `external_id` | VARCHAR(255) | Externe ID (voor andere integraties) |
| `location` | VARCHAR(100) | Locatie beschrijving (legacy) |
| `config` | JSONB | Configuratie (battery, modelid, etc.) |
| `state` | JSONB | Huidige state |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |
| `updated_at` | TIMESTAMPTZ | Laatste wijziging |

---

## RAW DATA

### `measurements`
**DE BRON VAN ALLE DATA.** Slaat ALLE sensor/lamp metingen op.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `item_id` | UUID (FK) | Verwijzing naar item (sensor/lamp) |
| `capability` | VARCHAR(50) | Wat wordt gemeten (zie onder) |
| `value` | JSONB | De gemeten waarde |
| `recorded_at` | TIMESTAMPTZ | Wanneer gemeten (van Hue API) |
| `created_at` | TIMESTAMPTZ | Wanneer opgeslagen in DB |

**Capabilities:**
- Sensors: `presence`, `temperature`, `lightlevel`, `dark`, `daylight`, `battery`, `reachable`, `contact`
- Lights: `on`, `brightness`, `color_temp`, `hue`, `saturation`, `reachable`
- Switches: `button_event`, `battery`

### `room_events`
Afgeleide events per kamer (voor snelle queries).

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `room_id` | UUID (FK) | Verwijzing naar room |
| `source` | VARCHAR(50) | 'motion', 'door', 'light' |
| `recorded_at` | TIMESTAMPTZ | Wanneer event plaatsvond |
| `created_at` | TIMESTAMPTZ | Wanneer opgeslagen |

---

## AGGREGATIES

### `room_hourly_stats`
Statistieken per kamer per uur (geaggregeerd van RAW data).

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `room_id` | UUID (FK) | Verwijzing naar room |
| `hour_start` | TIMESTAMPTZ | Start van het uur |
| `motion_count` | INT | Aantal bewegingsevents |
| `door_count` | INT | Aantal deurevents |
| `light_count` | INT | Aantal lichtevents |
| `total_events` | INT | Totaal events |
| `avg_temperature` | DECIMAL(4,1) | Gemiddelde temperatuur |
| `min_temperature` | DECIMAL(4,1) | Minimum temperatuur |
| `max_temperature` | DECIMAL(4,1) | Maximum temperatuur |
| `avg_lightlevel` | INT | Gemiddeld lichtniveau |
| `lights_on_minutes` | INT | Minuten licht aan |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |

### `room_daily_stats`
Statistieken per kamer per dag (geaggregeerd van hourly).

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `room_id` | UUID (FK) | Verwijzing naar room |
| `date` | DATE | Datum |
| `total_motion` | INT | Totaal bewegingsevents |
| `total_door` | INT | Totaal deurevents |
| `total_light` | INT | Totaal lichtevents |
| `total_events` | INT | Totaal alle events |
| `first_activity` | TIMESTAMPTZ | Eerste activiteit van de dag |
| `last_activity` | TIMESTAMPTZ | Laatste activiteit van de dag |
| `active_hours` | INT[] | Array van uren met activiteit [7,8,9,12,18] |
| `avg_temperature` | DECIMAL(4,1) | Gemiddelde temperatuur |
| `min_temperature` | DECIMAL(4,1) | Minimum temperatuur |
| `max_temperature` | DECIMAL(4,1) | Maximum temperatuur |
| `total_light_minutes` | INT | Totaal minuten licht aan |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |

---

## ALERTS

### `alerts`
Gegenereerde meldingen/waarschuwingen.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `household_id` | UUID (FK) | Verwijzing naar household |
| `type` | VARCHAR(50) | 'no_activity', 'unusual_pattern', 'low_battery', 'sensor_offline' |
| `severity` | VARCHAR(20) | 'info', 'warning', 'critical' |
| `title` | VARCHAR(255) | Korte titel |
| `message` | TEXT | Volledige bericht |
| `room_name` | VARCHAR(255) | Betreffende kamer |
| `sensor_id` | VARCHAR(255) | Betreffende sensor |
| `acknowledged` | BOOLEAN | Is gelezen/bevestigd |
| `acknowledged_by` | UUID (FK) | Wie heeft bevestigd |
| `acknowledged_at` | TIMESTAMPTZ | Wanneer bevestigd |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |

### `alert_settings`
Alert configuratie per household.

| Kolom | Type | Beschrijving |
|-------|------|--------------|
| `id` | UUID (PK) | Unieke identifier |
| `household_id` | UUID (FK) | Verwijzing naar household |
| `no_activity_threshold_minutes` | INT | Na hoeveel minuten inactiviteit alert (default: 120) |
| `quiet_hours_start` | TIME | Start stille uren (default: 23:00) |
| `quiet_hours_end` | TIME | Eind stille uren (default: 07:00) |
| `email_alerts` | BOOLEAN | Email notificaties aan |
| `push_alerts` | BOOLEAN | Push notificaties aan |
| `alert_emails` | TEXT[] | Array van email adressen |
| `created_at` | TIMESTAMPTZ | Aanmaakdatum |
| `updated_at` | TIMESTAMPTZ | Laatste wijziging |

---

## Database Functies

| Functie | Beschrijving |
|---------|--------------|
| `calculate_hourly_stats(hour)` | Bereken uurstatistieken voor alle kamers |
| `calculate_daily_stats(date)` | Bereken dagstatistieken voor alle kamers |
| `backfill_stats(days)` | Vul historische statistieken in |
| `add_measurement(item, cap, value, time)` | Voeg meting toe |
| `add_measurements_batch(json)` | Voeg batch metingen toe |
| `cleanup_old_measurements(days)` | Verwijder oude metingen |
| `get_current_household()` | Geef household van huidige user |

---

## Views

| View | Beschrijving |
|------|--------------|
| `latest_measurements` | Laatste meting per item/capability |
| `room_current_status` | Huidige status per kamer (voor dashboard) |

---

## Indexes

Belangrijke indexes voor performance:

- `idx_measurements_item_recorded` - Metingen per item+tijd
- `idx_measurements_capability_recorded` - Metingen per capability+tijd
- `idx_room_events_room` - Events per kamer
- `idx_room_events_recorded` - Events per tijd
- `idx_hourly_stats_room_time` - Uurstats per kamer+tijd
- `idx_daily_stats_room_date` - Dagstats per kamer+datum
