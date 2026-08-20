-- profiles: users may read and update only their own row.
-- No INSERT policy: rows are created exclusively by the handle_new_user trigger (SECURITY DEFINER),
-- so direct client-side inserts are denied by default.
-- No DELETE policy: profile deletion is not supported from the client.
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
