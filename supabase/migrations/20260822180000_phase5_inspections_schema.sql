-- ============================================================================
-- PHASE 5: Inspections & Operational Checklists -- schema
--   Template -> Section -> Item (config, with failure rules)
--   Schedule (Location/Area/Asset, recurring) -> Occurrence (snapshotted)
--   Response (per checklist item: pass/fail/na) -> Finding (per failed item)
--   Finding -> FM Request or Work Order (FM decides; not automatic)
-- Reuses proven Phase 1-4 infrastructure: set_updated_at(), numbering via
-- sequences + BEFORE INSERT triggers, the ppm_compute_next_due() date engine,
-- the work_orders.source trigger architecture, and the RLS helper predicates.
-- No fake/seed data. RLS policies + engine + storage are in later migrations.
-- ============================================================================

-- Concurrency-safe reference numbering (atomic sequences; client never supplies).
create sequence if not exists public.inspection_template_number_seq start 1;
create sequence if not exists public.inspection_schedule_number_seq start 1;
create sequence if not exists public.inspection_number_seq start 1;

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table if not exists public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  template_number text not null,
  name text not null,
  description text,
  instructions text,
  requires_manager_review boolean not null default true,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_number)
);
create index if not exists inspection_templates_org_idx on public.inspection_templates (organization_id);
create index if not exists inspection_templates_status_idx on public.inspection_templates (status);

