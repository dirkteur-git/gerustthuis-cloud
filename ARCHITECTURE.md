# GerustThuis - Tech Stack & Architectuur

## Frontend

| Component | Technologie | Versie |
|-----------|-------------|--------|
| Framework | Vue 3 | 3.5.x |
| Build Tool | Vite | 7.3.0 |
| State Management | Pinia | 3.0.4 |
| Routing | Vue Router | 4.6.4 |
| Styling | Tailwind CSS | 4.1.x |
| Icons | Lucide Vue Next | 0.562.0 |
| Form Validation | Vee-validate + Zod | 4.15.x |

## Backend

| Component | Technologie | Doel |
|-----------|-------------|------|
| Database | Supabase (PostgreSQL) | Data opslag, RLS security |
| Auth | Supabase Auth | OAuth, sessie management |
| Edge Functions | Supabase Functions (Deno) | Hue API proxy, token exchange |
| Hosting | Vercel | Frontend deployment, CDN |

## Integraties

| Systeem | API | Doel |
|---------|-----|------|
| Philips Hue | Remote API v1 + v2 | Sensoren, lampen, kamers |

---

## Data Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│                        HUE BRIDGE                           │
│  (sensoren, lampen, kamers)                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │ OAuth2 + REST API
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTIONS                   │
│  hue-token-exchange, hue-link-bridge, hue-api              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      VUE 3 FRONTEND                         │
│  Instellingen.vue → syncHueRooms()                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CORE                         INTEGRATIES                   │
│  ├── households               ├── integrations              │
│  ├── household_members        ├── hue_sync_log              │
│  └── profiles                 │                             │
│                               │                             │
│  WONING                       RAW DATA                      │
│  ├── rooms                    ├── measurements ◄── ALLES    │
│  └── items (sensors/lights)   └── room_events               │
│                                       │                     │
│                                       ▼                     │
│                               AGGREGATIES                   │
│                               ├── room_hourly_stats         │
│                               └── room_daily_stats          │
│                                       │                     │
│                                       ▼                     │
│                               ALERTS                        │
│                               ├── alerts                    │
│                               └── alert_settings            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
1. SYNC (handmatig of scheduled)
   Hue API → measurements (RAW: presence, temp, battery, on, brightness, etc.)
           → room_events (beweging, deur, licht aan)

2. AGGREGATIE (scheduled)
   measurements + room_events → room_hourly_stats (per uur)
   room_hourly_stats → room_daily_stats (per dag)

3. ANALYSE (scheduled)
   room_daily_stats → dag_vectors (patronen)
   dag_vectors → alerts (afwijkingen)
```

---

## Database Tabellen

### Core (Users & Woningen)

| Tabel | Beschrijving |
|-------|--------------|
| `profiles` | User profielen (naam, email, role). Extends auth.users |
| `households` | Woningen/accounts. Elke woning heeft eigen data |
| `household_members` | Koppelt users aan households met rol (admin/viewer) |

### Integraties

| Tabel | Beschrijving |
|-------|--------------|
| `integration_types` | Lookup: hue, homey, home_assistant |
| `integrations` | Gekoppelde integraties per household (Hue tokens etc) |
| `hue_sync_log` | Sync history voor debugging |

### Woning Structuur

| Tabel | Beschrijving |
|-------|--------------|
| `rooms` | Kamers uit Hue (met hue_group_id) |
| `item_types` | Lookup: motion_sensor, contact_sensor, light, etc |
| `items` | Sensoren + lampen, gekoppeld aan room |

### RAW Data

| Tabel | Beschrijving |
|-------|--------------|
| `measurements` | ALLE sensor/lamp metingen (presence, temp, brightness, etc) |
| `room_events` | Afgeleide events per kamer (motion, door, light) |

### Aggregaties

| Tabel | Beschrijving |
|-------|--------------|
| `room_hourly_stats` | Events en temperatuur per uur per kamer |
| `room_daily_stats` | Dagelijkse samenvatting per kamer |

### Alerts

| Tabel | Beschrijving |
|-------|--------------|
| `alerts` | Meldingen (no_activity, unusual_pattern, etc) |
| `alert_settings` | Alert configuratie per household |

---

## Security Model

- **Row Level Security (RLS)**: Alle tabellen beveiligd op household niveau
- **Multi-tenant**: Users zien alleen data van hun eigen household
- **OAuth2**: Hue authenticatie via Supabase Edge Functions (geen secrets in frontend)

---

## Folder Structuur

```
gerustthuis-cloud/
├── src/
│   ├── views/           # Pagina's (Dashboard, Status, Instellingen)
│   ├── components/      # UI componenten (Card, Button, Input)
│   ├── stores/          # Pinia stores (auth, dashboard)
│   ├── services/        # API services (supabase, hue, measurementService)
│   └── router/          # Vue Router configuratie
├── scripts/             # SQL migratie scripts
├── supabase/
│   └── functions/       # Edge Functions (Deno)
└── vercel.json          # Deployment config
```

---

## SQL Scripts (volgorde)

1. `000_base_schema.sql` - Basis tabellen
2. `001_households.sql` - Multi-tenant structuur
3. `002_hue_rooms.sql` - Hue specifieke kolommen
4. `007_alerts.sql` - Alert systeem
5. `020_measurements_schema.sql` - RAW data opslag
6. `021_aggregation_functions.sql` - Aggregatie functies

---

## Environment Variables

### Frontend (Vite)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_HUE_CLIENT_ID=xxx
VITE_HUE_CLIENT_SECRET=xxx
VITE_HUE_REDIRECT_URI=https://app.sensor.care/hue/callback
```

### Vercel
Zelfde als frontend, plus eventuele server-side secrets.
