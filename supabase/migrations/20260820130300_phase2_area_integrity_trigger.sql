create or replace function public.enforce_area_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare loc_org_id uuid;
begin
  select organization_id into loc_org_id from public.locations where id = new.location_id;
  if loc_org_id is null then
    raise exception 'Location % does not exist.', new.location_id using errcode = '23503';
  end if;
  if new.organization_id is distinct from loc_org_id then
    raise exception 'Area organization must match its location''s organization.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger enforce_area_integrity before insert or update on public.areas for each row execute function public.enforce_area_integrity();
revoke execute on function public.enforce_area_integrity() from public, anon, authenticated;
