-- ============================================================================
-- PHASE 6: Vendors & Service Contracts
-- Facility-Management vendor administration and service-contract visibility.
-- This is NOT procurement: no PR/RFQ/PO/quotation/approval/receiving/payment.
-- All objects are organization-scoped; RLS is added in the RLS migration.
-- Reference numbers are database-controlled and concurrency-safe via sequences.
-- Contract "expiring soon"/"expired" are DERIVED from end_date at read time
-- (no scheduler needed); the stored status holds only the lifecycle state.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sequences for human-readable references. UUID remains the primary key.
-- ---------------------------------------------------------------------------
create sequence if not exists public.vendor_number_seq start 1;
create sequence if not exists public.service_contract_number_seq start 1;

-- ---------------------------------------------------------------------------
-- Vendor service categories (configurable records, not a hard-coded enum).
-- ---------------------------------------------------------------------------
create table public.vendor_service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index vendor_service_categories_org_idx
  on public.vendor_service_categories (organization_id, sort_order);
create trigger set_vendor_service_categories_updated_at
  before update on public.vendor_service_categories
  for each row execute function public.set_updated_at();
alter table public.vendor_service_categories enable row level security;

-- ---------------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  vendor_number text not null,
  vendor_code text,
  company_name text not null,
  trading_name text,
  service_category_id uuid references public.vendor_service_categories(id) on delete set null,
  contact_person text,
  phone text,
  mobile text,
  email text,
  website text,
  address text,
  notes text,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vendor_number),
  unique (id, organization_id)  -- tenant-safe composite FK target
);
create index vendors_org_idx on public.vendors (organization_id, company_name);
create index vendors_category_idx on public.vendors (service_category_id);
create index vendors_status_idx on public.vendors (organization_id, status);
create trigger set_vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();
alter table public.vendors enable row level security;

create or replace function public.set_vendor_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.vendor_number is null or new.vendor_number = '' then
    new.vendor_number := 'VEN-' || lpad(nextval('public.vendor_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger set_vendor_number before insert on public.vendors
  for each row execute function public.set_vendor_number();

-- ---------------------------------------------------------------------------
-- Vendor contacts (a vendor may have several).
-- ---------------------------------------------------------------------------
create table public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  vendor_id uuid not null,
  full_name text not null,
  job_title text,
  department text,
  contact_type text,        -- e.g. Primary / Technical / Emergency / Account (free label)
  phone text,
  mobile text,
  email text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (vendor_id, organization_id)
    references public.vendors (id, organization_id) on delete cascade
);
create index vendor_contacts_vendor_idx on public.vendor_contacts (vendor_id);
create trigger set_vendor_contacts_updated_at before update on public.vendor_contacts
  for each row execute function public.set_updated_at();
alter table public.vendor_contacts enable row level security;

-- ---------------------------------------------------------------------------
-- Vendor documents (private storage; metadata only here).
-- ---------------------------------------------------------------------------
create table public.vendor_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  vendor_id uuid not null,
  document_type text,
  document_name text not null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  issue_date date,
  expiry_date date,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (vendor_id, organization_id)
    references public.vendors (id, organization_id) on delete cascade
);
create index vendor_documents_vendor_idx on public.vendor_documents (vendor_id);
create index vendor_documents_expiry_idx on public.vendor_documents (organization_id, expiry_date);
alter table public.vendor_documents enable row level security;

-- ---------------------------------------------------------------------------
-- Service contracts. Lifecycle status is stored; expiring/expired are derived
-- from end_date at read time. contract_value is informational only (no finance).
-- ---------------------------------------------------------------------------
create table public.service_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  contract_number text not null,
  vendor_id uuid not null,
  name text not null,
  contract_type text,       -- configurable label (AMC, Service Agreement, Warranty, ...)
  description text,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('draft','active','terminated','archived')),
  contract_value numeric(14,2),
  currency text,
  contact_person_id uuid,
  response_time_notes text,
  service_scope text,
  renewal_notes text,
  auto_renewal boolean,
  termination_notice_days integer,
  renewed_from_id uuid references public.service_contracts(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_number),
  unique (id, organization_id),
  check (end_date >= start_date),
  foreign key (vendor_id, organization_id)
    references public.vendors (id, organization_id) on delete restrict,
  foreign key (contact_person_id, organization_id)
    references public.vendor_contacts (id, organization_id) on delete set null
);
create index service_contracts_org_idx on public.service_contracts (organization_id, status);
create index service_contracts_vendor_idx on public.service_contracts (vendor_id);
create index service_contracts_end_idx on public.service_contracts (organization_id, end_date);
create trigger set_service_contracts_updated_at before update on public.service_contracts
  for each row execute function public.set_updated_at();
