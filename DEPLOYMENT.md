# DEPLOYMENT.md
# FHA Development Approval & Property Mapping System
## MVP Deployment & Environment Specification

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Architecture:** `ARCHITECTURE.md:35-36`  
**Database:** `DATABASE.md`  
**GIS:** `GIS.md:31-32`  
**API:** `API.md:4`  
**Security:** `SECURITY.md:40-41`  
**Authorization:** `AUTHORIZATION_RBAC.md`  
**Data Dictionary:** `DATA_DICTIONARY.md`  
**Workflows:** `WORKFLOWS.md`  
**Build Plan:** `MVP_BUILD_PLAN.md`  
**AI Instructions:** `AGENTS.md:34`

---

## 1. PURPOSE

This document defines how the FHA MVP prototype is built, configured, deployed, and operated across environments. It translates `ARCHITECTURE.md:51` implementation order and `SECURITY.md:40` environment separation into an actionable deployment guide.

It is a **prototype deployment specification** — not an official FHA IT deployment standard. Host, network, data-residency, and hosting-provider decisions must be confirmed by FHA IT before production.

**Demo-data rule (applies to every environment):** `AGENTS.md:4` and `DATABASE.md:25`

```text
DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD
```

---

## 2. ENVIRONMENTS

`ARCHITECTURE.md:36` and `SECURITY.md:40`

```text
Development  →  Staging / Demonstration  →  Production
```

| Environment | Purpose | Data | Host example | Access |
|---|---|---|---|---|
| `development` | Local engineering | `is_demo=true` synthetic only | `localhost:3000` | Developers only |
| `staging` / `demo` | FHA demonstration (`MVP_BUILD_PLAN.md:47`) | Deterministic seed — Estate FHA Demo Estate / Blocks A-C / 20 plots (`DATABASE.md:38`, `MVP_BUILD_PLAN.md:6`) | Vercel Preview / FHA staging VM | Authenticated FHA reviewers |
| `production` | Future FHA operations | **No demo data** — FHA-sourced only | FHA-approved infra (`ARCHITECTURE.md:35`) | FHA staff via FHA network / VPN |

> Never connect the prototype to a production FHA database (`SECURITY.md:40`). Demo data must never enter production (`ARCHITECTURE.md:36`).

---

## 3. TECHNOLOGY STACK

| Layer | Choice (MVP) | Notes | Ref |
|---|---|---|---|
| Frontend | Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui | `ARCHITECTURE.md:5-6` | - |
| Backend / API | Next.js Route Handlers (`/api/v1/*`) | `API.md:4`, `AGENTS.md:21` | - |
| Database | Supabase Postgres 15 + PostGIS | `DATABASE.md:3`, `ARCHITECTURE.md:17` | - |
| Auth | Supabase Auth | `SECURITY.md:5`, `AGENTS.md:13` | - |
| Storage | Supabase Storage (private buckets) | `ARCHITECTURE.md:20`, `DATABASE.md:16,18` | - |
| Map rendering | MapLibre GL JS (adapter pattern) | `GIS.md:31-32` | - |
| Basemap | OpenStreetMap / Stadia / FHA-provided tiles | `GIS.md:31` | - |

Provider-adapter isolation is required so the basemap/GIS/storage/auth providers can be swapped for FHA-approved alternatives (`ARCHITECTURE.md:48`).

---

## 4. PREREQUISITES

- Node.js 20 LTS + pnpm/npm
- Supabase CLI (`supabase --version`)
- PostGIS enabled in Postgres (`DATABASE.md:3`)
- Git
- Map tile provider key (if required)
- HTTPS-capable host for staging/prod (`SECURITY.md:22`)

Verify:

```powershell
node --version
supabase --version
psql --version
```

---

## 5. REPOSITORY LAYOUT (DEPLOYMENT RELEVANT)

