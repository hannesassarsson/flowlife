/**
 * lib/repositories/audit-log.repository.ts
 *
 * Audit logs are append-only at the DB level (no update policy, no
 * delete policy — migration 0010). This repository reflects that: there
 * is no update() or delete() method, on purpose, not because they were
 * forgotten.
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert } from '@/lib/supabase/database.types'

export function createAuditLogRepository(supabase: TypedSupabaseClient) {
  return {
    async record(entry: TablesInsert<'audit_logs'>) {
      const result = await supabase.from('audit_logs').insert(entry).select().single()
      return unwrap(result, 'record audit log entry')
    },

    async listForCompany(companyId: string, limit = 100) {
      const result = await supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (result.error) throw result.error
      return result.data
    },
  }
}

export type AuditLogRepository = ReturnType<typeof createAuditLogRepository>