alter table public.service_contracts enable row level security;

create or replace function public.set_service_contract_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.contract_number is null or new.contract_number = '' then
    new.contract_number := 'CON-' || lpad(nextval('public.service_contract_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger set_service_contract_number before insert on public.service_contracts
  for each row execute function public.set_service_contract_number();

-- ---------------------------------------------------------------------------
-- Service contract documents (private storage).
-- ---------------------------------------------------------------------------
create table public.service_contract_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  contract_id uuid not null,
  document_type text,
  document_name text not null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (contract_id, organization_id)
    references public.service_contracts (id, organization_id) on delete cascade
);
create index service_contract_documents_contract_idx on public.service_contract_documents (contract_id);
alter table public.service_contract_documents enable row level security;

-- ---------------------------------------------------------------------------
-- Vendor <-> Location coverage.
-- ---------------------------------------------------------------------------
create table public.vendor_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  vendor_id uuid not null,
  location_id uuid not null references public.locations(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (vendor_id, location_id),
  foreign key (vendor_id, organization_id)
    references public.vendors (id, organization_id) on delete cascade
);
create index vendor_locations_vendor_idx on public.vendor_locations (vendor_id);
create index vendor_locations_location_idx on public.vendor_locations (location_id);
alter table public.vendor_locations enable row level security;

-- ---------------------------------------------------------------------------
-- Contract <-> Location coverage (may differ from vendor coverage).
-- ---------------------------------------------------------------------------
create table public.service_contract_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  contract_id uuid not null,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contract_id, location_id),
  foreign key (contract_id, organization_id)
    references public.service_contracts (id, organization_id) on delete cascade
);
create index service_contract_locations_contract_idx on public.service_contract_locations (contract_id);
create index service_contract_locations_location_idx on public.service_contract_locations (location_id);
alter table public.service_contract_locations enable row level security;

-- ---------------------------------------------------------------------------
-- Vendor <-> Asset relationship.
-- ---------------------------------------------------------------------------
create table public.vendor_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  vendor_id uuid not null,
  asset_id uuid not null references public.assets(id) on delete cascade,
  relationship_type text,   -- Maintenance Provider / Warranty Provider / Installer / ...
  service_contract_id uuid,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, asset_id, relationship_type),
  foreign key (vendor_id, organization_id)
    references public.vendors (id, organization_id) on delete cascade,
  foreign key (service_contract_id, organization_id)
    references public.service_contracts (id, organization_id) on delete set null
);
create index vendor_assets_vendor_idx on public.vendor_assets (vendor_id);
create index vendor_assets_asset_idx on public.vendor_assets (asset_id);
create trigger set_vendor_assets_updated_at before update on public.vendor_assets
  for each row execute function public.set_updated_at();
alter table public.vendor_assets enable row level security;

-- ---------------------------------------------------------------------------
-- Contract <-> Asset coverage.
-- ---------------------------------------------------------------------------
create table public.service_contract_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  contract_id uuid not null,
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contract_id, asset_id),
  foreign key (contract_id, organization_id)
    references public.service_contracts (id, organization_id) on delete cascade
);
create index service_contract_assets_contract_idx on public.service_contract_assets (contract_id);
create index service_contract_assets_asset_idx on public.service_contract_assets (asset_id);
alter table public.service_contract_assets enable row level security;

-- ---------------------------------------------------------------------------
-- Vendor activity (audit). Written only by SECURITY DEFINER triggers/logger;
-- no client INSERT policy is granted (see RLS migration).
-- ---------------------------------------------------------------------------
create table public.vendor_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  vendor_id uuid,
  contract_id uuid,
  action text not null,
  detail text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index vendor_activity_vendor_idx on public.vendor_activity (vendor_id, created_at desc);
create index vendor_activity_contract_idx on public.vendor_activity (contract_id, created_at desc);
create index vendor_activity_org_idx on public.vendor_activity (organization_id);
alter table public.vendor_activity enable row level security;

-- ---------------------------------------------------------------------------
-- Work Order external-vendor fields (all nullable; vendors are optional).
-- Composite FKs keep vendor/contract/contact within the work order's org.
-- ---------------------------------------------------------------------------
alter table public.work_orders
  add column if not exists vendor_id uuid,
  add column if not exists vendor_contact_id uuid,
  add column if not exists service_contract_id uuid,
  add column if not exists vendor_reference text,
  add column if not exists vendor_expected_date date;

