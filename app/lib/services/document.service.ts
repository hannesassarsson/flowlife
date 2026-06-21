/**
 * lib/services/document.service.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { assertCan } from '@/lib/auth/permissions'
import type { Actor } from '@/types/auth'
import type { TablesInsert } from '@/lib/supabase/database.types'

export async function uploadDocument(
  actor: Actor,
  companyId: string,
  input: TablesInsert<'documents'>
) {
  assertCan(actor, 'create', 'document', { resourceCompanyId: companyId })

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  // input does not (and must not) include company_id — see
  // documents.repository.ts comment; resolve_document_company_id derives
  // it server-side from related_entity_type/related_entity_id.
  const document = await repos.documents.create({ ...input, uploaded_by: actor.userId })

  await repos.auditLog.record({
    company_id: document.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'document.uploaded',
    entity_type: 'document',
    entity_id: document.id,
    metadata: { related_entity_type: document.related_entity_type, related_entity_id: document.related_entity_id },
  })

  return document
}

export async function getDocumentDownloadUrl(actor: Actor, documentId: string) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const document = await repos.documents.getById(documentId)
  if (!document) throw new Error('Document not found')

  assertCan(actor, 'read', 'document', {
    resourceCompanyId: document.company_id,
    isOwnRecord: actor.kind === 'tenant' && document.visible_to_tenant,
  })

  return repos.documents.getSignedUrl(document.file_url)
}
