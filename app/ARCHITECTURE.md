# Next.js Architecture — Property Management Platform

Phase 2 deliverable: folder structure, proxy (middleware), route groups,
typed database layer, repositories, service layer, and auth architecture.
**No UI pages or business logic implementation** — every file here is
structural/architectural, per the brief. Server Actions and React
components for actual forms/lists/etc. come next, once this is reviewed.

Targets **Next.js 16** (current stable/LTS as of this writing — Next.js 15
goes EOL Oct 2026, so this intentionally skips straight to 16 rather than
building on a framework version with a 4-month support runway).

---

## How a request flows through this architecture

```
Incoming request
  │
  ▼
proxy.ts (Next.js 16's middleware.ts replacement)
  │  1. Parse hostname → tenant slug (pure function, no DB)
  │  2. Refresh Supabase session via @supabase/ssr (getUser(), never
  │     getSession() — see proxy.ts header comment)
  │  3a. Subdomain present  → rewrite to /portal/{slug}/... + auth gate
  │  3b. No subdomain       → root platform domain, dashboard/admin gate
  ▼
Route group layout (the AUTHORITATIVE access check)
  │  - app/(platform)/dashboard/layout.tsx     → requireStaff()
  │  - app/(platform)/admin/layout.tsx          → requireSuperAdmin()
  │  - app/portal/[subdomain]/(authenticated)/  → getCurrentActorForCompany()
  ▼
Page / Server Action
  │  - Calls a SERVICE function (lib/services/*), never a repository
  │    directly, for anything with business rules to enforce
  │  - Service calls assertCan() (lib/auth/permissions.ts) then a
  │    REPOSITORY (lib/repositories/*) for the actual query
  │  - Repository issues the Supabase query through the RLS-bound client
  │    — RLS (already validated) is the hard floor regardless of what
  │    happens above it
  ▼
Response
```

---

## Folder structure

```
proxy.ts                          # Next.js 16 request interception (was middleware.ts)

app/
  layout.tsx                      # Root layout — no auth/tenant logic
  (marketing)/                    # Public marketing site, root domain
  (auth)/                         # Platform-level login/signup/forgot-password
    login/  signup/  forgot-password/
  (platform)/                     # Wraps dashboard + admin, requires ANY actor
    layout.tsx
    dashboard/                    # Staff-only (requireStaff)
      properties/  units/  leases/  maintenance/
      documents/  messages/  announcements/
      settings/
        branding/                # Manager-only narrowing (requireManager)
        team/
    admin/                        # Super-admin-only (requireSuperAdmin)
      companies/  audit-logs/
  portal/
    [subdomain]/                  # White-label tenant portal
      layout.tsx                  # Resolves tenant, injects theme CSS vars
      (public)/                   # No auth required
        login/
      (authenticated)/            # Tenant actor required, cross-tenant-checked
        dashboard/  maintenance/  documents/  messages/  announcements/
  api/
    invites/                      # Route Handler, service-role client
    webhooks/stripe/              # Phase 2 stub

lib/
  supabase/
    client.ts                     # Browser client (Client Components)
    server.ts                    # Server client (Server Components/Actions/Routes)
                                   #   + service-role client (invites/webhooks/cron ONLY)
    proxy-client.ts                # Client factory used only by proxy.ts
    database.types.ts             # Hand-written stub — replace via `npm run gen:types`
  tenant/
    constants.ts                  # ROOT_DOMAIN, reserved subdomains
    resolve-tenant.ts             # hostname -> slug (pure, used in proxy.ts)
    get-current-tenant.ts         # slug -> ResolvedTenant (cached, used in layout)
  auth/
    get-current-actor.ts          # Supabase user -> typed Actor (cached)
    permissions.ts                # App-layer permission matrix (mirrors RLS)
    require-role.ts               # Layout-level guards (requireStaff, etc.)
  repositories/                   # Pure data access, one file per domain area
    base.ts  properties.repository.ts  leases.repository.ts
    maintenance.repository.ts  documents.repository.ts
    messaging.repository.ts  announcements.repository.ts
    companies.repository.ts  audit-log.repository.ts
    index.ts                      # createRepositories(supabase) factory
  services/                       # Business logic + permission checks + audit log
    maintenance.service.ts  property.service.ts  lease.service.ts
    document.service.ts  announcement.service.ts
    messaging.service.ts  company.service.ts

types/
  auth.ts                         # Actor, Resource, Action, PermissionContext
  tenant.ts                       # ResolvedTenant
```