alter table public.work_orders
  add constraint work_orders_vendor_fk
    foreign key (vendor_id, organization_id)
    references public.vendors (id, organization_id) on delete set null;
alter table public.work_orders
  add constraint work_orders_vendor_contact_fk
    foreign key (vendor_contact_id, organization_id)
    references public.vendor_contacts (id, organization_id) on delete set null;
alter table public.work_orders
  add constraint work_orders_service_contract_fk
    foreign key (service_contract_id, organization_id)
    references public.service_contracts (id, organization_id) on delete set null;
create index if not exists work_orders_vendor_idx on public.work_orders (vendor_id);

-- ---------------------------------------------------------------------------
-- Work Order vendor service notes (§22): FM/authorized technician records
-- external service interaction. Simple typed note; not a vendor portal.
-- ---------------------------------------------------------------------------
create table public.work_order_vendor_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  note_type text,           -- contacted / scheduled / attended / diagnosis / work_performed / follow_up
  note text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index work_order_vendor_notes_wo_idx on public.work_order_vendor_notes (work_order_id, created_at desc);
alter table public.work_order_vendor_notes enable row level security;

-- ============================================================================
-- Tenant integrity for references to EXISTING tables (locations, assets):
-- composite FKs above cover Phase-6-to-Phase-6 links; these triggers cover
-- links to locations/assets, whose (id, organization_id) is not a unique key.
-- ============================================================================
create or replace function public.phase6_assert_location_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.locations where id = new.location_id;
  if v_org is null then raise exception 'Location % not found', new.location_id; end if;
  if v_org is distinct from new.organization_id then
    raise exception 'Location % is not in organization %', new.location_id, new.organization_id;
  end if;
  return new;
end;
$$;
create trigger vendor_locations_org_check before insert or update on public.vendor_locations
  for each row execute function public.phase6_assert_location_org();
create trigger service_contract_locations_org_check before insert or update on public.service_contract_locations
  for each row execute function public.phase6_assert_location_org();

create or replace function public.phase6_assert_asset_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.assets where id = new.asset_id;
  if v_org is null then raise exception 'Asset % not found', new.asset_id; end if;
  if v_org is distinct from new.organization_id then
    raise exception 'Asset % is not in organization %', new.asset_id, new.organization_id;
  end if;
  return new;
end;
$$;
create trigger vendor_assets_org_check before insert or update on public.vendor_assets
  for each row execute function public.phase6_assert_asset_org();
create trigger service_contract_assets_org_check before insert or update on public.service_contract_assets
  for each row execute function public.phase6_assert_asset_org();

-- ============================================================================
-- Work Order vendor assignment integrity (§41):
--  * a contract linked to the WO must belong to the selected vendor;
--  * a contact linked to the WO must belong to the selected vendor;
--  * an INACTIVE / suspended vendor cannot be newly assigned (existing links
--    are preserved on later deactivation because we only check on change).
-- ============================================================================
create or replace function public.phase6_wo_vendor_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text; v_vendor uuid;
begin
  if new.vendor_id is not null then
    -- enforce active vendor only when the vendor is being set or changed
    if tg_op = 'INSERT' or new.vendor_id is distinct from old.vendor_id then
      select status into v_status from public.vendors where id = new.vendor_id;
      if v_status is distinct from 'active' then
        raise exception 'Vendor % is not active and cannot be assigned to a work order', new.vendor_id;
      end if;
    end if;
    if new.service_contract_id is not null then
      select vendor_id into v_vendor from public.service_contracts where id = new.service_contract_id;
      if v_vendor is distinct from new.vendor_id then
        raise exception 'Service contract % does not belong to vendor %', new.service_contract_id, new.vendor_id;
      end if;
    end if;
    if new.vendor_contact_id is not null then
      select vendor_id into v_vendor from public.vendor_contacts where id = new.vendor_contact_id;
      if v_vendor is distinct from new.vendor_id then
        raise exception 'Vendor contact % does not belong to vendor %', new.vendor_contact_id, new.vendor_id;
      end if;
    end if;
  else
    -- no vendor: dependent fields must be empty
    if new.service_contract_id is not null or new.vendor_contact_id is not null then
      raise exception 'Vendor contact/contract cannot be set without a vendor';
    end if;
  end if;
  return new;