create table if not exists public.inspection_template_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  template_id uuid not null references public.inspection_templates(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inspection_template_sections_template_idx
  on public.inspection_template_sections (template_id, sort_order);

create table if not exists public.inspection_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  template_id uuid not null references public.inspection_templates(id) on delete cascade,
  section_id uuid references public.inspection_template_sections(id) on delete set null,
  item_text text not null,
  instructions text,
  is_required boolean not null default true,
  allow_na boolean not null default true,
  require_comment_on_fail boolean not null default false,
  require_photo_on_fail boolean not null default false,
  failure_priority_id uuid references public.fm_priorities(id) on delete set null,
  failure_category_id uuid references public.fm_categories(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inspection_template_items_template_idx
  on public.inspection_template_items (template_id, sort_order);
create index if not exists inspection_template_items_section_idx
  on public.inspection_template_items (section_id, sort_order);

-- ---------------------------------------------------------------------------
-- Schedules (Location required; Area/Asset optional -- validated by trigger)
-- Frequency stored as unit in (day|week|month|year) + interval, so the proven
-- ppm_compute_next_due() engine is reused verbatim. The UI maps its labels:
-- Daily=(day,1) Weekly=(week,1) Monthly=(month,1) Quarterly=(month,3)
-- Semi-Annual=(month,6) Annual=(year,1).
-- ---------------------------------------------------------------------------
create table if not exists public.inspection_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  schedule_number text not null,
  template_id uuid not null references public.inspection_templates(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  area_id uuid references public.areas(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  assigned_to uuid references public.profiles(id),
  frequency_unit text not null check (frequency_unit in ('day','week','month','year')),
  frequency_interval integer not null check (frequency_interval > 0),
  start_date date not null,
  scheduled_time time,
  next_due_date date not null,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, schedule_number)
);
create index if not exists inspection_schedules_org_idx on public.inspection_schedules (organization_id);
create index if not exists inspection_schedules_template_idx on public.inspection_schedules (template_id);
create index if not exists inspection_schedules_location_idx on public.inspection_schedules (location_id);
create index if not exists inspection_schedules_status_idx on public.inspection_schedules (status);
create index if not exists inspection_schedules_next_due_idx on public.inspection_schedules (next_due_date);

-- ---------------------------------------------------------------------------
-- Occurrences (a generated inspection instance) + snapshotted responses
-- ---------------------------------------------------------------------------
create table if not exists public.inspection_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  inspection_number text not null,
  schedule_id uuid not null references public.inspection_schedules(id) on delete cascade,
  template_id uuid not null references public.inspection_templates(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  area_id uuid references public.areas(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  assigned_to uuid references public.profiles(id),
  requires_manager_review boolean not null default true,
  scheduled_date date not null,
  scheduled_time time,
  status text not null default 'scheduled'
    check (status in ('scheduled','due','in_progress','submitted','reviewed','closed','skipped','cancelled')),
  overall_result text check (overall_result in ('pass','fail','incomplete')),
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  closed_at timestamptz,
  skipped_by uuid references public.profiles(id),
  skipped_at timestamptz,
  skip_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, inspection_number),
  unique (schedule_id, scheduled_date)
);
create index if not exists inspection_occurrences_org_idx on public.inspection_occurrences (organization_id);
create index if not exists inspection_occurrences_schedule_idx on public.inspection_occurrences (schedule_id);
create index if not exists inspection_occurrences_assigned_idx on public.inspection_occurrences (assigned_to);
create index if not exists inspection_occurrences_status_idx on public.inspection_occurrences (status);
create index if not exists inspection_occurrences_sched_date_idx on public.inspection_occurrences (scheduled_date);
create index if not exists inspection_occurrences_asset_idx on public.inspection_occurrences (asset_id);
create index if not exists inspection_occurrences_location_idx on public.inspection_occurrences (location_id);

create table if not exists public.inspection_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  inspection_id uuid not null references public.inspection_occurrences(id) on delete cascade,
  template_item_id uuid references public.inspection_template_items(id) on delete set null,
  section_name_snapshot text,
  item_text_snapshot text not null,
  instructions_snapshot text,
  is_required boolean not null default true,
  allow_na boolean not null default true,
  require_comment_on_fail boolean not null default false,
  require_photo_on_fail boolean not null default false,
  failure_priority_id uuid references public.fm_priorities(id) on delete set null,
  failure_category_id uuid references public.fm_categories(id) on delete set null,
  result text check (result in ('pass','fail','na')),
  comment text,
  responded_by uuid references public.profiles(id),
  responded_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inspection_responses_inspection_idx
  on public.inspection_responses (inspection_id, sort_order);
create index if not exists inspection_responses_org_idx on public.inspection_responses (organization_id);

-- ---------------------------------------------------------------------------
-- Findings (one per failed response) -> may become an FM Request or Work Order
-- ---------------------------------------------------------------------------
create table if not exists public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  inspection_id uuid not null references public.inspection_occurrences(id) on delete cascade,
  response_id uuid not null references public.inspection_responses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  area_id uuid references public.areas(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  category_id uuid references public.fm_categories(id) on delete set null,
  priority_id uuid references public.fm_priorities(id) on delete set null,
  description text not null,
  status text not null default 'open'
    check (status in ('open','action_required','fm_request_created','work_order_created','resolved','dismissed')),
  fm_request_id uuid references public.fm_requests(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  resolution_notes text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  dismissed_by uuid references public.profiles(id),
  dismissed_at timestamptz,
  dismissal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (response_id)  -- exactly one finding per failed response
);
create index if not exists inspection_findings_org_idx on public.inspection_findings (organization_id);
create index if not exists inspection_findings_inspection_idx on public.inspection_findings (inspection_id);
create index if not exists inspection_findings_status_idx on public.inspection_findings (status);
create index if not exists inspection_findings_asset_idx on public.inspection_findings (asset_id);
create index if not exists inspection_findings_location_idx on public.inspection_findings (location_id);

create table if not exists public.inspection_response_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  inspection_id uuid not null references public.inspection_occurrences(id) on delete cascade,
  response_id uuid not null references public.inspection_responses(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists inspection_response_attachments_response_idx
  on public.inspection_response_attachments (response_id);
create index if not exists inspection_response_attachments_inspection_idx
  on public.inspection_response_attachments (inspection_id);
create index if not exists inspection_response_attachments_org_idx
  on public.inspection_response_attachments (organization_id);

create table if not exists public.inspection_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  template_id uuid references public.inspection_templates(id) on delete set null,
  schedule_id uuid references public.inspection_schedules(id) on delete set null,
  occurrence_id uuid references public.inspection_occurrences(id) on delete set null,
  finding_id uuid references public.inspection_findings(id) on delete set null,
  actor_id uuid references public.profiles(id),
  is_system boolean not null default false,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists inspection_activity_occurrence_idx
  on public.inspection_activity (occurrence_id, created_at desc);
create index if not exists inspection_activity_template_idx
  on public.inspection_activity (template_id, created_at desc);
create index if not exists inspection_activity_org_idx on public.inspection_activity (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Extend Work Order + FM Request source architecture to include 'inspection'.
-- Precedence keeps existing chains intact: ppm > fm_request > inspection > direct.
-- A finding that creates an FM Request first, then a WO from that request, keeps
-- the WO as 'fm_request' (it carries fm_request_id, not inspection_finding_id).
-- ---------------------------------------------------------------------------
alter table public.work_orders
  add column if not exists inspection_finding_id uuid references public.inspection_findings(id) on delete set null;
create index if not exists work_orders_inspection_finding_idx on public.work_orders (inspection_finding_id);

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'work_orders_source_check') then
    alter table public.work_orders drop constraint work_orders_source_check;
  end if;
  alter table public.work_orders
    add constraint work_orders_source_check check (source in ('fm_request','direct','ppm','inspection'));
end $$;

create or replace function public.set_work_order_source()
returns trigger language plpgsql set search_path = public as $$
begin
  new.source := case
    when new.ppm_plan_id is not null then 'ppm'
    when new.fm_request_id is not null then 'fm_request'
    when new.inspection_finding_id is not null then 'inspection'
    else 'direct' end;
  return new;
end; $$;
-- trigger set_work_order_source already exists (Phase 4); function body updated in place.
revoke execute on function public.set_work_order_source() from public, anon, authenticated;

alter table public.fm_requests
  add column if not exists source text not null default 'direct',
  add column if not exists inspection_finding_id uuid references public.inspection_findings(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fm_requests_source_check') then
    alter table public.fm_requests add constraint fm_requests_source_check check (source in ('direct','inspection'));
  end if;
end $$;
create index if not exists fm_requests_inspection_finding_idx on public.fm_requests (inspection_finding_id);

create or replace function public.set_fm_request_source()
returns trigger language plpgsql set search_path = public as $$
begin
  new.source := case when new.inspection_finding_id is not null then 'inspection' else 'direct' end;
  return new;
end; $$;
drop trigger if exists set_fm_request_source on public.fm_requests;
create trigger set_fm_request_source before insert or update on public.fm_requests
  for each row execute function public.set_fm_request_source();
revoke execute on function public.set_fm_request_source() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Numbering triggers (IT- / ISCH- / INS-)
-- ---------------------------------------------------------------------------
create or replace function public.assign_inspection_template_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.template_number is null or new.template_number = '' then
    new.template_number := 'IT-' || lpad(nextval('public.inspection_template_number_seq')::text, 6, '0');
  end if;
  return new;
end; $$;
drop trigger if exists assign_inspection_template_number on public.inspection_templates;
create trigger assign_inspection_template_number before insert on public.inspection_templates
  for each row execute function public.assign_inspection_template_number();

create or replace function public.assign_inspection_schedule_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.schedule_number is null or new.schedule_number = '' then
    new.schedule_number := 'ISCH-' || lpad(nextval('public.inspection_schedule_number_seq')::text, 6, '0');
  end if;
  return new;
end; $$;
drop trigger if exists assign_inspection_schedule_number on public.inspection_schedules;
create trigger assign_inspection_schedule_number before insert on public.inspection_schedules
  for each row execute function public.assign_inspection_schedule_number();

create or replace function public.assign_inspection_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.inspection_number is null or new.inspection_number = '' then
    new.inspection_number := 'INS-' || lpad(nextval('public.inspection_number_seq')::text, 6, '0');
  end if;
  return new;
end; $$;
drop trigger if exists assign_inspection_number on public.inspection_occurrences;
create trigger assign_inspection_number before insert on public.inspection_occurrences
  for each row execute function public.assign_inspection_number();

-- ---------------------------------------------------------------------------
-- Hierarchy integrity (Location -> Area -> Asset) for schedules & occurrences.
-- Mirrors enforce_fm_request_integrity(): any area/asset must line up with the
-- selected location and the org.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_inspection_hierarchy()
returns trigger language plpgsql security definer set search_path = public as $$
declare loc_org uuid; area_org uuid; area_loc uuid; asset_org uuid; asset_loc uuid; asset_area uuid;
begin
  select organization_id into loc_org from public.locations where id = new.location_id;
  if loc_org is distinct from new.organization_id then
    raise exception 'Location must belong to the organization.' using errcode = '23514';
  end if;
  if new.area_id is not null then
    select organization_id, location_id into area_org, area_loc from public.areas where id = new.area_id;
    if area_loc is distinct from new.location_id then
      raise exception 'Selected area does not belong to the selected location.' using errcode = '23514';
    end if;
    if area_org is distinct from new.organization_id then
      raise exception 'Area must belong to the organization.' using errcode = '23514';
    end if;
  end if;
  if new.asset_id is not null then
    select organization_id, location_id, area_id into asset_org, asset_loc, asset_area from public.assets where id = new.asset_id;
    if asset_loc is distinct from new.location_id then
      raise exception 'Selected asset does not belong to the selected location.' using errcode = '23514';
    end if;
    if new.area_id is not null and asset_area is distinct from new.area_id then
      raise exception 'Selected asset does not belong to the selected area.' using errcode = '23514';
    end if;
    if asset_org is distinct from new.organization_id then
      raise exception 'Asset must belong to the organization.' using errcode = '23514';
    end if;
  end if;
  return new;
end; $$;
revoke execute on function public.enforce_inspection_hierarchy() from public, anon, authenticated;

drop trigger if exists enforce_inspection_schedule_hierarchy on public.inspection_schedules;
create trigger enforce_inspection_schedule_hierarchy before insert or update on public.inspection_schedules
  for each row execute function public.enforce_inspection_hierarchy();

drop trigger if exists enforce_inspection_occurrence_hierarchy on public.inspection_occurrences;
create trigger enforce_inspection_occurrence_hierarchy before insert or update on public.inspection_occurrences
  for each row execute function public.enforce_inspection_hierarchy();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists set_inspection_templates_updated_at on public.inspection_templates;
create trigger set_inspection_templates_updated_at before update on public.inspection_templates
  for each row execute function public.set_updated_at();
drop trigger if exists set_inspection_template_sections_updated_at on public.inspection_template_sections;
create trigger set_inspection_template_sections_updated_at before update on public.inspection_template_sections
  for each row execute function public.set_updated_at();
drop trigger if exists set_inspection_template_items_updated_at on public.inspection_template_items;
create trigger set_inspection_template_items_updated_at before update on public.inspection_template_items
  for each row execute function public.set_updated_at();
drop trigger if exists set_inspection_schedules_updated_at on public.inspection_schedules;
create trigger set_inspection_schedules_updated_at before update on public.inspection_schedules
  for each row execute function public.set_updated_at();
drop trigger if exists set_inspection_occurrences_updated_at on public.inspection_occurrences;
create trigger set_inspection_occurrences_updated_at before update on public.inspection_occurrences
  for each row execute function public.set_updated_at();
drop trigger if exists set_inspection_responses_updated_at on public.inspection_responses;
create trigger set_inspection_responses_updated_at before update on public.inspection_responses
  for each row execute function public.set_updated_at();
drop trigger if exists set_inspection_findings_updated_at on public.inspection_findings;
create trigger set_inspection_findings_updated_at before update on public.inspection_findings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enable RLS on every new table (policies added in the RLS migration).
-- ---------------------------------------------------------------------------
alter table public.inspection_templates enable row level security;
alter table public.inspection_template_sections enable row level security;
alter table public.inspection_template_items enable row level security;
alter table public.inspection_schedules enable row level security;
alter table public.inspection_occurrences enable row level security;
alter table public.inspection_responses enable row level security;
alter table public.inspection_findings enable row level security;
alter table public.inspection_response_attachments enable row level security;
alter table public.inspection_activity enable row level security;