```text
/
├── apps/web/                 # Next.js application
│   ├── app/(auth)/login/          # WORKFLOWS.md:4
│   ├── app/(dashboard)/map/       # GIS.md:52
│   ├── app/api/v1/               # API.md:4,57
│   ├── components/map/           # UI_UX.md:49
│   └── lib/supabase/
├── supabase/
│   ├── config.toml
│   ├── migrations/           # DATABASE.md:47 — version controlled
│   ├── seed.sql              # DATABASE.md:38 — deterministic
│   └── storage.sql
├── .env.example              # AGENTS.md:28 — placeholders only
└── DEPLOYMENT.md             # this file
```

---

## 6. ENVIRONMENT VARIABLES

`AGENTS.md:28` and `SECURITY.md:39` — never commit secrets.

### 6.1 `.env.example` (commit this)

```env
# Supabase — public (client)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAP_STYLE_URL=

# Supabase — server only (never expose to client)
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_DEMO_DATA_BANNER=true

# Optional
MAP_PROVIDER_KEY=
SENTRY_DSN=
```

### 6.2 Per-environment matrix

| Variable | `development` | `staging` | `production` |
|---|---:|---:|---:|
| `NEXT_PUBLIC_SUPABASE_URL` | local `http://127.0.0.1:54321` | staging project | FHA project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local anon | staging anon | prod anon |
| `SUPABASE_SERVICE_ROLE_KEY` | local service_role | staging secret | prod secret (vault) |
| `SUPABASE_DB_URL` | local postgres | staging postgres | prod postgres |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://fha-demo.example.com` | `https://fha.gov.ng` (TBD) |
| `NEXT_PUBLIC_APP_ENV` | `development` | `staging` | `production` |
| `NEXT_PUBLIC_DEMO_DATA_BANNER` | `true` | `true` | `false` |

Staging/production secrets must be injected via host secrets manager (Vercel Env / Azure Key Vault / AWS Secrets Manager) — never `.env` files (`SECURITY.md:39`).

---

## 7. LOCAL DEVELOPMENT

```powershell
# 1. Clone & install
git clone <repo> && cd FHA
npm install   # or pnpm install

# 2. Configure
Copy-Item .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL / ANON_KEY from supabase start

# 3. Start Supabase (Postgres + PostGIS + Auth + Storage)
supabase start

# 4. Apply migrations + seed (DATABASE.md:47,38)
supabase db reset   # runs supabase/migrations/* + supabase/seed.sql

# 5. Run web
npm run dev
# → http://localhost:3000  (AGENTS.md:32 definition of done: UI+server+DB+validation+auth)
```

Seed is deterministic (`MVP_BUILD_PLAN.md:7`): 1 estate → 3 blocks → 20 plots → interests → applications → approvals → documents → inspections → photos → findings → audit_logs. Reset is dev-only, never exposed publicly (`DATABASE.md:39`).

---

## 8. DATABASE — MIGRATIONS & GIS

### 8.1 Migrations

`DATABASE.md:47`

```powershell
supabase migration new add_estates_blocks_plots
# edit supabase/migrations/<timestamp>_add_estates_blocks_plots.sql
supabase db reset   # verify locally
```

Chain: `users → estates → blocks → plots → property_interests → applications → approvals → documents → inspections → inspection_photos → inspection_findings → audit_logs` (`DATABASE.md:5`, `ARCHITECTURE.md:18`).

All spatial columns: `geometry(Polygon,4326)` or `geography` with `GIST` index (`DATABASE.md:11.2`, `DATABASE.md:34`). CRS documented in `GIS.md:11-12`.

### 8.2 Storage buckets (private)

`ARCHITECTURE.md:20`, `SECURITY.md:26`

```sql
-- supabase/storage.sql
insert into storage.buckets (id, name, public) values
  ('documents', 'documents', false),
  ('inspection-photos', 'inspection-photos', false);
```

