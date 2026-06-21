'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentActor } from '@/lib/auth/get-current-actor'
import {
  updateMaintenanceRequestStatus,
  assignMaintenanceRequest,
} from '@/lib/services/maintenance.service'
import type { TablesInsert } from '@/lib/supabase/database.types'

export async function updateStatusAction(formData: FormData) {
  const actor = await getCurrentActor()
  if (!actor) throw new Error('Not authenticated')

  const requestId = formData.get('requestId') as string
  const status = formData.get('status') as NonNullable<TablesInsert<'maintenance_requests'>['status']>

  await updateMaintenanceRequestStatus(actor, requestId, status)
  revalidatePath('/dashboard/maintenance')
}

export async function assignRequestAction(formData: FormData) {
  const actor = await getCurrentActor()
  if (!actor) throw new Error('Not authenticated')

  const requestId = formData.get('requestId') as string
  const assigneeId = formData.get('assigneeId') as string

  await assignMaintenanceRequest(actor, requestId, assigneeId)
  revalidatePath('/dashboard/maintenance')
}
