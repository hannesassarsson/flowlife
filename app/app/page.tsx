import { redirect } from 'next/navigation'
import { getCurrentActor } from '@/lib/auth/get-current-actor'

/**
 * The full architecture has a (marketing) route group at "/" — out of
 * scope for this slice. This root page just routes a visitor to the
 * right place based on session state, so opening localhost:3000 does
 * something sensible instead of 404ing.
 */
export default async function RootPage() {
  const actor = await getCurrentActor()

  if (!actor) redirect('/login')
  if (actor.kind === 'tenant') redirect('/portal/dashboard')
  redirect('/dashboard')
}
