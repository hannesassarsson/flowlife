/**
 * lib/repositories/messaging.repository.ts
 */

import type { TypedSupabaseClient } from './base'
import { unwrap } from './base'
import type { TablesInsert } from '@/lib/supabase/database.types'

export function createMessagingRepository(supabase: TypedSupabaseClient) {
  return {
    async listThreadsForActor() {
      // RLS scopes this to threads the actor participates in (or
      // company-wide for owner/PM) — see threads_select_participant_or_manager.
      const result = await supabase
        .from('message_threads')
        .select('*, thread_participants(participant_id, participant_type)')
        .order('last_message_at', { ascending: false })
      if (result.error) throw result.error
      return result.data
    },

    async getThreadById(threadId: string) {
      const result = await supabase
        .from('message_threads')
        .select('*, thread_participants(*), messages(*)')
        .eq('id', threadId)
        .maybeSingle()
      if (result.error) throw result.error
      return result.data
    },

    async createThread(input: TablesInsert<'message_threads'>, participants: TablesInsert<'thread_participants'>[]) {
      const thread = unwrap(
        await supabase.from('message_threads').insert(input).select().single(),
        'create message thread'
      )
      const participantsResult = await supabase
        .from('thread_participants')
        .insert(participants.map((p) => ({ ...p, thread_id: thread.id })))
      if (participantsResult.error) throw participantsResult.error
      return thread
    },

    async sendMessage(input: TablesInsert<'messages'>) {
      // company_id is server-derived via sync_message_company_id trigger
      // from thread_id — never accepted directly, see database.types.ts.
      const result = await supabase.from('messages').insert(input).select().single()
      return unwrap(result, 'send message')
      // last_message_at on the parent thread updates automatically via
      // touch_thread_last_message_at — no follow-up update needed here.
    },

    async markMessageRead(messageId: string) {
      const result = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId)
        .select()
        .single()
      return unwrap(result, 'mark message read')
    },
  }
}

export type MessagingRepository = ReturnType<typeof createMessagingRepository>
