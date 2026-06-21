/**
 * lib/repositories/documents.repository.ts
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export function createDocumentsRepository(supabase: TypedSupabaseClient) {
  return {
    async listForActor(filters?: { relatedEntityType?: string; relatedEntityId?: string }) {
      let query = supabase.from('documents').select('*')
      if (filters?.relatedEntityType) query = query.eq('related_entity_type', filters.relatedEntityType)
      if (filters?.relatedEntityId) query = query.eq('related_entity_id', filters.relatedEntityId)
      const result = await query.order('created_at', { ascending: false })
      if (result.error) throw result.error
      return result.data
    },

    async getById(documentId: string) {
      const result = await supabase.from('documents').select('*').eq('id', documentId).maybeSingle()
      if (result.error) throw result.error
      return result.data
    },

    // Note: company_id is NOT part of TablesInsert<'documents'> by
    // design — it's derived server-side via the
    // resolve_document_company_id trigger from related_entity_type/id.
    // Passing one here would be silently overwritten by the trigger, so
    // the type omits it entirely to make that contract visible at the
    // call site rather than just in a comment.
    async create(input: TablesInsert<'documents'>) {
      const result = await supabase.from('documents').insert(input).select().single()
      return unwrap(result, 'create document')
    },

    async update(documentId: string, input: TablesUpdate<'documents'>) {
      const result = await supabase.from('documents').update(input).eq('id', documentId).select().single()
      return unwrap(result, 'update document')
    },

    async delete(documentId: string) {
      const result = await supabase.from('documents').delete().eq('id', documentId)
      if (result.error) throw result.error
    },

    /** Generates a short-lived signed URL — required since the documents bucket is private. */
    async getSignedUrl(filePath: string, expiresInSeconds = 60 * 10) {
      const result = await supabase.storage.from('documents').createSignedUrl(filePath, expiresInSeconds)
      if (result.error) throw result.error
      return result.data.signedUrl
    },
  }
}

export type DocumentsRepository = ReturnType<typeof createDocumentsRepository>
