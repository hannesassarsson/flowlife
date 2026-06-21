/**
 * lib/repositories/companies.repository.ts
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export function createCompaniesRepository(supabase: TypedSupabaseClient) {
  return {
    async getById(companyId: string) {
      const result = await supabase
        .from('companies')
        .select('*, company_branding(*)')
        .eq('id', companyId)
        .maybeSingle()
      if (result.error) throw result.error
      return result.data
    },

    async updateBranding(companyId: string, input: TablesUpdate<'company_branding'>) {
      const result = await supabase
        .from('company_branding')
        .update(input)
        .eq('company_id', companyId)
        .select()
        .single()
      return unwrap(result, 'update company branding')
    },

    async listMembers(companyId: string) {
      const result = await supabase
        .from('company_memberships')
        .select('*, user_profiles(full_name, email, avatar_url)')
        .eq('company_id', companyId)
        .order('created_at')
      if (result.error) throw result.error
      return result.data
    },

    async inviteMember(input: TablesInsert<'company_memberships'>) {
      const result = await supabase.from('company_memberships').insert(input).select().single()
      return unwrap(result, 'invite member')
    },

    async updateMemberRole(membershipId: string, role: TablesUpdate<'company_memberships'>['role']) {
      const result = await supabase
        .from('company_memberships')
        .update({ role })
        .eq('id', membershipId)
        .select()
        .single()
      return unwrap(result, 'update member role')
    },

    async removeMember(membershipId: string) {
      const result = await supabase.from('company_memberships').delete().eq('id', membershipId)
      if (result.error) throw result.error
    },

    async listTenants(companyId: string) {
      const result = await supabase
        .from('tenant_profiles')
        .select('*, lease_tenants(lease_id, is_primary, leases(unit_id, status))')
        .eq('company_id', companyId)
        .order('full_name')
      if (result.error) throw result.error
      return result.data
    },
  }
}

export type CompaniesRepository = ReturnType<typeof createCompaniesRepository>
