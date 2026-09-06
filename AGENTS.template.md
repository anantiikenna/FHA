# AI Agents Configuration — [PROJECT NAME]

> **Purpose:** This file tells AI agents how to work in this codebase. Every agent MUST read this file before making changes. Update this file when the project evolves.

---

## Project Overview

- **Name:** [PROJECT NAME]
- **Description:** [One sentence]
- **Stack:** [e.g., Next.js + Flutter + Supabase]
- **Monorepo:** [Yes/No — describe workspace layout]
- **Domain:** [e.g., Healthcare, Fintech, E-commerce]

---

## Project Architecture

### Directory Structure
```
/
├── apps/
│   ├── web/          # [Framework, e.g., Next.js 16]
│   └── mobile/       # [Framework, e.g., Flutter]
├── packages/         # [Shared libraries]
├── supabase/         # [Database schema, migrations]
│   ├── schema.sql    # Single source of truth for DB
│   └── update_live.sql  # Cumulative live migrations
└── AGENTS.md         # This file
```

### Tech Stack
| Layer | Technology | Notes |
|---|---|---|
| **Frontend (Web)** | [e.g., Next.js 16] | [Key config] |
| **Frontend (Mobile)** | [e.g., Flutter] | [Key config] |
| **Backend** | [e.g., Supabase] | [Auth, DB, Storage, Realtime] |
| **Database** | [e.g., PostgreSQL] | [RLS enabled] |
| **Push Notifications** | [e.g., FCM] | [Server-side only] |
| **Email** | [e.g., Loops/Resend/SendGrid] | [Transactional] |
| **Deployment (Web)** | [e.g., Netlify/Vercel] | [CI/CD] |
| **Deployment (Mobile)** | [e.g., Firebase App Distribution] | [Flavors] |
| **Payments** | [e.g., Stripe/Manual P2P] | [Status] |

---

## Context for Agents

### What You Must Know Before Changing Code

1. **Data flows through multiple layers.** A change to the database schema affects Supabase, the web API, and the mobile client. Always check all three.
2. **RLS is the primary security boundary.** Application code can have bugs. RLS policies cannot be bypassed by application bugs. Always verify RLS when touching data access.
3. **Realtime is event-driven.** Many features depend on Supabase Realtime subscriptions. Adding a new table or column for real-time sync requires adding it to the Realtime publication and setting `REPLICA IDENTITY FULL`.
4. **Secrets have strict boundaries.** Server-side keys (Firebase Admin SDK, payment gateway keys, service role keys) MUST NEVER exist in client-side code. Mobile never holds server credentials.
5. **Admin is isolated.** Admin users are blocked from patient/doctor interfaces at multiple layers. Never route admin users through patient/doctor flows.

### API Security Pattern
Every API route MUST use the security wrapper:
```
// ALWAYS
withSecurity(handler) → extracts sessionUser from JWT → enforces role check

// NEVER
raw handler → reads userId from request body → trusts client-supplied data
```

### Session Handling
- **Authentication Method:** Email verification PIN/token (OTP). The app does NOT use passwords. Users enter their email, receive a 6-digit PIN, and verify it to log in.
- Web: Use the proxy/middleware to validate sessions on every request. **Performance Rule**: Exclude API routes from middleware matcher and cache user roles in cookies to prevent redundant DB queries.
- Mobile: Use Supabase client with anon key + RLS only
- Never store session tokens in localStorage on web (use httpOnly cookies)
- **Inactivity Timeout**: Implement an auto-logout mechanism (e.g., 15 minutes) based on user interaction (pointer/keyboard events) to comply with healthcare and security standards.
- **Password-related features are NOT applicable.** Do not implement password change, password reset, or leaked password protection — the app uses email OTP only.

---

## Compliance & Regulatory

### [HIPAA / GDPR / SOC 2 / PCI-DSS / CCPA — Pick what applies]

