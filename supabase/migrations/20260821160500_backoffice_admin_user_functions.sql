-- Admin user-management operations as SECURITY DEFINER functions. They run as
-- the database owner, so they can create the auth login and set the profile
-- WITHOUT any service-role key, Edge Function, or extra environment secret.
-- Every function first verifies the caller is an active Super Admin and only
-- operates within the caller's organization. Callable from a normal server
-- action via supabase.rpc() with the caller's JWT.

create or replace function public.admin_invite_user(
  p_full_name text,
  p_email text,
  p_role_id uuid,
  p_phone text default null,
  p_job_title text default null,
  p_primary_location_id uuid default null,
  p_is_active boolean default true
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_email text := lower(btrim(p_email));
  v_id uuid := gen_random_uuid();
  v_pw text;
  r_code text;
begin
  if public.current_user_role_code() is distinct from 'super_admin' or not public.current_user_is_active() then
    raise exception 'Only an active Super Admin can manage users.' using errcode = '42501';
  end if;
  v_org := public.current_user_organization_id();

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Full name is required.' using errcode = '22000';
  end if;
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Please enter a valid email address.' using errcode = '22000';
  end if;
  select code into r_code from public.roles where id = p_role_id;
  if r_code is null then raise exception 'The selected role is invalid.' using errcode = '22000'; end if;
  if p_primary_location_id is not null and not exists (
      select 1 from public.locations where id = p_primary_location_id and organization_id = v_org) then
    raise exception 'The selected location is invalid.' using errcode = '22000';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'A user with that email already exists.' using errcode = '23505';
  end if;

  v_pw := 'Sf9-' || replace(replace(encode(extensions.gen_random_bytes(12), 'base64'), '/', '_'), '+', '-');

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pw, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', btrim(p_full_name))
  );

  insert into auth.identities (provider, provider_id, user_id, identity_data, created_at, updated_at, last_sign_in_at)
  values ('email', v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    now(), now(), now());

  update public.profiles set
    organization_id = v_org,
    full_name = btrim(p_full_name),
    email = v_email,
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    job_title = nullif(btrim(coalesce(p_job_title, '')), ''),
    role_id = p_role_id,
    primary_location_id = p_primary_location_id,
    is_active = coalesce(p_is_active, true)
  where id = v_id;

  insert into public.user_activity (organization_id, target_user_id, actor_id, action, metadata)
  values (v_org, v_id, auth.uid(), 'user_created',
          jsonb_build_object('role', r_code, 'is_active', coalesce(p_is_active, true)));

  return jsonb_build_object('user_id', v_id, 'email', v_email, 'temp_password', v_pw);
end;
$$;