end;
$$;
create trigger work_orders_vendor_integrity before insert or update on public.work_orders
  for each row execute function public.phase6_wo_vendor_check();

-- ============================================================================
-- Vendor activity logger + triggers (audit; client cannot forge).
-- ============================================================================
create or replace function public.log_vendor_activity(
  p_org uuid, p_vendor uuid, p_contract uuid, p_action text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.vendor_activity (organization_id, vendor_id, contract_id, action, detail, actor_id)
  values (p_org, p_vendor, p_contract, p_action, p_detail, auth.uid());
end;
$$;

create or replace function public.trg_vendor_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_vendor_activity(new.organization_id, new.id, null, 'vendor_created',
      'Vendor ' || new.vendor_number || ' (' || new.company_name || ') created');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform public.log_vendor_activity(new.organization_id, new.id, null, 'vendor_status_changed',
        'Status ' || old.status || ' -> ' || new.status);
    else
      perform public.log_vendor_activity(new.organization_id, new.id, null, 'vendor_updated',
        'Vendor details updated');
    end if;
  end if;
  return null;
end;
$$;
create trigger vendors_activity after insert or update on public.vendors
  for each row execute function public.trg_vendor_activity();

create or replace function public.trg_vendor_contact_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_vendor_activity(new.organization_id, new.vendor_id, null, 'contact_added',
    'Contact ' || new.full_name || ' added');
  return null;
end;
$$;
create trigger vendor_contacts_activity after insert on public.vendor_contacts
  for each row execute function public.trg_vendor_contact_activity();

create or replace function public.trg_vendor_document_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_vendor_activity(new.organization_id, new.vendor_id, null, 'document_uploaded',
    'Document ' || coalesce(new.document_name, new.file_name) || ' uploaded');
  return null;
end;
$$;
create trigger vendor_documents_activity after insert on public.vendor_documents
  for each row execute function public.trg_vendor_document_activity();

create or replace function public.trg_contract_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_vendor_activity(new.organization_id, new.vendor_id, new.id, 'contract_created',
      'Contract ' || new.contract_number || ' (' || new.name || ') created');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_vendor_activity(new.organization_id, new.vendor_id, new.id, 'contract_status_changed',
      'Contract ' || new.contract_number || ': ' || old.status || ' -> ' || new.status);
  end if;
  return null;
end;
$$;
create trigger service_contracts_activity after insert or update on public.service_contracts
  for each row execute function public.trg_contract_activity();

create or replace function public.trg_vendor_asset_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_vendor_activity(new.organization_id, new.vendor_id, new.service_contract_id, 'asset_linked',
    'Asset linked to vendor');
  return null;
end;
$$;
create trigger vendor_assets_activity after insert on public.vendor_assets
  for each row execute function public.trg_vendor_asset_activity();

create or replace function public.trg_vendor_location_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_vendor_activity(new.organization_id, new.vendor_id, null, 'location_linked',
    'Location linked to vendor');
  return null;
end;
$$;
create trigger vendor_locations_activity after insert on public.vendor_locations
  for each row execute function public.trg_vendor_location_activity();

-- ============================================================================
-- Seed configurable vendor service categories for the SOCIETY organization.
-- (Categories are configuration, explicitly permitted to be seeded; no fake
-- vendors/contracts/documents are created.)
-- ============================================================================
insert into public.vendor_service_categories (organization_id, name, code, sort_order)
select o.id, v.name, v.code, v.sort_order
from public.organizations o
join (values
  ('HVAC','hvac',1),
  ('Electrical','electrical',2),
  ('Plumbing','plumbing',3),
  ('Civil','civil',4),
  ('Carpentry','carpentry',5),
  ('Gym Equipment','gym_equipment',6),
  ('Pool Equipment','pool_equipment',7),
  ('Sauna / Steam','sauna_steam',8),
  ('Fire & Life Safety','fire_life_safety',9),
  ('Access Control','access_control',10),
  ('IT / Low Current','it_low_current',11),
  ('Cleaning','cleaning',12),
  ('Pest Control','pest_control',13),
  ('Landscaping','landscaping',14),
  ('Elevators / Lifts','elevators_lifts',15),
  ('Specialist Equipment','specialist_equipment',16),
  ('Indoor Ski Equipment','indoor_ski_equipment',17),
  ('General Maintenance','general_maintenance',18),
  ('Other','other',99)
) as v(name, code, sort_order) on true
where o.code = 'SOCIETY'
on conflict (organization_id, code) do nothing;
