/**
 * types/auth.ts
 *
 * The actor abstraction: both `user_profiles` (staff) and `tenant_profiles`
 * (tenants) can act in the system, but they're different tables with
 * different shapes. Every service function that needs "who is doing this"
 * takes an `Actor`, never a raw Supabase User — this is what lets the
 * service layer enforce permissions without caring whether the caller is
 * staff or a tenant.
 */

import type { CompanyRole } from '@/lib/supabase/database.types'

export type ActorKind = 'super_admin' | 'staff' | 'tenant'

export interface StaffActor {
  kind: 'staff'
  userId: string
  companyId: string
  role: CompanyRole
  email: string
  fullName: string
}

export interface TenantActor {
  kind: 'tenant'
  userId: string
  companyId: string
  email: string
  fullName: string
}

export interface SuperAdminActor {
  kind: 'super_admin'
  userId: string
  email: string
  fullName: string
}

/**
 * The union every service/repository function should accept. Narrowing on
 * `.kind` gives exhaustive switch handling — adding a new actor kind later
 * will surface every call site that needs updating via a TS error.
 */
export type Actor = StaffActor | TenantActor | SuperAdminActor

/**
 * Resources and actions mirror the permission matrix from the architecture
 * doc exactly — this file IS the matrix, expressed as code, so there's one
 * source of truth instead of a doc that can drift from the implementation.
 */
export type Resource =
  | 'company'
  | 'branding'
  | 'membership'
  | 'property'
  | 'unit'
  | 'lease'
  | 'maintenance_request'
  | 'maintenance_comment'
  | 'document'
  | 'message_thread'
  | 'announcement'
  | 'audit_log'

export type Action = 'create' | 'read' | 'update' | 'delete' | 'assign' | 'manage_staff'

export interface PermissionContext {
  /** The specific row being acted on, if any (omitted for 'create' on a collection). */
  resourceCompanyId?: string
  /** For maintenance_request reads: is this actor the assignee? */
  isAssignee?: boolean
  /** For tenant-scoped reads: does this row belong to the tenant's own lease/unit? */
  isOwnRecord?: boolean
}