Access via signed URLs after `document.read` / `inspection.read` authorization (`API.md:24`, `SECURITY.md:27`).

---

## 9. BUILD

```powershell
npm run lint          # AGENTS.md template — mandatory audit
npm run typecheck     # tsc --noEmit
npm run test          # TESTING.md:3 levels
npm run build         # Next.js production build
npm run start         # serve build locally
```

Build must pass with zero type errors before any deploy (`AGENTS.template.md` audit phase).

---

## 10. DEPLOYMENT TARGETS

### 10.1 Staging / Demo (recommended: Vercel)

```powershell
# One-time
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL      # staging
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
# push → preview deploy per PR; main → staging
```

Vercel config: `framework: nextjs`, `regions: auto`, `env: staging`, `headers: SECURITY.md:23`.

### 10.2 FHA Self-Hosted (Docker — for FHA IT review)

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npm","run","start"]
```

```powershell
docker build -t fha-mvp:0.1 -f apps/web/Dockerfile .
docker run -p 3000:3000 --env-file .env.staging fha-mvp:0.1
```

Production host must satisfy `ARCHITECTURE.md:35` — FHA network, TLS termination, WAF, backup, and data-residency requirements (TBD with FHA IT: `ARCHITECTURE.md:49`).

### 10.3 Do not assume public cloud is acceptable

`ARCHITECTURE.md:35` — confirm with FHA IT before any production cloud choice. Prototype staging on Vercel is acceptable; production may require on-premises or government-approved cloud.

---

## 11. CI/CD

Recommended pipeline (GitHub Actions):

```yaml
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
      - run: supabase db reset --dry-run  # migration check
