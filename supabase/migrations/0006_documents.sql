-- ============================================================================
-- 0006_documents.sql
-- documents — polymorphic association to lease/unit/property/company.
--
-- related_entity_type/related_entity_id avoids four nullable FK columns.
-- Same trade-off as maintenance author columns: no DB-enforced FK on the
-- polymorphic side. RLS resolves the entity's company_id via
-- resolve_document_company_id() below rather than trusting a client-supplied
-- company_id at all.
-- ============================================================================

create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  file_url text not null,
  file_type text,
  category text
    check (category in ('lease_agreement', 'inspection_report', 'invoice', 'policy', 'other')),
  related_entity_type text not null
    check (related_entity_type in ('lease', 'unit', 'property', 'company')),
  related_entity_id uuid not null,
  visible_to_tenant boolean not null default false,
  uploaded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_documents_updated_at
  before update on documents
  for each row execute function touch_updated_at();

create index idx_documents_company on documents(company_id);
create index idx_documents_related on documents(related_entity_type, related_entity_id);
create index idx_documents_visible_to_tenant on documents(company_id, visible_to_tenant)
  where visible_to_tenant = true;

-- ----------------------------------------------------------------------------
-- resolve_document_company_id(entity_type, entity_id)
-- Used both by the insert-time sync trigger and (indirectly) by RLS to
-- confirm a document's claimed company_id actually matches its target entity.
-- ----------------------------------------------------------------------------
create or replace function resolve_document_company_id(entity_type text, entity_id uuid)
returns uuid
language plpgsql
stable
as $$
declare
  resolved_company_id uuid;
begin
  if entity_type = 'company' then
    return entity_id;
  elsif entity_type = 'property' then
    select company_id into resolved_company_id from properties where id = entity_id;
  elsif entity_type = 'unit' then
    select company_id into resolved_company_id from units where id = entity_id;
  elsif entity_type = 'lease' then
    select company_id into resolved_company_id from leases where id = entity_id;
  end if;
  return resolved_company_id;
end;
$$;

create or replace function sync_document_company_id()
returns trigger
language plpgsql
as $$
begin
  new.company_id = resolve_document_company_id(new.related_entity_type, new.related_entity_id);
  return new;
end;
$$;

create trigger trg_sync_document_company_id
  before insert on documents
  for each row execute function sync_document_company_id();

-- ----------------------------------------------------------------------------
-- tenant_can_view_document(doc documents)
-- A tenant can see a document if visible_to_tenant is true AND the document
-- is tied to their own lease/unit (not just anywhere in the company).
-- Company-wide documents (related_entity_type = 'company') are visible to
-- all tenants of that company when flagged visible_to_tenant.
-- ----------------------------------------------------------------------------
create or replace function tenant_can_view_document(
  doc_related_entity_type text,
  doc_related_entity_id uuid,
  doc_visible_to_tenant boolean
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select doc_visible_to_tenant and (
    doc_related_entity_type = 'company'
    or (doc_related_entity_type = 'lease' and doc_related_entity_id in (select tenant_lease_ids()))
    or (doc_related_entity_type = 'unit' and doc_related_entity_id in (select tenant_unit_ids()))
  );
$$;

alter table documents enable row level security;
