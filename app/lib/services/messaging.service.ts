/**
 * lib/services/messaging.service.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import type { Actor } from '@/types/auth'

export async function startThread(
  actor: Actor,
  companyId: string,
  subject: string | undefined,
  otherParticipantId: string,
  otherParticipantType: 'staff' | 'tenant',
  firstMessageBody: string
) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const thread = await repos.messaging.createThread(
    { company_id: companyId, subject },
    [
      { thread_id: '', participant_id: actor.userId, participant_type: actor.kind === 'tenant' ? 'tenant' : 'staff' },
      { thread_id: '', participant_id: otherParticipantId, participant_type: otherParticipantType },
    ]
  )

  await repos.messaging.sendMessage({
    thread_id: thread.id,
    sender_id: actor.userId,
    sender_type: actor.kind === 'tenant' ? 'tenant' : 'staff',
    body: firstMessageBody,
  })

  return thread
}

export async function replyToThread(actor: Actor, threadId: string, body: string) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  // RLS (messages_insert_participant) is the actual enforcement here —
  // this service trusts it rather than re-checking participant status,
  // since that check requires the same join RLS already performs.
  return repos.messaging.sendMessage({
    thread_id: threadId,
    sender_id: actor.userId,
    sender_type: actor.kind === 'tenant' ? 'tenant' : 'staff',
    body,
  })
}
