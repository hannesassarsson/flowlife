/**
 * lib/supabase/database.types.ts
 *
 * HAND-WRITTEN STUB. Replace this entire file by running:
 *
 *   supabase gen types typescript --local > lib/supabase/database.types.ts
 *
 * (or --project-id <ref> against a hosted project). That command inspects
 * the live schema and generates exact types — including any drift from
 * future migrations — so this file should never be hand-edited once the
 * CLI can reach a real database.
 *
 * The shape below matches the validated schema from the migrations
 * (0001-0011) exactly as of this writing, so repositories and services
 * built against it now will compile cleanly against the generated
 * version later — but it WILL drift if the schema changes and this file
 * isn't regenerated. Treat any merge conflict in this file as a sign to
 * regenerate, not resolve by hand.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CompanyRole = 'owner' | 'property_manager' | 'maintenance_staff' | 'contractor'
export type MembershipStatus = 'active' | 'invited' | 'suspended'
export type CompanyStatus = 'active' | 'suspended' | 'trial'
export type PlanTier = 'starter' | 'growth' | 'enterprise'
export type UnitStatus = 'vacant' | 'occupied' | 'maintenance' | 'unavailable'
export type LeaseStatus = 'active' | 'ended' | 'terminated'
export type MaintenancePriority = 'low' | 'normal' | 'high' | 'urgent'
export type MaintenanceStatus = 'new' | 'in_progress' | 'waiting' | 'completed' | 'closed'
export type MaintenanceCategory =
  | 'plumbing' | 'electrical' | 'appliance' | 'hvac' | 'structural' | 'pest' | 'other'
export type ActorType = 'staff' | 'tenant'
export type DocumentCategory = 'lease_agreement' | 'inspection_report' | 'invoice' | 'policy' | 'other'
export type DocumentRelatedEntityType = 'lease' | 'unit' | 'property' | 'company'
export type AnnouncementCategory = 'news' | 'maintenance_notice' | 'water_shutdown' | 'general'
export type AuditActorType = 'staff' | 'tenant' | 'super_admin' | 'system'

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          is_super_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at' | 'is_super_admin'> & {
          is_super_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          status: CompanyStatus
          plan_tier: PlanTier
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'plan_tier'> & {
          id?: string
          status?: CompanyStatus
          plan_tier?: PlanTier
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      company_branding: {
        Row: {
          company_id: string
          logo_url: string | null
          favicon_url: string | null
          primary_color: string
          secondary_color: string
          accent_color: string
          portal_name: string
          welcome_message: string | null
          homepage_image_url: string | null
          subdomain_slug: string
          custom_domain: string | null
          custom_domain_verified: boolean
          contact_email: string | null
          contact_phone: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['company_branding']['Row'],
          'primary_color' | 'secondary_color' | 'accent_color' | 'portal_name' |
          'custom_domain_verified' | 'updated_at'> & {
          primary_color?: string
          secondary_color?: string
          accent_color?: string
          portal_name?: string
          custom_domain_verified?: boolean
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['company_branding']['Insert']>
      }
      company_memberships: {
        Row: {
          id: string
          user_id: string
          company_id: string
          role: CompanyRole
          status: MembershipStatus
          invited_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['company_memberships']['Row'], 'id' | 'status' | 'created_at'> & {
          id?: string
          status?: MembershipStatus
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['company_memberships']['Insert']>
      }
      tenant_profiles: {
        Row: {
          id: string
          company_id: string
          full_name: string
          email: string
          phone: string | null
          status: 'active' | 'former'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenant_profiles']['Row'], 'status' | 'created_at' | 'updated_at'> & {
          status?: 'active' | 'former'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['tenant_profiles']['Insert']>
      }
      properties: {
        Row: {
          id: string
          company_id: string
          name: string
          address_line1: string
          address_line2: string | null
          city: string
          postal_code: string
          country: string
          latitude: number | null
          longitude: number | null
          cover_image_url: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'country' | 'metadata' | 'created_at' | 'updated_at'> & {
          id?: string
          country?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['properties']['Insert']>
      }
      buildings: {
        Row: {
          id: string
          property_id: string
          company_id: string
          name: string
          floors: number | null
          created_at: string
          updated_at: string
        }
        // company_id is server-derived via trigger; never accept it on insert
        Insert: Omit<Database['public']['Tables']['buildings']['Row'], 'id' | 'company_id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['buildings']['Insert'], 'property_id'>>
      }
      units: {
        Row: {
          id: string
          building_id: string
          company_id: string
          unit_number: string
          floor: number | null
          size_sqm: number | null
          rooms: number | null
          rent_amount: number | null
          rent_currency: string
          status: UnitStatus
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['units']['Row'], 'id' | 'company_id' | 'rent_currency' | 'status' | 'metadata' | 'created_at' | 'updated_at'> & {
          id?: string
          rent_currency?: string
          status?: UnitStatus
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['units']['Insert'], 'building_id'>>
      }
      leases: {
        Row: {
          id: string
          company_id: string
          unit_id: string
          start_date: string
          end_date: string | null
          rent_amount: number
          rent_currency: string
          deposit_amount: number | null
          status: LeaseStatus
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['leases']['Row'], 'id' | 'company_id' | 'rent_currency' | 'status' | 'created_at' | 'updated_at'> & {
          id?: string
          rent_currency?: string
          status?: LeaseStatus
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['leases']['Insert'], 'unit_id'>>
      }
      lease_tenants: {
        Row: {
          id: string
          lease_id: string
          tenant_id: string
          is_primary: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lease_tenants']['Row'], 'id' | 'is_primary' | 'created_at'> & {
          id?: string
          is_primary?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['lease_tenants']['Insert']>
      }
      maintenance_requests: {
        Row: {
          id: string
          company_id: string
          unit_id: string
          lease_id: string | null
          created_by: string
          created_by_type: ActorType
          title: string
          description: string | null
          category: MaintenanceCategory | null
          priority: MaintenancePriority
          status: MaintenanceStatus
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['maintenance_requests']['Row'], 'id' | 'company_id' | 'priority' | 'status' | 'created_at' | 'updated_at'> & {
          id?: string
          priority?: MaintenancePriority
          status?: MaintenanceStatus
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['maintenance_requests']['Insert'], 'unit_id' | 'created_by' | 'created_by_type'>>
      }
      maintenance_comments: {
        Row: {
          id: string
          request_id: string
          company_id: string
          author_id: string
          author_type: ActorType
          body: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['maintenance_comments']['Row'], 'id' | 'company_id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: never // comments are immutable once posted
      }
      maintenance_attachments: {
        Row: {
          id: string
          request_id: string
          company_id: string
          file_url: string
          file_type: string | null
          uploaded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['maintenance_attachments']['Row'], 'id' | 'company_id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: never
      }
      maintenance_status_history: {
        Row: {
          id: string
          request_id: string
          from_status: string | null
          to_status: string
          changed_by: string
          changed_at: string
        }
        Insert: never // written only by the DB trigger
        Update: never
      }
      documents: {
        Row: {
          id: string
          company_id: string
          title: string
          file_url: string
          file_type: string | null
          category: DocumentCategory | null
          related_entity_type: DocumentRelatedEntityType
          related_entity_id: string
          visible_to_tenant: boolean
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        // company_id is server-derived (resolve_document_company_id trigger)
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'company_id' | 'visible_to_tenant' | 'created_at' | 'updated_at'> & {
          id?: string
          visible_to_tenant?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['documents']['Insert'], 'related_entity_type' | 'related_entity_id'>>
      }
      message_threads: {
        Row: {
          id: string
          company_id: string
          subject: string | null
          related_lease_id: string | null
          is_archived: boolean
          created_at: string
          last_message_at: string
        }
        Insert: Omit<Database['public']['Tables']['message_threads']['Row'], 'id' | 'is_archived' | 'created_at' | 'last_message_at'> & {
          id?: string
          is_archived?: boolean
          created_at?: string
          last_message_at?: string
        }
        Update: Partial<Pick<Database['public']['Tables']['message_threads']['Row'], 'subject' | 'is_archived'>>
      }
      thread_participants: {
        Row: {
          thread_id: string
          participant_id: string
          participant_type: ActorType
        }
        Insert: Database['public']['Tables']['thread_participants']['Row']
        Update: never
      }
      messages: {
        Row: {
          id: string
          thread_id: string
          company_id: string
          sender_id: string
          sender_type: ActorType
          body: string
          read_at: string | null
          created_at: string
        }
        // company_id is server-derived (sync_message_company_id trigger)
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'company_id' | 'read_at' | 'created_at'> & {
          id?: string
          read_at?: string | null
          created_at?: string
        }
        Update: Pick<Database['public']['Tables']['messages']['Row'], 'read_at'>
      }
      announcements: {
        Row: {
          id: string
          company_id: string
          property_id: string | null
          title: string
          body: string
          category: AnnouncementCategory
          published_at: string
          expires_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['announcements']['Row'], 'id' | 'category' | 'published_at' | 'created_at' | 'updated_at'> & {
          id?: string
          category?: AnnouncementCategory
          published_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          tenant_id: string
          read_at: string
        }
        Insert: Omit<Database['public']['Tables']['announcement_reads']['Row'], 'read_at'> & {
          read_at?: string
        }
        Update: never
      }
      audit_logs: {
        Row: {
          id: string
          company_id: string | null
          actor_id: string
          actor_type: AuditActorType
          action: string
          entity_type: string | null
          entity_id: string | null
          metadata: Json
          ip_address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'metadata' | 'created_at'> & {
          id?: string
          metadata?: Json
          created_at?: string
        }
        Update: never // append-only, enforced again at the DB level
      }
    }
    Views: Record<string, never>
    Functions: {
      is_super_admin: { Args: Record<string, never>; Returns: boolean }
      user_role_in_company: { Args: { check_company_id: string }; Returns: CompanyRole | null }
      can_view_maintenance_request: {
        Args: { check_company_id: string; check_assigned_to: string | null }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
  }
}

/** Convenience row/insert/update aliases, mirroring the generated CLI output shape. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