```

Gates: lint + typecheck + build + migration dry-run must pass; secrets scan (no `.env` committed — `AGENTS.md:28`); preview deploy only after gates pass.

---

## 12. SECURITY HARDENING (DEPLOYMENT)

Per `SECURITY.md:23,22,21,41` and `ARCHITECTURE.md:33`:

- **HTTPS only** in staging/prod; HSTS enabled.
- **Security headers** (in `next.config.js`):

```js
headers: [{ source: '/(.*)', headers: [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self)' },
]}]
```

CSP must be tested against MapLibre and Supabase (`SECURITY.md:23` — do not blindly break functionality).

- **CORS:** deny `*` for `/api/v1/*` (`SECURITY.md:21`, `API.md:37`).
- **Rate limiting:** login / search / map viewport / document access / uploads (`API.md:41`, `SECURITY.md:57`).
- **File validation:** type + size + filename + storage destination on server (`SECURITY.md:24`); never trust client MIME.
- **Auth:** httpOnly + Secure + SameSite cookies; session expiry/revocation (`SECURITY.md:6,49`).
- **Logging:** never log passwords/tokens/PII (`SECURITY.md:50`); audit append-only (`SECURITY.md:36`).

---

## 13. GIS DEPLOYMENT

`GIS.md:31-32,10-12` and `ARCHITECTURE.md:14-16`

- Demo tiles: OSM/Stadia; production tiles: FHA-approved source.
- `Map Adapter` isolates provider (`GIS.md:32`) — changing tiles requires only adapter change.
- Import pipeline for future FHA data: `GIS.md:10` (validate CRS → geometry → plot_id → match → publish; `DATABASE.md:41`).
- CRS must be documented per dataset; never silently mix CRS (`GIS.md:12`, `DATABASE.md:30`).

---

## 14. BACKUP & RECOVERY

`ARCHITECTURE.md:37`, `DATABASE.md:44`, `SECURITY.md:42-43`

| Asset | MVP (staging) | Production (target) |
|---|---|---|
| Postgres | Supabase daily PITR | Automated + verified + tested restore + retention per FHA policy (`DATABASE.md:44`) |
| Storage (documents/photos) | Supabase bucket replication | Versioned, encrypted, access-controlled |
| GIS source files | Repo-tracked demo GeoJSON | Protected raw + converted datasets (`SECURITY.md:54`) |

Backups are sensitive — encrypt + access-control (`SECURITY.md:43`).

---

## 15. OBSERVABILITY

`ARCHITECTURE.md:38`, `SECURITY.md:58`

- App errors + API errors + auth failures → Sentry / host logs (no PII).
- Map/GIS failures + upload failures tracked separately.
- Audit events: `LOGIN, VIEW_PLOT, VIEW_APPROVAL, VIEW_DOCUMENT, CREATE_INSPECTION, SUBMIT_INSPECTION` (`SECURITY.md:35`, `WORKFLOWS.md:34`, `API.md:49`).

---

## 16. ROLLBACK

- Vercel: instant rollback to previous deployment (atomic).
- Docker/self-hosted: `docker pull fha-mvp:<prev-tag> && docker run` + `supabase migration down` only if migration is reversible (`DATABASE.md:47`). Demo data reset is destructive — never auto-run in prod.

---

## 17. DEMO vs PRODUCTION — HARD SEPARATION

`DATABASE.md:25`, `ARCHITECTURE.md:36`

- `is_demo` flag + separate Supabase projects. Production import pipeline (`DATABASE.md:40-41`) validates before publish.
- Staging banner: `NEXT_PUBLIC_DEMO_DATA_BANNER=true` renders `UI_UX.md:52` watermark.
- No migration may copy demo records to prod; prod seed is empty.

---

## 18. DEPLOYMENT CHECKLIST

Before any demo to FHA (`TESTING.md:43`, `MVP_BUILD_PLAN.md:47`):

- [ ] `npm run lint && npm run typecheck && npm run build` — zero errors
- [ ] `supabase db reset` — migrations + deterministic seed restore Plot 003 correctly (`WORKFLOWS.md:35`)
- [ ] Map renders estate → blocks → plot polygons + labels + highlight (`GIS.md:61`)
- [ ] Plot search (`API.md:13,17`) centers map and opens Plot Details
- [ ] Approval verification shows `RECORD_FOUND / RECORD_NOT_FOUND` not `ILLEGAL` (`WORKFLOWS.md:6`, `AGENTS.md:7`)
- [ ] Document access requires auth + signed URL (`SECURITY.md:27`)
- [ ] Inspection create → GPS capture → photo upload → comparison (`POTENTIAL_DISCREPANCY`) → submit → history (`WORKFLOWS.md:35`)
- [ ] GPS handles `permission_denied / unavailable / low_accuracy` (`UI_UX.md:26`)
- [ ] Headers: HSTS + CSP + X-Content-Type-Options + Referrer-Policy (`SECURITY.md:23`)
- [ ] CORS restricted, rate limits active (`SECURITY.md:57`, `API.md:41`)
- [ ] No `.env` committed, no secrets in client bundle (`SECURITY.md:39`)
- [ ] `DEMO / SAMPLE DATA` banner visible wherever synthetic data appears
- [ ] Audit event created for `CREATE_INSPECTION` / `SUBMIT_INSPECTION` (`DATABASE.md:19`)
- [ ] Rollback tested (previous deploy restores in <2 min)

---

## 19. FHA HANDOFF QUESTIONS (BEFORE PRODUCTION DEPLOY)

From `ARCHITECTURE.md:49`, `GIS.md:59`, `WORKFLOWS.md:46`:

1. Host: FHA data center / gov cloud / public cloud — which is approved?
2. Network: VPN / intranet / public internet?
3. Auth provider: Supabase Auth vs FHA AD / SSO?
4. Data residency & retention policy?
5. GIS source format, CRS, update cadence, authoritative system?
6. Backup retention & DR RTO/RPO?
7. Audit-log retention & access policy?
8. Public verification portal — in or out of scope?

Do not finalize production deploy until these are answered.

---

**END OF DEPLOYMENT.md**
