-- FM Requests: an issue someone reports for FM to review. Location is required;
-- Area and Asset are optional (an issue may relate to a whole facility or to
-- something not yet registered as an asset). RLS policies are added in a later
-- migration once Work Orders exist (they reference each other).
create table public.fm_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  request_number text not null,
  location_id uuid not null references public.locations(id) on delete restrict,
  area_id uuid references public.areas(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  category_id uuid not null references public.fm_categories(id) on delete restrict,
  priority_id uuid references public.fm_priorities(id) on delete restrict,
  status_id uuid not null references public.fm_request_statuses(id) on delete restrict,
  title text not null,
  description text,
  exact_location_notes text,
  requested_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  cancellation_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fm_requests is 'Reported facility issues awaiting FM review. Location required; area/asset optional. request_number (FM-000001) is human-facing; id (uuid) is the real PK.';
create unique index fm_requests_org_number_key on public.fm_requests (organization_id, request_number);
create index fm_requests_organization_id_idx on public.fm_requests (organization_id);
create index fm_requests_location_id_idx on public.fm_requests (location_id);
create index fm_requests_status_id_idx on public.fm_requests (status_id);
create index fm_requests_requested_by_idx on public.fm_requests (requested_by);
create index fm_requests_created_at_idx on public.fm_requests (created_at desc);

-- Assign FM-000001 style number atomically. Client never supplies it.
create or replace function public.assign_fm_request_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.request_number is null or new.request_number = '' then
    new.request_number := 'FM-' || lpad(nextval('public.fm_request_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger assign_fm_request_number before insert on public.fm_requests for each row execute function public.assign_fm_request_number();

-- Hierarchy integrity: any area/asset provided must line up with the location and org.
create or replace function public.enforce_fm_request_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare loc_org uuid; area_org uuid; area_loc uuid; asset_org uuid; asset_loc uuid; asset_area uuid;
        cat_org uuid; prio_org uuid; status_org uuid;
begin
  select organization_id into loc_org from public.locations where id = new.location_id;
  if loc_org is distinct from new.organization_id then
    raise exception 'Location must belong to the request''s organization.' using errcode = '23514';
  end if;
  if new.area_id is not null then
    select organization_id, location_id into area_org, area_loc from public.areas where id = new.area_id;
    if area_loc is distinct from new.location_id then
      raise exception 'Selected area does not belong to the selected location.' using errcode = '23514';
    end if;
    if area_org is distinct from new.organization_id then
      raise exception 'Area must belong to the request''s organization.' using errcode = '23514';
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
      raise exception 'Asset must belong to the request''s organization.' using errcode = '23514';
    end if;
  end if;
  select organization_id into cat_org from public.fm_categories where id = new.category_id;
  select organization_id into status_org from public.fm_request_statuses where id = new.status_id;
  if cat_org is distinct from new.organization_id or status_org is distinct from new.organization_id then
    raise exception 'Category and status must belong to the request''s organization.' using errcode = '23514';
  end if;
  if new.priority_id is not null then
    select organization_id into prio_org from public.fm_priorities where id = new.priority_id;
    if prio_org is distinct from new.organization_id then
      raise exception 'Priority must belong to the request''s organization.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger enforce_fm_request_integrity before insert or update on public.fm_requests for each row execute function public.enforce_fm_request_integrity();

create trigger set_fm_requests_updated_at before update on public.fm_requests for each row execute function public.set_updated_at();
alter table public.fm_requests enable row level security;

revoke execute on function public.assign_fm_request_number() from public, anon, authenticated;
revoke execute on function public.enforce_fm_request_integrity() from public, anon, authenticated;
