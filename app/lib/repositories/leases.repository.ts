/**
 * lib/repositories/leases.repository.ts
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export function createLeasesRepository(supabase: TypedSupabaseClient) {
  return {
    async listByCompany(companyId: string, filters?: { status?: string }) {
      let query = supabase
        .from('leases')
        .select('*, units(unit_number, building_id), lease_tenants(tenant_id, is_primary, tenant_profiles(full_name, email))')
        .eq('company_id', companyId)
      if (filters?.status) query = query.eq('status', filters.status)
      const result = await query.order('start_date', { ascending: false })
      if (result.error) throw result.error
      return result.data
    },

    async getById(leaseId: string) {
      const result = await supabase
        .from('leases')
        .select('*, units(*), lease_tenants(tenant_id, is_primary, tenant_profiles(full_name, email, phone))')
        .eq('id', leaseId)
        .maybeSingle()
      if (result.error) throw result.error
      return result.data
    },

    async listByTenant(tenantId: string) {
      const result = await supabase
        .from('lease_tenants')
        .select('lease_id, is_primary, leases(*, units(*))')
        .eq('tenant_id', tenantId)
      if (result.error) throw result.error
      return result.data
    },

    async create(input: TablesInsert<'leases'>) {
      const result = await supabase.from('leases').insert(input).select().single()
      return unwrap(result, 'create lease')
    },

    async update(leaseId: string, input: TablesUpdate<'leases'>) {
      const result = await supabase.from('leases').update(input).eq('id', leaseId).select().single()
      return unwrap(result, 'update lease')
    },

    async addTenant(input: TablesInsert<'lease_tenants'>) {
      const result = await supabase.from('lease_tenants').insert(input).select().single()
      return unwrap(result, 'add lease tenant')
    },

    async removeTenant(leaseId: string, tenantId: string) {
      const result = await supabase
        .from('lease_tenants')
        .delete()
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
      if (result.error) throw result.error
    },
  }
}

export type LeasesRepository = ReturnType<typeof createLeasesRepository>
