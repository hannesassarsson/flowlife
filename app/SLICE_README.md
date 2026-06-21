# Vertical Slice — Run Instructions

This is a working end-to-end slice, not the full application. See
`ARCHITECTURE.md` for the full approved design — this README covers only
what's needed to run *this* slice locally.

## Scope cuts made for speed (documented, not silent)

- **No subdomain routing.** The full architecture resolves tenants via
  `company.yourapp.se` subdomains through `proxy.ts`. This slice runs
  everything at `localhost:3000` with a single seeded company. Staff use
  `/dashboard/*`, tenants use `/portal/*`. Don't copy this simplified
  `proxy.ts` or the simplified `requireTenant()` guard back into the real
  multi-tenant routes — see the header comments in `proxy.ts` and
  `lib/auth/require-role.ts` for what's different and why.
- **Out of scope per the brief:** documents, messaging, announcements,
  laundry/parking/invoicing, AI features, mobile. None of that UI exists
  here even though the repository/service layer for some of it (e.g.
  announcements) already exists from the approved architecture.
- **`database.types.ts` is still the hand-written stub**, not CLI-generated
  output. A few pages use explicit local type casts (search for "Cast to"
  or "Typed explicitly" comments) where Supabase's joined-relation shape
  isn't reflected in the stub. Run `npm run gen:types` against your local
  Supabase project and these casts can be tightened or removed.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in your local Supabase
project's values (from `npx supabase status` once `supabase start` has
run against the database from the validated migrations):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase status>
```

Then:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Seeded test accounts

All passwords: `password123` (from the validated `supabase/seed.sql`).

| Email | Role | What to test |
|---|---|---|
| `pm@nordichomes.dev` | Property Manager | Dashboard, properties, apartments, all maintenance requests, status changes, assignment |
| `tenant@nordichomes.dev` | Tenant | Portal dashboard, own maintenance requests, create request with photo |

Company: Nordic Homes AB. One property (Vasastan Residence), one building,
two apartments (101 occupied, 102 vacant). One seeded maintenance request
on apartment 101, assigned to `maintenance@nordichomes.dev` (also seeded,
password `password123`, but the maintenance-staff dashboard UI for
assignment-scoped visibility isn't built in this slice — only PM and
tenant flows are).

## What to click through

**As the PM:**
1. Log in → dashboard shows company name, "Property Manager" badge, property/request counts.
2. Properties → Vasastan Residence → see apartments 101 (occupied) and 102 (vacant).
3. Maintenance → see the seeded "Leaking kitchen faucet" request → change its status → reload, confirm it persisted → reassign it.

**As the tenant:**
1. Log in → portal dashboard shows apartment 101 details and lease info.
2. Maintenance → see the same seeded request (now showing whatever status the PM set) → submit a new request with a photo → confirm it appears in the list.

**Logout:** the nav bar in both layouts has a working logout button (real
Server Action calling `supabase.auth.signOut()`, not a stub).

## Known gap: not build-verified

This sandbox has no Node.js runtime, so `npm install`, `tsc --noEmit`, and
`next build` have not actually been executed against this code. Every
file has been checked for import resolution, brace/paren balance, and
manual cross-referencing of repository/service return shapes against
their usage — but that is static review, not a compiler. Run
`npm run typecheck` and `npm run build` yourself as the real test, the
same way the database layer was validated against a real Supabase
instance before this slice was built on top of it.

A logic bug WAS found and fixed during this process, the kind only a real
wiring exercise surfaces: `requireActorKind()`'s mismatch path was
hardcoded to `redirect('/dashboard')`, which would have infinite-looped
for any tenant who landed on a staff-only route. Fixed in
`lib/auth/require-role.ts` to redirect by actual actor kind.
