-- Server-callable audit logger for assets (asset_activity has no client INSERT policy).
create or replace function public.log_asset_activity(
  p_asset_id uuid, p_action text, p_field_name text default null,
  p_old_value text default null, p_new_value text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare caller_org uuid; asset_org uuid; new_id uuid;
begin
  caller_org := public.current_user_organization_id();
  select organization_id into asset_org from public.assets where id = p_asset_id;
  if asset_org is null then
    raise exception 'Asset % not found.', p_asset_id using errcode = '23503';
  end if;
  if caller_org is distinct from asset_org then
    raise exception 'Cannot log activity for an asset outside your organization.' using errcode = '42501';
  end if;
  insert into public.asset_activity (organization_id, asset_id, actor_id, action, field_name, old_value, new_value)
  values (asset_org, p_asset_id, auth.uid(), p_action, p_field_name, p_old_value, p_new_value)
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.log_asset_activity(uuid, text, text, text, text) from public, anon;
grant execute on function public.log_asset_activity(uuid, text, text, text, text) to authenticated;

-- Protect core Society locations from deletion / unauthorized rename.
create or replace function public.guard_protected_locations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.is_protected then
      raise exception 'Core Society locations cannot be deleted. Deactivate them instead.' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.is_protected and (new.name is distinct from old.name) and not public.is_super_admin() then
    raise exception 'Only a Super Admin may rename a core Society location.' using errcode = '42501';
  end if;
  if old.is_protected and not new.is_protected and not public.is_super_admin() then
    raise exception 'Only a Super Admin may change the protected flag on a location.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_protected_locations before update or delete on public.locations for each row execute function public.guard_protected_locations();
revoke execute on function public.guard_protected_locations() from public, anon, authenticated;
