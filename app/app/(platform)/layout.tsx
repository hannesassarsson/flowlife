/**
 * app/(platform)/layout.tsx
 *
 * Wraps BOTH /dashboard and /admin. Does NOT itself enforce role —
 * dashboard/layout.tsx and admin/layout.tsx each call their own
 * require*() guard, because they require different things (any staff vs.
 * super-admin-only). This layout's job is narrower: it's the place
 * shared chrome (top nav shell, company switcher) would live once UI is
 * built, and it's a natural spot to redirect entirely unauthenticated
 * visitors before either child layout's more specific check runs.
 */

import { requireActor } from '@/lib/auth/require-role'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requireActor() // any authenticated actor; specific role checked deeper
  return <>{children}</>
}
