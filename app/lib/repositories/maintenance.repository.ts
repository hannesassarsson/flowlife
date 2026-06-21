/**
 * lib/repositories/maintenance.repository.ts
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export function createMaintenanceRepository(supabase: TypedSupabaseClient) {
  return {
    // RLS already scopes this correctly per actor (manager sees all,
    // maintenance_staff/contractor see only their assignment, tenant sees
    // only their unit) — the repository doesn't need to replicate that
    // filtering; it just issues the query and trusts RLS.
    async listForActor(filters?: { status?: string; unitId?: string }) {
      let query = supabase
        .from('maintenance_requests')
        .select('*, units(unit_number, building_id)')
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.unitId) query = query.eq('unit_id', filters.unitId)
      const result = await query.order('created_at', { ascending: false })
      if (result.error) throw result.error
      return result.data
    },

    async getById(requestId: string) {
      const result = await supabase
        .from('maintenance_requests')
        .select('*, units(*), maintenance_comments(*), maintenance_attachments(*), maintenance_status_history(*)')
        .eq('id', requestId)
        .maybeSingle()
      if (result.error) throw result.error
      return result.data
    },

    async create(input: TablesInsert<'maintenance_requests'>) {
      const result = await supabase.from('maintenance_requests').insert(input).select().single()
      return unwrap(result, 'create maintenance request')
    },

    async updateStatus(requestId: string, status: TablesUpdate<'maintenance_requests'>['status']) {
      // The maintenance_status_history row is written automatically by
      // the log_maintenance_status_change trigger — this repository
      // function does NOT also insert a history row; doing so would
      // double-log.
      const result = await supabase
        .from('maintenance_requests')
        .update({ status })
        .eq('id', requestId)
        .select()
        .single()
      return unwrap(result, 'update maintenance request status')
    },

    async assign(requestId: string, assignedTo: string) {
      const result = await supabase
        .from('maintenance_requests')
        .update({ assigned_to: assignedTo })
        .eq('id', requestId)
        .select()
        .single()
      return unwrap(result, 'assign maintenance request')
    },

    async addComment(input: TablesInsert<'maintenance_comments'>) {
      const result = await supabase.from('maintenance_comments').insert(input).select().single()
      return unwrap(result, 'add maintenance comment')
    },

    async addAttachment(input: TablesInsert<'maintenance_attachments'>) {
      const result = await supabase.from('maintenance_attachments').insert(input).select().single()
      return unwrap(result, 'add maintenance attachment')
    },
  }
}

export type MaintenanceRepository = ReturnType<typeof createMaintenanceRepository>
