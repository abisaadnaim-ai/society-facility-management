create or replace function public.enforce_asset_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare loc_org uuid; area_org uuid; area_loc uuid; cat_org uuid; status_org uuid;
begin
  select organization_id into loc_org from public.locations where id = new.location_id;
  select organization_id, location_id into area_org, area_loc from public.areas where id = new.area_id;
  select organization_id into cat_org from public.asset_categories where id = new.category_id;
  select organization_id into status_org from public.asset_statuses where id = new.status_id;
  if area_loc is distinct from new.location_id then
    raise exception 'Selected area does not belong to the selected location.' using errcode = '23514';
  end if;
  if new.organization_id is distinct from loc_org
     or new.organization_id is distinct from area_org
     or new.organization_id is distinct from cat_org
     or new.organization_id is distinct from status_org then
    raise exception 'Asset location, area, category, and status must all belong to the asset''s organization.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger enforce_asset_integrity before insert or update on public.assets for each row execute function public.enforce_asset_integrity();
revoke execute on function public.enforce_asset_integrity() from public, anon, authenticated;
