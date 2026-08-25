-- Reporting is authenticated-only. Supabase default privileges grant EXECUTE to anon
-- on new functions; revoke it so unauthenticated callers cannot invoke reporting RPCs.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text sig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'report_%'
  loop
    execute format('revoke all on function %s from anon, public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