create or replace function public.admin_update_user(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_job_title text,
  p_role_id uuid,
  p_primary_location_id uuid,
  p_is_active boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; cur public.profiles%rowtype; new_code text; old_code text;
begin
  if public.current_user_role_code() is distinct from 'super_admin' or not public.current_user_is_active() then
    raise exception 'Only an active Super Admin can manage users.' using errcode = '42501';
  end if;
  v_org := public.current_user_organization_id();
  select * into cur from public.profiles where id = p_user_id;
  if cur.id is null or cur.organization_id <> v_org then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Full name cannot be empty.' using errcode = '22000';
  end if;
  select code into new_code from public.roles where id = p_role_id;
  if new_code is null then raise exception 'The selected role is invalid.' using errcode = '22000'; end if;
  if p_primary_location_id is not null and not exists (
      select 1 from public.locations where id = p_primary_location_id and organization_id = v_org) then
    raise exception 'The selected location is invalid.' using errcode = '22000';
  end if;
  select code into old_code from public.roles where id = cur.role_id;

  update public.profiles set
    full_name = btrim(p_full_name),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    job_title = nullif(btrim(coalesce(p_job_title, '')), ''),
    role_id = p_role_id,
    primary_location_id = p_primary_location_id,
    is_active = coalesce(p_is_active, cur.is_active)
  where id = p_user_id;

  if p_role_id is distinct from cur.role_id then
    insert into public.user_activity (organization_id, target_user_id, actor_id, action, field_name, old_value, new_value)
    values (v_org, p_user_id, auth.uid(), 'role_changed', 'role_id', old_code, new_code);
  end if;
  if p_primary_location_id is distinct from cur.primary_location_id then
    insert into public.user_activity (organization_id, target_user_id, actor_id, action, field_name, old_value, new_value)
    values (v_org, p_user_id, auth.uid(), 'location_changed', 'primary_location_id', cur.primary_location_id::text, p_primary_location_id::text);
  end if;
  if coalesce(p_is_active, cur.is_active) is distinct from cur.is_active then
    insert into public.user_activity (organization_id, target_user_id, actor_id, action, field_name, old_value, new_value)
    values (v_org, p_user_id, auth.uid(), case when p_is_active then 'user_activated' else 'user_deactivated' end, 'is_active', cur.is_active::text, p_is_active::text);
  end if;
  if btrim(p_full_name) is distinct from cur.full_name
     or nullif(btrim(coalesce(p_phone,'')),'') is distinct from cur.phone
     or nullif(btrim(coalesce(p_job_title,'')),'') is distinct from cur.job_title then
    insert into public.user_activity (organization_id, target_user_id, actor_id, action)
    values (v_org, p_user_id, auth.uid(), 'profile_updated');
  end if;

  return jsonb_build_object('user_id', p_user_id);
end;
$$;

create or replace function public.admin_reset_password(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_pw text;
begin
  if public.current_user_role_code() is distinct from 'super_admin' or not public.current_user_is_active() then
    raise exception 'Only an active Super Admin can manage users.' using errcode = '42501';
  end if;
  v_org := public.current_user_organization_id();
  if not exists (select 1 from public.profiles where id = p_user_id and organization_id = v_org) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  v_pw := 'Sf9-' || replace(replace(encode(extensions.gen_random_bytes(12), 'base64'), '/', '_'), '+', '-');
  update auth.users set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')), updated_at = now()
   where id = p_user_id;
  insert into public.user_activity (organization_id, target_user_id, actor_id, action)
  values (v_org, p_user_id, auth.uid(), 'password_reset');
  return jsonb_build_object('temp_password', v_pw);
end;
$$;

create or replace function public.admin_change_email(p_user_id uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_email text := lower(btrim(p_email));
begin
  if public.current_user_role_code() is distinct from 'super_admin' or not public.current_user_is_active() then
    raise exception 'Only an active Super Admin can manage users.' using errcode = '42501';
  end if;
  v_org := public.current_user_organization_id();
  if not exists (select 1 from public.profiles where id = p_user_id and organization_id = v_org) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Please enter a valid email address.' using errcode = '22000';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user_id) then
    raise exception 'A user with that email already exists.' using errcode = '23505';
  end if;
  update auth.users set email = v_email, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
   where id = p_user_id;
  update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email)), updated_at = now()
   where user_id = p_user_id and provider = 'email';
  update public.profiles set email = v_email where id = p_user_id;
  insert into public.user_activity (organization_id, target_user_id, actor_id, action, field_name, new_value)
  values (v_org, p_user_id, auth.uid(), 'email_changed', 'email', v_email);
  return jsonb_build_object('user_id', p_user_id, 'email', v_email);
end;
$$;

revoke execute on function public.admin_invite_user(text, text, uuid, text, text, uuid, boolean) from public, anon;
revoke execute on function public.admin_update_user(uuid, text, text, text, uuid, uuid, boolean) from public, anon;
revoke execute on function public.admin_reset_password(uuid) from public, anon;
revoke execute on function public.admin_change_email(uuid, text) from public, anon;
grant execute on function public.admin_invite_user(text, text, uuid, text, text, uuid, boolean) to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, text, uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_reset_password(uuid) to authenticated;
grant execute on function public.admin_change_email(uuid, text) to authenticated;
