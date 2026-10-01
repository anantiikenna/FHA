# FHA Development Approval & Property Mapping System

MVP web application for the Federal Housing Authority — plot inspection, approval tracking, and GIS estate mapping.

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, TypeScript 5
- **Backend:** Next.js API routes, Supabase (Auth + PostgreSQL + PostGIS)
- **Maps:** MapLibre GL 5, MapLibre-Geoman (drawing), Esri World Imagery (satellite)
- **Deploy:** Netlify

## Getting Started

```bash
cd web
cp ../.env.example .env.local   # fill in Supabase keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |

## Documentation

| Document | Purpose |
|---|---|
| [SYSTEM_WALKTHROUGH.md](SYSTEM_WALKTHROUGH.md) | **Complete as-built system details** — pages, APIs, roles, demo path |
| [AGENTS.md](AGENTS.md) | AI agent instructions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [DATABASE.md](DATABASE.md) | Schema docs |
| [SECURITY.md](SECURITY.md) | Security policy |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploy guide |
| [WORKFLOWS.md](WORKFLOWS.md) | Business workflows |
| [AUTHORIZATION_RBAC.md](AUTHORIZATION_RBAC.md) | Roles & permissions |

## Project Structure

```
FHA/
├── supabase/
│   ├── Schema.sql          # Full DB schema (fresh install)
│   ├── live_update.sql     # Incremental migrations (safe to re-run)
│   ├── mock_data.sql       # Demo seed data
│   └── drop_mock_data.sql  # Remove demo data
├── web/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages + API routes
│   │   ├── components/     # UI + Map components
│   │   └── lib/            # Supabase client, helpers, types
│   └── package.json
├── SYSTEM_WALKTHROUGH.md    # Complete system walkthrough (as-built)
├── AGENTS.md                # AI agent instructions
├── ARCHITECTURE.md          # System architecture
├── DATABASE.md              # Schema docs
├── SECURITY.md              # Security policy
└── DEPLOYMENT.md            # Deploy guide
```

## Features

- **Email PIN login** (OTP, no passwords)
- **GIS estate map** with plot markers, satellite toggle, location search
- **Interactive drawing** — draw polygons/rectangles for inspection zones
- **Nested map areas** — shapes drawn fully inside an existing area save as a child at any depth (zone → sub-area → sub-sub-area → …)

### Note: deleting areas cascades

Deleting a zone or sub-area **removes its entire nested subtree** (child → grandchild → …, all depths). The confirmation dialog shows how many sub-areas will be removed, and the map then hides/removes every nested area along with its parent.

> This cascade behaviour may be hidden or removed in a future version — confirm the current behaviour in [SYSTEM_WALKTHROUGH.md](SYSTEM_WALKTHROUGH.md) before relying on it.
- **Dual-status tracking** — inspection status + approval status per plot
- **Role-based access** — Engineer, Supervisor, Approval Officer, GIS Officer, Admin
- **Approval verification** with recorded findings
- **Site inspections** — GPS capture, photo upload, observations
- **Approved vs Observed** comparison with discrepancy flagging
- **Audit trail** for all status changes
- **Admin user management**

## Database

SQL files live in `supabase/`. Two files only:

- `Schema.sql` — run once for fresh install
- `live_update.sql` — safe to re-run on existing DB

After schema setup, run `mock_data.sql` for demo data.

## Environment Variables

See `.env.example`. Never commit real keys.

## Demo Data

All data is fictional. Labelled:

> **DEMO / SAMPLE DATA — NOT AN OFFICIAL FHA RECORD**

Reset with `supabase/drop_mock_data.sql`, reseed with `supabase/mock_data.sql`.

## License

Internal — Federal Housing Authority.
