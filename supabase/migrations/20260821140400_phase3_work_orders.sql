-- Work Orders: the maintenance job FM manages. May originate from an FM Request
-- or be created directly. Location/category/priority required; area/asset optional.
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  work_order_number text not null,
  fm_request_id uuid references public.fm_requests(id) on delete set null,
  location_id uuid not null references public.locations(id) on delete restrict,
  area_id uuid references public.areas(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  category_id uuid not null references public.fm_categories(id) on delete restrict,
  priority_id uuid not null references public.fm_priorities(id) on delete restrict,
  status_id uuid not null references public.work_order_statuses(id) on delete restrict,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  verification_notes text,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.work_orders is 'Maintenance jobs. Optionally linked 1:1 to an originating FM Request. work_order_number (WO-000001) is human-facing; id (uuid) is the real PK.';
-- One primary Work Order per FM Request (Phase 3 rule).
create unique index work_orders_fm_request_unique on public.work_orders (fm_request_id) where fm_request_id is not null;
create unique index work_orders_org_number_key on public.work_orders (organization_id, work_order_number);
create index work_orders_organization_id_idx on public.work_orders (organization_id);
create index work_orders_location_id_idx on public.work_orders (location_id);
create index work_orders_asset_id_idx on public.work_orders (asset_id);
create index work_orders_status_id_idx on public.work_orders (status_id);
create index work_orders_assigned_to_idx on public.work_orders (assigned_to);
create index work_orders_created_at_idx on public.work_orders (created_at desc);

create or replace function public.assign_work_order_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.work_order_number is null or new.work_order_number = '' then
    new.work_order_number := 'WO-' || lpad(nextval('public.work_order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger assign_work_order_number before insert on public.work_orders for each row execute function public.assign_work_order_number();

create or replace function public.enforce_work_order_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare loc_org uuid; area_org uuid; area_loc uuid; asset_org uuid; asset_loc uuid; asset_area uuid;
        cat_org uuid; prio_org uuid; status_org uuid; req_org uuid;
begin
  select organization_id into loc_org from public.locations where id = new.location_id;
  if loc_org is distinct from new.organization_id then
    raise exception 'Location must belong to the work order''s organization.' using errcode = '23514';
  end if;
  if new.area_id is not null then
    select organization_id, location_id into area_org, area_loc from public.areas where id = new.area_id;
    if area_loc is distinct from new.location_id then
      raise exception 'Selected area does not belong to the selected location.' using errcode = '23514';
    end if;
    if area_org is distinct from new.organization_id then
      raise exception 'Area must belong to the work order''s organization.' using errcode = '23514';
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
      raise exception 'Asset must belong to the work order''s organization.' using errcode = '23514';
    end if;
  end if;
  select organization_id into cat_org from public.fm_categories where id = new.category_id;
  select organization_id into prio_org from public.fm_priorities where id = new.priority_id;
  select organization_id into status_org from public.work_order_statuses where id = new.status_id;
  if cat_org is distinct from new.organization_id or prio_org is distinct from new.organization_id
     or status_org is distinct from new.organization_id then
    raise exception 'Category, priority, and status must belong to the work order''s organization.' using errcode = '23514';
  end if;
  if new.fm_request_id is not null then
    select organization_id into req_org from public.fm_requests where id = new.fm_request_id;
    if req_org is distinct from new.organization_id then
      raise exception 'Linked FM request must belong to the work order''s organization.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger enforce_work_order_integrity before insert or update on public.work_orders for each row execute function public.enforce_work_order_integrity();

create trigger set_work_orders_updated_at before update on public.work_orders for each row execute function public.set_updated_at();
alter table public.work_orders enable row level security;

revoke execute on function public.assign_work_order_number() from public, anon, authenticated;
revoke execute on function public.enforce_work_order_integrity() from public, anon, authenticated;
