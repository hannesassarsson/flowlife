/**
 * lib/services/announcement.service.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { assertCan } from '@/lib/auth/permissions'
import type { Actor } from '@/types/auth'
import type { TablesInsert } from '@/lib/supabase/database.types'

export async function publishAnnouncement(actor: Actor, input: TablesInsert<'announcements'>) {
  assertCan(actor, 'create', 'announcement', { resourceCompanyId: input.company_id })

  const supabase = await createClient()
  const repos = createRepositories(supabase)
  const announcement = await repos.announcements.create({ ...input, created_by: actor.userId })

  await repos.auditLog.record({
    company_id: announcement.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'announcement.published',
    entity_type: 'announcement',
    entity_id: announcement.id,
  })

  return announcement
}

export async function markAnnouncementRead(actor: Actor, announcementId: string) {
  if (actor.kind !== 'tenant') return // read-tracking only applies to tenants

  const supabase = await createClient()
  const repos = createRepositories(supabase)
  await repos.announcements.markRead(announcementId, actor.userId)
}
