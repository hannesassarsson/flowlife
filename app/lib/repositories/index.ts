/**
 * lib/repositories/index.ts
 *
 * Single entry point so callers don't manually thread a Supabase client
 * into each repository constructor. Usage in a Server Component, Server
 * Action, or Route Handler:
 *
 *   const supabase = await createClient()
 *   const repos = createRepositories(supabase)
 *   const properties = await repos.properties.listByCompany(companyId)
 *
 * Deliberately NOT a singleton — see server.ts header comment on why a
 * cached/module-level Supabase client would leak across requests. A new
 * `repos` object is cheap to construct (it's just closures over the
 * client), so there's no performance reason to cache it either.
 */

import type { TypedSupabaseClient } from './base'
import { createPropertiesRepository } from './properties.repository'
import { createLeasesRepository } from './leases.repository'
import { createMaintenanceRepository } from './maintenance.repository'
import { createDocumentsRepository } from './documents.repository'
import { createMessagingRepository } from './messaging.repository'
import { createAnnouncementsRepository } from './announcements.repository'
import { createCompaniesRepository } from './companies.repository'
import { createAuditLogRepository } from './audit-log.repository'

export function createRepositories(supabase: TypedSupabaseClient) {
  return {
    properties: createPropertiesRepository(supabase),
    leases: createLeasesRepository(supabase),
    maintenance: createMaintenanceRepository(supabase),
    documents: createDocumentsRepository(supabase),
    messaging: createMessagingRepository(supabase),
    announcements: createAnnouncementsRepository(supabase),
    companies: createCompaniesRepository(supabase),
    auditLog: createAuditLogRepository(supabase),
  }
}

export type Repositories = ReturnType<typeof createRepositories>

export * from './base'
