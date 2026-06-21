/**
 * lib/auth/permissions.ts
 *
 * App-layer permission checks mirroring the RLS policies from migration
 * 0010 exactly. This is NOT the security boundary — RLS is, and remains
 * the hard floor even if this file has a bug. This layer exists purely
 * for defense-in-depth UX: returning a clean 403 / hiding a button before
 * a query even fires, rather than letting a Supabase query silently
 * return zero rows and leaving the UI to guess why.
 *
 * Every function here is a pure, synchronous predicate over an `Actor`
 * and a `PermissionContext` — no DB calls. If a check needs to know
 * something about a specific row (e.g. "is this actor the assignee of
 * THIS maintenance request"), that data must already be loaded and
 * passed in via the context; this file does not fetch anything.
 */

import type { Action, Actor, PermissionContext, Resource } from '@/types/auth'

function isSameCompany(actor: Actor, ctx: PermissionContext): boolean {
  if (actor.kind === 'super_admin') return true
  if (!ctx.resourceCompanyId) return true // collection-level action, no row yet
  return actor.companyId === ctx.resourceCompanyId
}

function isManager(actor: Actor): boolean {
  return actor.kind === 'staff' && (actor.role === 'owner' || actor.role === 'property_manager')
}

function isOwner(actor: Actor): boolean {
  return actor.kind === 'staff' && actor.role === 'owner'
}

/**
 * The main entry point. Mirrors the permission matrix table from the
 * architecture doc row-for-row — when that doc changes, this switch
 * should change with it, and vice versa.
 */
export function can(actor: Actor, action: Action, resource: Resource, ctx: PermissionContext = {}): boolean {
  if (actor.kind === 'super_admin') {
    // Super admin bypasses company-scoping but NOT every action — e.g.
    // a super admin still shouldn't "assign" a maintenance ticket as if
    // they were staff. In practice the admin surface uses a different,
    // narrower set of actions (suspend company, view audit logs) that
    // aren't modeled in this matrix; this function only governs the
    // tenant-platform actions below.
  }

  if (!isSameCompany(actor, ctx)) return false

  switch (resource) {
    case 'company':
      if (action === 'read') return true // any member/tenant of the company
      if (action === 'update') return isOwner(actor) || actor.kind === 'super_admin'
      return actor.kind === 'super_admin'

    case 'branding':
      if (action === 'read') return true // publicly readable, see RLS
      return isOwner(actor) || actor.kind === 'super_admin'

    case 'membership':
      if (action === 'read') return actor.kind === 'staff' || actor.kind === 'super_admin'
      return isOwner(actor) || actor.kind === 'super_admin'

    case 'property':
    case 'unit':
      if (action === 'read') {
        if (actor.kind === 'staff' || actor.kind === 'super_admin') return true
        return ctx.isOwnRecord === true // tenant: only their own unit/property
      }
      return isManager(actor) || actor.kind === 'super_admin'

    case 'lease':
      if (action === 'read') {
        if (isManager(actor) || actor.kind === 'super_admin') return true
        return ctx.isOwnRecord === true
      }
      return isManager(actor) || actor.kind === 'super_admin'

    case 'maintenance_request': {
      if (action === 'create') {
        return actor.kind === 'staff' || actor.kind === 'tenant' || actor.kind === 'super_admin'
      }
      if (action === 'read') {
        if (actor.kind === 'super_admin') return true
        if (actor.kind === 'tenant') return ctx.isOwnRecord === true
        // staff: owner/PM see all, maintenance_staff/contractor see only
        // their assignment — mirrors can_view_maintenance_request() in
        // migration 0001 exactly.
        if (isManager(actor)) return true
        return ctx.isAssignee === true
      }
      if (action === 'assign' || action === 'delete') {
        return isManager(actor) || actor.kind === 'super_admin'
      }
      if (action === 'update') {
        // status updates: manager, OR the assigned maintenance_staff/contractor
        return isManager(actor) || ctx.isAssignee === true || actor.kind === 'super_admin'
      }
      return false
    }

    case 'maintenance_comment':
      if (action === 'create' || action === 'read') {
        if (actor.kind === 'super_admin') return true
        if (actor.kind === 'tenant') return ctx.isOwnRecord === true
        if (isManager(actor)) return true
        return ctx.isAssignee === true
      }
      return false // comments are immutable once posted

    case 'document':
      if (action === 'read') {
        if (actor.kind === 'staff' || actor.kind === 'super_admin') return true
        return ctx.isOwnRecord === true
      }
      return isManager(actor) || actor.kind === 'super_admin'

    case 'message_thread':
      // Thread-level access additionally requires participant membership,
      // which isn't expressible here (needs the participants list) — see
      // thread-participants check in the message service layer. This
      // predicate covers only the company-scoping pre-check.
      return action === 'create' || action === 'read'

    case 'announcement':
      if (action === 'read') return true // staff + tenants, both see announcements
      return isManager(actor) || actor.kind === 'super_admin'

    case 'audit_log':
      if (action === 'read') return isOwner(actor) || actor.kind === 'super_admin'
      return false // append-only, no update/delete from any actor

    default:
      return false
  }
}

/**
 * Throwing variant for use at the top of Server Actions / Route Handlers,
 * where the calling code wants to short-circuit with a clean error rather
 * than branch on a boolean.
 */
export class PermissionDeniedError extends Error {
  constructor(action: Action, resource: Resource) {
    super(`Permission denied: cannot ${action} ${resource}`)
    this.name = 'PermissionDeniedError'
  }
}

export function assertCan(
  actor: Actor,
  action: Action,
  resource: Resource,
  ctx: PermissionContext = {}
): void {
  if (!can(actor, action, resource, ctx)) {
    throw new PermissionDeniedError(action, resource)
  }
}
