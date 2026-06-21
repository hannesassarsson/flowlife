/**
 * lib/repositories/properties.repository.ts
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export function createPropertiesRepository(supabase: TypedSupabaseClient) {
  return {
    async listByCompany(companyId: string) {
      const result = await supabase
        .from('properties')
        .select('*')
        .eq('company_id', companyId)
        .order('name')
      if (result.error) throw result.error
      return result.data
    },

    async getById(propertyId: string) {
      const result = await supabase.from('properties').select('*').eq('id', propertyId).maybeSingle()
      if (result.error) throw result.error
      return result.data
    },

    async create(input: TablesInsert<'properties'>) {
      const result = await supabase.from('properties').insert(input).select().single()
      return unwrap(result, 'create property')
    },

    async update(propertyId: string, input: TablesUpdate<'properties'>) {
      const result = await supabase
        .from('properties')
        .update(input)
        .eq('id', propertyId)
        .select()
        .single()
      return unwrap(result, 'update property')
    },

    async delete(propertyId: string) {
      const result = await supabase.from('properties').delete().eq('id', propertyId)
      if (result.error) throw result.error
    },

    // --- Buildings (nested under properties) ---

    async listBuildings(propertyId: string) {
      const result = await supabase.from('buildings').select('*').eq('property_id', propertyId).order('name')
      if (result.error) throw result.error
      return result.data
    },

    async createBuilding(input: TablesInsert<'buildings'>) {
      const result = await supabase.from('buildings').insert(input).select().single()
      return unwrap(result, 'create building')
    },

    // --- Units (nested under buildings) ---

    async listUnitsByBuilding(buildingId: string) {
      const result = await supabase.from('units').select('*').eq('building_id', buildingId).order('unit_number')
      if (result.error) throw result.error
      return result.data
    },

    async listUnitsByCompany(companyId: string, filters?: { status?: string }) {
      let query = supabase.from('units').select('*, buildings(name, property_id)').eq('company_id', companyId)
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      const result = await query.order('unit_number')
      if (result.error) throw result.error
      return result.data
    },

    async getUnitById(unitId: string) {
      const result = await supabase.from('units').select('*').eq('id', unitId).maybeSingle()
      if (result.error) throw result.error
      return result.data
    },

    async createUnit(input: TablesInsert<'units'>) {
      const result = await supabase.from('units').insert(input).select().single()
      return unwrap(result, 'create unit')
    },

    async updateUnit(unitId: string, input: TablesUpdate<'units'>) {
      const result = await supabase.from('units').update(input).eq('id', unitId).select().single()
      return unwrap(result, 'update unit')
    },

    /** Units belonging to a given tenant (their current + historical leases). */
    async listUnitsForTenant(tenantId: string) {
      const result = await supabase
        .from('leases')
        .select('unit_id, units(*)')
        .in(
          'id',
          (
            await supabase.from('lease_tenants').select('lease_id').eq('tenant_id', tenantId)
          ).data?.map((row) => row.lease_id) ?? []
        )
      if (result.error) throw result.error
      return result.data
    },
  }
}

export type PropertiesRepository = ReturnType<typeof createPropertiesRepository>