---

## Key conventions (read before adding new code)

### 1. Repositories never check permissions; services always do

A repository function takes already-validated inputs and issues a query.
A service function takes an `Actor`, calls `assertCan()`, *then* calls the
repository, then writes an audit log entry. If you're adding a new
mutation and you're not sure where it goes: if it needs `actor`, it's a
service; if it's just "given these IDs, fetch/write this row," it's a
repository.

### 2. RLS is the hard floor; `lib/auth/permissions.ts` is UX sugar

`assertCan()` exists so a disallowed action fails fast with a clean error
*before* a query even fires — not because RLS can't be trusted. If
`permissions.ts` and the RLS policies in migration `0010_rls_policies.sql`
ever disagree, RLS wins and `permissions.ts` has a bug to fix. Keep them
in sync deliberately; this file is written to mirror the permission
matrix table from the architecture doc row-for-row.

### 3. `getUser()`, never `getSession()`, for any auth decision

Enforced throughout `proxy.ts`, `get-current-actor.ts`. `getSession()`
trusts the cookie's JWT without re-validating it server-side; `getUser()`
always calls the Supabase Auth server. Using `getSession()` anywhere in
this codebase for an authorization decision is a bug, not a style choice.

### 4. Two Supabase client lifetimes: request-scoped vs. never-cached

`lib/supabase/server.ts`'s `createClient()` must be called fresh per
request (it reads `cookies()`, which is request-scoped in Next.js) —
never hoist it to a module-level singleton. `createServiceRoleClient()`
has no cookies at all and is restricted to invites, webhooks, and
scheduled jobs (see its docstring) — if you find yourself reaching for it
in normal request-handling code, that's a sign RLS should be doing the
work instead.

### 5. `company_id` is never client-supplied where a trigger derives it

`buildings`, `units`, `leases`, `maintenance_requests`, `documents`, and
`messages` all have `company_id` populated server-side by a `before
insert` trigger (see migrations `0003`–`0007`). The corresponding
`Insert` types in `database.types.ts` omit `company_id` for exactly this
reason — if TypeScript is complaining that you're missing a field on one
of these inserts, you're probably trying to pass something the database
will silently overwrite anyway.

### 6. Maintenance-staff/contractor visibility is assignment-scoped, by design

`can_view_maintenance_request()` (DB function) and the `isAssignee`
context field in `permissions.ts` both encode the same rule: a
`maintenance_staff` or `contractor` actor sees only tickets assigned to
them, never the company's full queue. This was a deliberate tightening
during database validation (see migration `0010` history) — don't
"simplify" it back to company-wide staff visibility without revisiting
that decision explicitly.

### 7. Multi-tenancy is enforced twice, on purpose

Once by RLS (`company_id` scoping via `company_memberships` /
`tenant_profiles` subqueries), once by the route layouts
(`getCurrentActorForCompany()` in the tenant portal's authenticated
layout, specifically to stop a stale cross-company session from even
rendering a portal shell it shouldn't see). Removing either layer
weakens defense-in-depth even though RLS alone would still block the
underlying data access.

---

## What's NOT here yet (intentionally)

- Server Actions implementing actual mutations (the service layer is
  ready to be called from them)
- React components / page content
- Form validation (Zod schemas, etc.)
- Realtime subscription wiring for the messaging module
- Stripe billing schema (Phase 2, per the original architecture doc)
- Rate limiting, email verification flows, onboarding wizard

## Before running this for real

1. `npm install` (versions in `package.json` are pinned exactly — see
   note below on why — bump deliberately, not via `^` ranges).
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   values.
3. Run `npm run gen:types` against your validated local Supabase project
   to replace the hand-written `database.types.ts` stub with the real,
   CLI-generated one.
4. The Supabase package versions are pinned exactly (`0.12.0`, `2.108.2`)
   rather than range-allowed, deliberately — Supabase's own engineering
   blog has flagged active npm supply-chain attack patterns (maintainer
   compromise, typosquatting) targeting exactly these packages this year.
   Bump them on your own schedule after reviewing the changelog, not
   automatically.
