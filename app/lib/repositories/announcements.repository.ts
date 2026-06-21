/**
 * lib/repositories/announcements.repository.ts
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export function createAnnouncementsRepository(supabase: TypedSupabaseClient) {
  return {
    async listForActor(filters?: { propertyId?: string }) {
      let query = supabase.from('announcements').select('*')
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId)
      const result = await query.order('published_at', { ascending: false })
      if (result.error) throw result.error
      return result.data
    },

    async create(input: TablesInsert<'announcements'>) {
      const result = await supabase.from('announcements').insert(input).select().single()
      return unwrap(result, 'create announcement')
    },

    async update(announcementId: string, input: TablesUpdate<'announcements'>) {
      const result = await supabase
        .from('announcements')
        .update(input)
        .eq('id', announcementId)
        .select()
        .single()
      return unwrap(result, 'update announcement')
    },

    async delete(announcementId: string) {
      const result = await supabase.from('announcements').delete().eq('id', announcementId)
      if (result.error) throw result.error
    },

    async markRead(announcementId: string, tenantId: string) {
      const result = await supabase
        .from('announcement_reads')
        .upsert({ announcement_id: announcementId, tenant_id: tenantId })
      if (result.error) throw result.error
    },
  }
}

export type AnnouncementsRepository = ReturnType<typeof createAnnouncementsRepository>
