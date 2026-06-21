'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActor } from '@/lib/auth/get-current-actor'
import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { createMaintenanceRequest } from '@/lib/services/maintenance.service'
import type { MaintenanceCategory } from '@/lib/supabase/database.types'

/**
 * Two-step flow, not arbitrary: the storage path convention is
 * {company_id}/{request_id}/{filename} (see migration 0011), so the
 * request row must exist before an attachment can be uploaded to it. If
 * the upload step fails after the request was created, the request
 * itself is still valid — the person just doesn't get a photo attached,
 * which is the right failure mode here (losing the report would be
 * worse than losing the photo).
 */
export async function createMaintenanceRequestAction(formData: FormData) {
  const actor = await getCurrentActor()
  if (!actor || actor.kind !== 'tenant') throw new Error('Not authenticated as a tenant')

  const unitId = formData.get('unitId') as string
  const leaseId = (formData.get('leaseId') as string) || null
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const category = (formData.get('category') as MaintenanceCategory) || null
  const image = formData.get('image') as File | null

  const request = await createMaintenanceRequest(actor, {
    unit_id: unitId,
    lease_id: leaseId,
    title,
    description,
    category,
  })

  if (image && image.size > 0) {
    const supabase = await createClient()
    const repos = createRepositories(supabase)

    // Sanitize the filename before using it in the storage path. An
    // unsanitized browser-supplied name could contain '/' and shift
    // what storage_path_segment(name, 1) / (name, 2) resolve to in the
    // storage RLS policy (migration 0011), which would either break the
    // upload or — worse — let it land outside the path the policy
    // actually checked. Strip anything that isn't alphanumeric, dot,
    // dash, or underscore.
    const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${request.company_id}/${request.id}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('maintenance-attachments')
      .upload(filePath, image)

    if (!uploadError) {
      await repos.maintenance.addAttachment({
        request_id: request.id,
        file_url: filePath,
        file_type: image.type,
        uploaded_by: actor.userId,
      })
    }
    // Upload failure is intentionally non-fatal here — see function docstring.
  }

  revalidatePath('/portal/maintenance')
  redirect('/portal/maintenance')
}
