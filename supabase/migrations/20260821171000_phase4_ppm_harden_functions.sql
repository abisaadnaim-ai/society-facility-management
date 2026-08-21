-- ============================================================================
-- PHASE 4: hardening -- pin search_path + revoke RPC on trigger-only functions
-- (Clears advisor lints 0011 + 0028 for Phase 4 objects.)
-- ============================================================================
create or replace function public.set_work_order_source()
returns trigger language plpgsql set search_path = public as $$
begin
  new.source := case when new.ppm_plan_id is not null then 'ppm'
                     when new.fm_request_id is not null then 'fm_request' else 'direct' end;
  return new;
end; $$;

create or replace function public.assign_ppm_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ppm_number is null or new.ppm_number = '' then
    new.ppm_number := 'PPM-' || lpad(nextval('public.ppm_number_seq')::text, 6, '0');
  end if;
  return new;
end; $$;

-- (ppm_compute_next_due already recreated with search_path in the engine migration.)

revoke execute on function public.set_work_order_source() from public, anon, authenticated;
revoke execute on function public.assign_ppm_number() from public, anon, authenticated;
revoke execute on function public.ppm_after_plan_insert() from public, anon, authenticated;
revoke execute on function public.sync_ppm_on_wo_close() from public, anon, authenticated;
revoke execute on function public.enforce_wo_task_completion() from public, anon, authenticated;
