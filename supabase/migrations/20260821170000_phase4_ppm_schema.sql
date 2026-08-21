-- ============================================================================
-- PHASE 4: Preventive Maintenance / PPM -- schema, WO extension, numbering, RLS
-- (Applied live 2026-08-21. See engine + hardening migrations that follow.)
-- ============================================================================
create sequence if not exists public.ppm_number_seq start 1;

create table if not exists public.ppm_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ppm_number text not null unique,
  asset_id uuid not null references public.assets(id),
  category_id uuid not null references public.fm_categories(id),
  name text not null,
  description text,
  maintenance_instructions text,
  priority_id uuid not null references public.fm_priorities(id),
  frequency_unit text not null check (frequency_unit in ('day','week','month','year')),
  frequency_interval integer not null check (frequency_interval > 0),
  start_date date not null,
  next_due_date date not null,
  last_completed_at timestamptz,
  default_assigned_to uuid references public.profiles(id),
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  due_window_days integer check (due_window_days is null or due_window_days >= 0),
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ppm_plans_org_idx on public.ppm_plans (organization_id);
create index if not exists ppm_plans_asset_idx on public.ppm_plans (asset_id);
create index if not exists ppm_plans_status_idx on public.ppm_plans (status);
create index if not exists ppm_plans_next_due_idx on public.ppm_plans (next_due_date);

create table if not exists public.ppm_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ppm_plan_id uuid not null references public.ppm_plans(id) on delete cascade,
  task_description text not null,
  instructions text,
  is_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ppm_plan_tasks_plan_idx on public.ppm_plan_tasks (ppm_plan_id, sort_order);

create table if not exists public.ppm_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ppm_plan_id uuid not null references public.ppm_plans(id) on delete cascade,
  scheduled_date date not null,
  due_date date not null,
  status text not null default 'upcoming'
    check (status in ('upcoming','due','work_order_created','completed','skipped','cancelled')),
  work_order_id uuid references public.work_orders(id),
  generated_at timestamptz, completed_at timestamptz,
  skipped_at timestamptz, skipped_by uuid references public.profiles(id), skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ppm_plan_id, scheduled_date)
);
create unique index if not exists ppm_occurrences_wo_uniq on public.ppm_occurrences (work_order_id) where work_order_id is not null;
create index if not exists ppm_occurrences_plan_idx on public.ppm_occurrences (ppm_plan_id);
create index if not exists ppm_occurrences_status_idx on public.ppm_occurrences (status);
create index if not exists ppm_occurrences_sched_idx on public.ppm_occurrences (scheduled_date);

create table if not exists public.work_order_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  ppm_plan_task_id uuid references public.ppm_plan_tasks(id) on delete set null,
  task_description text not null,
  instructions text,
  is_required boolean not null default true,
  is_completed boolean not null default false,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_order_tasks_wo_idx on public.work_order_tasks (work_order_id, sort_order);

create table if not exists public.ppm_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ppm_plan_id uuid references public.ppm_plans(id) on delete set null,
  occurrence_id uuid references public.ppm_occurrences(id) on delete set null,
  actor_id uuid references public.profiles(id),
  is_system boolean not null default false,
  action text not null, field_name text, old_value text, new_value text, metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ppm_activity_plan_idx on public.ppm_activity (ppm_plan_id, created_at desc);

alter table public.work_orders add column if not exists source text not null default 'direct';
alter table public.work_orders add column if not exists ppm_plan_id uuid references public.ppm_plans(id);
alter table public.work_orders add column if not exists ppm_occurrence_id uuid references public.ppm_occurrences(id);
update public.work_orders set source = case when fm_request_id is not null then 'fm_request' else 'direct' end;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'work_orders_source_check') then
    alter table public.work_orders add constraint work_orders_source_check check (source in ('fm_request','direct','ppm'));
  end if;
end $$;
create index if not exists work_orders_ppm_plan_idx on public.work_orders (ppm_plan_id);
create index if not exists work_orders_source_idx on public.work_orders (source);

create or replace function public.set_work_order_source()
returns trigger language plpgsql set search_path = public as $$
begin
  new.source := case when new.ppm_plan_id is not null then 'ppm'
                     when new.fm_request_id is not null then 'fm_request' else 'direct' end;
  return new;
end; $$;
drop trigger if exists set_work_order_source on public.work_orders;
create trigger set_work_order_source before insert or update on public.work_orders
  for each row execute function public.set_work_order_source();

create or replace function public.assign_ppm_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ppm_number is null or new.ppm_number = '' then
    new.ppm_number := 'PPM-' || lpad(nextval('public.ppm_number_seq')::text, 6, '0');
  end if;
  return new;
end; $$;
drop trigger if exists assign_ppm_number on public.ppm_plans;
create trigger assign_ppm_number before insert on public.ppm_plans for each row execute function public.assign_ppm_number();

drop trigger if exists set_ppm_plans_updated_at on public.ppm_plans;
create trigger set_ppm_plans_updated_at before update on public.ppm_plans for each row execute function public.set_updated_at();
drop trigger if exists set_ppm_plan_tasks_updated_at on public.ppm_plan_tasks;
create trigger set_ppm_plan_tasks_updated_at before update on public.ppm_plan_tasks for each row execute function public.set_updated_at();
drop trigger if exists set_ppm_occurrences_updated_at on public.ppm_occurrences;
create trigger set_ppm_occurrences_updated_at before update on public.ppm_occurrences for each row execute function public.set_updated_at();
drop trigger if exists set_work_order_tasks_updated_at on public.work_order_tasks;
create trigger set_work_order_tasks_updated_at before update on public.work_order_tasks for each row execute function public.set_updated_at();

alter table public.ppm_plans enable row level security;
alter table public.ppm_plan_tasks enable row level security;
alter table public.ppm_occurrences enable row level security;
alter table public.work_order_tasks enable row level security;
alter table public.ppm_activity enable row level security;

create policy "Read ppm_plans" on public.ppm_plans for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.current_user_is_active());
create policy "Insert ppm_plans" on public.ppm_plans for insert to authenticated
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility() and created_by = auth.uid());
create policy "Update ppm_plans" on public.ppm_plans for update to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

create policy "Read ppm_plan_tasks" on public.ppm_plan_tasks for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.current_user_is_active());
create policy "Write ppm_plan_tasks" on public.ppm_plan_tasks for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

create policy "Read ppm_occurrences" on public.ppm_occurrences for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.current_user_is_active());
create policy "Write ppm_occurrences" on public.ppm_occurrences for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility())
  with check (organization_id = public.current_user_organization_id() and public.can_manage_facility());

create policy "Read work_order_tasks" on public.work_order_tasks for select to authenticated
  using (public.can_read_work_order(work_order_id));
create policy "Write work_order_tasks" on public.work_order_tasks for all to authenticated
  using (organization_id = public.current_user_organization_id() and public.current_user_is_active()
    and (public.can_manage_facility() or (public.is_technician() and exists (
         select 1 from public.work_orders w where w.id = work_order_id and w.assigned_to = auth.uid()))))
  with check (organization_id = public.current_user_organization_id() and public.current_user_is_active()
    and (public.can_manage_facility() or (public.is_technician() and exists (
         select 1 from public.work_orders w where w.id = work_order_id and w.assigned_to = auth.uid()))));

create policy "Read ppm_activity" on public.ppm_activity for select to authenticated
  using (organization_id = public.current_user_organization_id() and public.can_manage_facility());
