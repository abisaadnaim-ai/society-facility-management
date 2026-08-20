-- Shared trigger function to keep updated_at current on any table that uses it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Sets updated_at = now() on row update. Attach as a BEFORE UPDATE trigger.';

-- Trigger functions are only ever invoked in trigger context and should never be
-- callable directly via the PostgREST RPC surface.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