| Requirement | Status | Notes |
|---|---|---|
| Access Controls | [Implemented/Partial/Needed] | [How] |
| Inactivity Timeout | [Implemented/Needed] | [Auto-logout duration, e.g., 15 mins] |
| Encryption in Transit | [Implemented] | [TLS] |
| Encryption at Rest | [Inherited/Implemented] | [Provider] |
| Audit Logging | [Implemented/Partial/Needed] | [What's logged] |
| Right to Erasure | [Implemented/Needed] | [Deletion flow] |
| Data Export | [Implemented/Needed] | [Format] |
| Consent Collection | [Implemented/Needed] | [At signup] |
| BAA | [Executed/Needed] | [Provider] |
| Breach Notification | [Documented/Needed] | [Timeframe] |

**Agent rules for compliance:**
- Never log PHI/PII to console or log files
- Never store sensitive data in localStorage/SharedPreferences/cookies
- Never share user data with third parties without explicit opt-in
- Never add tracking without consent
- Always provide users a way to view and export their data
- Never hardcode patient/user IDs in client-visible URLs

---

## Security Posture

### Threat Model
| Threat | Mitigation |
|---|---|
| SQL Injection | Use parameterized queries (Supabase does this) |
| XSS | Sanitize all API inputs (e.g., DOMPurify) |
| CSRF | JWT in headers, SameSite cookies |
| IDOR | RLS ensures users access only their own rows |
| Privilege Escalation | Role checks at DB + API + UI layers |
| Session Hijacking | Refresh token rotation, session validation |
| Data Leakage | Private storage buckets, role-gated access |
| Credential Stuffing | N/A — app uses email OTP, not passwords |

### Secrets Management
| Secret | Location | NEVER |
|---|---|---|
| [Service Role Key] | [Server .env ONLY] | Never in client/mobile code |
| [Admin SDK Key] | [Server .env ONLY] | Never in mobile workspace |
| [Payment Keys] | [Server .env ONLY] | Never in client bundles |
| [Anon Key] | [Client bundles OK] | Never expose to server admin ops |

**Agent rule:** Before adding any credential: "Is this public or secret?" Public keys go in client bundles. Secret keys stay in server-only `.env` files and are never imported in client components.

### Mobile Security Boundary
- Mobile NEVER holds server-side credentials
- Mobile dispatches sensitive operations via web API
- Mobile uses anon key + RLS only

---

## Engineering Discipline

### Code Review Policy
- All changes require review before merge
- Security-sensitive changes require [1/2] reviewer(s)
- Agent-generated code follows the same review process

### Testing Strategy
| Layer | Tool | What to Test |
|---|---|---|
| Unit | [Jest/Vitest/Dart test] | Business logic, data transforms |
| Component | [React Testing Library/Flutter widget tests] | UI rendering, interactions |
| Integration | [Playwright/Cypress/Flutter integration] | End-to-end flows |
| API | [curl/Postman/Supabase SQL Editor] | RLS policies, RPCs |
| Security | Manual review | RLS bypass, role escalation |

**Agent rule:** Check for existing test patterns before adding tests. Match the existing framework. Never remove existing tests.

### CI/CD Gates
- All linters must pass (`npm run lint`, `flutter analyze`)
- All type checks must pass (`tsc --noEmit`, `dart analyze`)
- Build must succeed
- No secrets in committed files
- No hardcoded URLs — use environment variables
- No `console.log`/`print()` with sensitive data in production

### Mandatory Audit Phase (Every Task)
Before marking ANY task as complete, agents MUST complete this verification sequence:

**Web (Next.js):**
1. Run `npm run typecheck` (or `npx tsc --noEmit`) — zero errors required
2. Run `npm run lint` (or `npx eslint src/`) — zero warnings required
3. Run `npm run build` — clean build required
4. Verify no regressions in related components (check imports, shared types)

**Mobile (Flutter):**
1. Run `flutter analyze` — zero errors required
2. Run `flutter test` — all tests pass
3. Run `flutter build apk --flavor user --debug` (or `flutter build ios`) — clean build
4. Verify no regressions in related widgets/screens

**Database (Supabase):**
1. If schema changed: verify `GRANT` statements exist for new tables
2. If new table: verify RLS policies cover all CRUD operations
3. If Realtime needed: verify `REPLICA IDENTITY FULL` and publication membership
4. Run affected queries in Supabase SQL Editor to verify RLS enforcement

**Cross-cutting checks:**
- [ ] No hardcoded URLs — use environment variables
- [ ] No secrets in client-side code
- [ ] No PHI/PII in console/logs
- [ ] All new API routes wrapped in `withSecurity`
- [ ] All new database tables have RLS + GRANTs
- [ ] CSS uses CSS variables (not hardcoded colors) for dark mode support
- [ ] Stream subscriptions stored and cancelled in `dispose()`/cleanup
- [ ] Error handling: no empty catch blocks — log or surface errors

**Agent rule:** Never claim a task is "done" without running the audit phase. If the analyzer/linter/build tool hangs, flag the issue to the user rather than skipping verification.

### Mandatory Walk-Through (Every User-Facing Change)
After completing any change that affects the user experience, agents MUST perform an end-to-end walk-through of the affected flow:

**Before walk-through:**
- [ ] Dev server is running (`npm run dev` for web, `flutter run` for mobile)
- [ ] You are logged in as the relevant role (patient, doctor, admin)
- [ ] Database has test data covering the changed feature

**Walk-through checklist:**
1. **Entry point** — How does the user reach this feature? (URL, button, notification, deep link)
2. **Happy path** — Complete the primary action from start to finish without errors
3. **Loading states** — Verify spinners/skeletons appear while data loads
4. **Empty states** — Verify the UI handles no-data gracefully (not a blank screen or crash)
5. **Error states** — Trigger a failure (invalid input, network error) and verify friendly error messages
6. **Role-based access** — Verify the feature works for each authorized role and blocks unauthorized roles
7. **Mobile responsiveness** — If web, verify the layout works on mobile viewport (375px width)
8. **Dark mode** — If CSS variables were changed, verify both light and dark themes render correctly
9. **Real-time** — If applicable, open two browser tabs/devices and verify changes sync live
10. **Navigation** — Verify back buttons, breadcrumbs, and redirects work correctly
11. **Session** — Verify the feature handles expired sessions gracefully (redirect to login, not a crash)

**Document the walk-through:**
```markdown
### Walk-Through: [Feature Name]
- **Entry Point:** [How I reached the feature]
- **Happy Path:** [Pass/Fail — notes]
- **Empty State:** [Pass/Fail/N/A]
- **Error State:** [Pass/Fail — notes]
- **Role Access:** [Which roles tested]
- **Dark Mode:** [Pass/Fail/N/A]
- **Real-Time:** [Pass/Fail/N/A]
- **Issues Found:** [List any bugs discovered during walk-through]
```

**Agent rule:** If the walk-through reveals a bug, fix it before marking the task complete. Document any known limitations or follow-up items.

### Error Handling Convention
```
User-facing errors: Friendly message via toast/snackbar
Internal errors: Log with context (never expose stack traces)
Security errors: Return generic "Unauthorized" (never reveal why)
Database errors: Never expose raw error messages to client
```

**Agent rule:** Every `catch` block must handle the error. Never swallow silently. Never expose internals to users.

### Dependency Management
- Pin major versions
- Audit dependencies monthly (`npm audit`, `dart pub outdated`)
- Never add a dependency without checking if functionality already exists
- Prefer built-in SDK methods over third-party packages
- Document major dependencies in this file

### Naming Conventions
| Element | Convention | Example |
|---|---|---|
| Files (JS/TS) | `camelCase` / `kebab-case` | `userService.ts`, `user-profile.tsx` |
| Files (Dart) | `snake_case` | `user_service.dart` |
| Database tables | `snake_case`, plural | `user_profiles`, `forum_posts` |
| Database columns | `snake_case` | `created_at`, `user_id` |
| Enums | `snake_case` values | `emergency_request`, `action_taken` |
| React components | `PascalCase` | `UserProfile`, `BookingCard` |
| Dart widgets | `PascalCase` | `UserProfileScreen` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Functions | `camelCase` | `getUserProfile` |

### Git Conventions
- Commit messages: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`
- Never commit `.env` files or secrets
- Branch naming: `feature/description`, `fix/description`
- Always run lint/typecheck before committing

---

## Data Architecture

### Database Schema — SQL File Management Rule

**Only two SQL files are maintained for schema management:**

```
supabase/Schema.sql       → Fresh install (full schema from scratch)
supabase/live_update.sql  → Existing DB  (safe incremental migration)
```

#### Schema.sql
- Contains the complete database schema for a new installation
- Includes: extensions, enums, tables, indexes, RLS policies, triggers, functions
- Run once when setting up a new database
- After running, execute `mock_data.sql` for demo data

#### live_update.sql
- Safe to re-run on an existing database
- Uses `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and exception handling (`EXCEPTION WHEN duplicate_object THEN NULL`)
- Adds new enums, columns, tables, RLS, triggers, indexes
- Migrates existing data when adding new columns

#### Mock data files
```
supabase/mock_data.sql     → Demo/seed data (run after Schema.sql)
supabase/drop_mock_data.sql → Removes demo data (keeps schema)
```

#### What NOT to do
- Do NOT create standalone migration files (e.g., `003_add_feature.sql`)
- Do NOT create numbered migration files (e.g., `001_initial.sql`, `002_rls.sql`)
- Do NOT create temporary migration files for individual features
- Every schema change goes into **Schema.sql** (fresh) AND **live_update.sql** (incremental)

#### Pattern for adding a new feature to SQL

When adding a new table/column/enum:

1. **Schema.sql** — add the full definition in the correct section (enums, tables, RLS, triggers)
2. **live_update.sql** — add the incremental version with `IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION` blocks, and data migration
3. **mock_data.sql** — add demo data if applicable
4. **drop_mock_data.sql** — add cleanup if applicable

#### Example: adding a new table

**In Schema.sql:**
```sql
-- Enum
create type public.new_status as enum ('A','B','C');

-- Table
create table public.new_table (
  id uuid primary key default gen_random_uuid(),
  ...
);
create index idx_new_table_id on public.new_table(id);

-- RLS
alter table public.new_table enable row level security;
create policy "new_table_select_auth"
  on public.new_table for select to authenticated using (true);

-- Trigger
create trigger set_updated_at before update on public.new_table
  for each row execute function public.handle_updated_at();
```

**In live_update.sql:**
```sql
DO $$
BEGIN
  CREATE TYPE public.new_status AS ENUM ('A','B','C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.new_table (...);

ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "new_table_select_auth"
    ON public.new_table FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.new_table
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

### Data Flow Pattern
```
User Action → Client UI → API/SDK → Database (RLS enforced) → Realtime (if applicable) → Other Clients
```

### Realtime Requirements
For any table that needs real-time sync:
1. Add `REPLICA IDENTITY FULL`
2. Add to `supabase_realtime` publication
3. Add RLS policies for `SELECT` (authenticated users)
4. Add client-side subscription filtering by relevant ID

---

## Error & Incident Protocol

### When You Find a Bug
1. **Check if it's a security issue** (auth bypass, data leak, privilege escalation)
2. **Check if it affects data integrity** (wrong writes, missing validation)
3. **Check if it affects real-time sync** (stale data, missing events)
4. **Fix the root cause**, not the symptom
5. **Update CHANGELOG.md** with the fix
6. **Verify the fix** with tests or manual verification

### When You're Unsure
1. Read the existing code patterns in similar files
2. Check `CHANGELOG.md` for context on past decisions
3. Search for related issues in git history
4. Ask the user for clarification — don't guess on security-critical decisions

---

## Monitoring & Alerting
| System | Where to Check |
|---|---|
| Web build errors | [e.g., Vercel/Netlify dashboard] |
| Database errors | [e.g., Supabase Dashboard → Logs] |
| Push notification delivery | [e.g., Firebase Console → Cloud Messaging] |
| Mobile crashes | [e.g., Firebase Crashlytics] |
| API errors | [e.g., Server logs, Sentry] |

---

## Data Retention & Deletion
| Data Type | Retention | Deletion |
|---|---|---|
| User profiles | Until account deletion | Cascade delete |
| [Domain-specific data] | [Duration] | [Method] |
| Audit logs | [7 years recommended] | Never delete |
| Session data | [90 days] | Auto-cleanup |

---

## Compliance Certification Path
1. **Document** — This file IS your documentation baseline
2. **Implement** — Technical controls (RLS, encryption, audit logs)
3. **Verify** — Test controls, run security reviews
4. **Certify** — Engage auditor for SOC 2 / HIPAA / ISO 27001
5. **Maintain** — Update this file when controls change

---

## Agent Workflow Checklist

When starting ANY task in this codebase:

- [ ] Read this `AGENTS.md` file
- [ ] Read `CHANGELOG.md` for recent context
- [ ] Identify affected files across all layers (DB → API → UI)
- [ ] Check existing patterns in similar files
- [ ] Verify RLS policies if touching data access
- [ ] Check secrets boundary (server vs client)
- [ ] Run lint/typecheck before committing
- [ ] Update `CHANGELOG.md` if the change is user-facing
- [ ] Never commit secrets or PHI
- [ ] **Run the mandatory audit phase** (see "Mandatory Audit Phase" above)
- [ ] **Run the mandatory walk-through** (see "Mandatory Walk-Through" above)
- [ ] **Verify zero type/lint errors before committing**
- [ ] **Commit with descriptive message** following `type(scope): description` convention

---

## Audit Log Template

After completing a task, document what was verified:

```markdown
### Audit: [Task Name]
- **Typecheck:** [pass/fail — errors if any]
- **Lint:** [pass/fail — warnings if any]
- **Build:** [pass/fail]
- **Tests:** [pass/fail — count]
- **RLS/Security:** [checked/not applicable]
- **Dark Mode:** [CSS variables verified/not applicable]
- **Stream Cleanup:** [subscriptions cancelled/not applicable]
- **Error Handling:** [no empty catch blocks verified]
- **Walk-Through:** [pass/fail — issues found or "no issues"]
```

---

*Last Updated: [DATE]*
*Template version: 1.0.0*
