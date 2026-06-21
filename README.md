# Property Management Platform — Vertical Slice

Detta repo innehåller en fungerande end-to-end-slice: autentisering,
rollbaserad dashboard, fastigheter/lägenheter, och underhållsärenden
(skapa som hyresgäst, hantera status/tilldelning som fastighetsförvaltare).

## Struktur

```
.
├── app/            Next.js 16-applikationen (App Router, TypeScript, Tailwind v4)
│   ├── app/        Route-träd (layout.tsx, route-grupper, sidor)
│   ├── components/ shadcn/ui-primitiver
│   ├── lib/        Supabase-klienter, repositories, services, auth-logik
│   ├── ARCHITECTURE.md     Fullständig arkitekturdokumentation
│   └── SLICE_README.md    Körinstruktioner + testkonton för just denna slice
│
├── supabase/       Databasmigrationer (11 filer) + seed-data
│   ├── migrations/ Körs i ordning av `supabase db reset`
│   ├── seed.sql    Testdata: ett företag, en fastighet, två lägenheter, m.m.
│   └── README.md  Designbeslut bakom schemat (RLS, multi-tenancy, etc.)
│
└── validation/     SQL-testfiler för att verifiera RLS-policys, roller,
                     storage-access och triggers (körs manuellt mot en
                     lokal Supabase-instans, se validation/RUNBOOK.md)
```

## Snabbstart

```bash
cd supabase
npx supabase init      # om det inte redan är ett Supabase-projekt
npx supabase start     # startar lokal Postgres/Auth/Storage i Docker

# Klistra in API URL + anon key + service_role key (skrivs ut av
# kommandot ovan) i app/.env.local — se app/.env.example för format.

cd ../app
npm install
npm run dev
```

Öppna `http://localhost:3000`. Testkonton (lösenord `password123` för
alla): `pm@nordichomes.dev` (Property Manager), `tenant@nordichomes.dev`
(Tenant).

Se `app/SLICE_README.md` för en fullständig klick-genom-guide och kända
begränsningar för just denna slice.
