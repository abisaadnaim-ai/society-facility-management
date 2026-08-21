-- Phase 3 configuration tables: FM categories, priorities, and the two status
-- lifecycles. All are organization-scoped, configurable records (not enums),
-- readable by any active member and writable only by a Super Admin -- exactly
-- mirroring the Phase 2 asset_categories / asset_statuses pattern.

create table public.fm_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text,
  description text,
  parent_category_id uuid references public.fm_categories(id) on delete restrict,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fm_categories is 'Facility Management issue categories. Separate from asset_categories. Supports future subcategories via parent_category_id.';
create unique index fm_categories_org_name_active_key on public.fm_categories (organization_id, lower(name)) where is_active;
create index fm_categories_organization_id_idx on public.fm_categories (organization_id);
create index fm_categories_parent_id_idx on public.fm_categories (parent_category_id);
create trigger set_fm_categories_updated_at before update on public.fm_categories for each row execute function public.set_updated_at();
alter table public.fm_categories enable row level security;

create table public.fm_priorities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  description text,
  -- SLA columns are provisioned now but NOT used in Phase 3 (no timers/escalation).
  response_target_minutes integer,
  resolution_target_minutes integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fm_priorities is 'FM priority levels. SLA target columns are reserved for a later phase; no SLA logic runs in Phase 3.';
create unique index fm_priorities_org_code_key on public.fm_priorities (organization_id, code);
create index fm_priorities_organization_id_idx on public.fm_priorities (organization_id);
create trigger set_fm_priorities_updated_at before update on public.fm_priorities for each row execute function public.set_updated_at();
alter table public.fm_priorities enable row level security;

create table public.fm_request_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fm_request_statuses is 'Configurable FM Request lifecycle statuses.';
create unique index fm_request_statuses_org_code_key on public.fm_request_statuses (organization_id, code);
create index fm_request_statuses_organization_id_idx on public.fm_request_statuses (organization_id);
create trigger set_fm_request_statuses_updated_at before update on public.fm_request_statuses for each row execute function public.set_updated_at();
alter table public.fm_request_statuses enable row level security;

create table public.work_order_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.work_order_statuses is 'Configurable Work Order lifecycle statuses.';
create unique index work_order_statuses_org_code_key on public.work_order_statuses (organization_id, code);
create index work_order_statuses_organization_id_idx on public.work_order_statuses (organization_id);
create trigger set_work_order_statuses_updated_at before update on public.work_order_statuses for each row execute function public.set_updated_at();
alter table public.work_order_statuses enable row level security;

-- RLS: read = any active member of the org; write = Super Admin only.
do $$
declare t text;
begin
  foreach t in array array['fm_categories','fm_priorities','fm_request_statuses','work_order_statuses'] loop
    execute format($f$
      create policy "Read %1$s in own org" on public.%1$s for select to authenticated
        using (organization_id = public.current_user_organization_id() and public.can_read_facility());
      create policy "Admins insert %1$s in own org" on public.%1$s for insert to authenticated
        with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());
      create policy "Admins update %1$s in own org" on public.%1$s for update to authenticated
        using (organization_id = public.current_user_organization_id() and public.can_manage_configuration())
        with check (organization_id = public.current_user_organization_id() and public.can_manage_configuration());
    $f$, t);
  end loop;
end $$;
