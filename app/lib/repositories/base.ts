/**
 * lib/repositories/base.ts
 *
 * Repositories are PURE DATA ACCESS — no permission checks, no business
 * logic, no audit logging. They exist to:
 *   1. Centralize Supabase query construction so it's not duplicated
 *      across Server Components, Server Actions, and Route Handlers.
 *   2. Type the inputs/outputs against database.types.ts.
 *   3. Translate Supabase's {data, error} shape into thrown errors OR
 *      typed results — consistently, in one place — rather than each
     *      caller deciding ad hoc whether to check `error` or `!data`.
 *
 * Permission checks belong in the service layer (lib/services/), which
 * calls repositories AFTER deciding the actor is allowed to. Repositories
 * still execute through the RLS-bound client (never the service-role
 * client — see server.ts), so RLS remains the hard floor even if a
 * service-layer check has a bug.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type TypedSupabaseClient = SupabaseClient<Database>

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

/**
 * Wraps a Supabase query result, throwing a consistent RepositoryError on
 * failure rather than leaving every call site to check `.error` manually.
 * Use for queries where "not found" should be a thrown error (most
 * mutations). For reads where "not found" is an expected, handled case,
 * call the Supabase client directly with `.maybeSingle()` instead of
 * routing through this helper.
 */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) {
    throw new RepositoryError(`${context}: ${result.error.message}`, result.error)
  }
  if (result.data === null) {
    throw new RepositoryError(`${context}: no row returned`)
  }
  return result.data
}
