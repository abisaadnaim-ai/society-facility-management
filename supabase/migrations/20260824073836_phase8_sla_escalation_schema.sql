-- =====================================================================
-- PHASE 8 (1/6): SLA, Escalation & Notifications — schema
-- New tables + SLA columns on fm_requests/work_orders + indexes + sample SLA seed
-- Preserves all prior phases. UTC storage; display tz handled in app (Asia/Qatar).
-- =====================================================================

-- ---------------------------------------------------------------
-- SLA RULES (configurable; keyed off FM priorities) — §4
-- ---------------------------------------------------------------
create table public.fm_sla_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  priority_id uuid not null references public.fm_priorities(id),
  response_minutes integer not null check (response_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0),
  applies_to_request boolean not null default true,
  applies_to_work_order boolean not null default true,
  is_active boolean not null default true,
  effective_from timestamptz,
  effective_to timestamptz,
  is_sample_default boolean not null default false, -- labels seeded prototype values
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fm_sla_rules enable row level security;
-- one active rule per (org, priority)
create unique index fm_sla_rules_active_priority_uidx
  on public.fm_sla_rules (organization_id, priority_id) where is_active;
create index fm_sla_rules_org_idx on public.fm_sla_rules (organization_id);
create trigger trg_fm_sla_rules_updated before update on public.fm_sla_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- ESCALATION RULES (configurable) — §15
-- ---------------------------------------------------------------
create table public.fm_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  applies_to text not null check (applies_to in ('fm_request','work_order')),
  priority_id uuid references public.fm_priorities(id),
  trigger_type text not null check (trigger_type in (
    'response_due_soon','response_breached',
    'resolution_due_soon','resolution_breached',
    'critical_request_created','critical_work_order_open',
    'work_order_unassigned','completed_awaiting_verification')),
  trigger_minutes integer,
  escalation_level integer not null default 1 check (escalation_level between 1 and 3),
  target_role_id uuid references public.roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fm_escalation_rules enable row level security;
create index fm_escalation_rules_org_idx on public.fm_escalation_rules (organization_id);
create index fm_escalation_rules_active_idx
  on public.fm_escalation_rules (organization_id, applies_to, trigger_type) where is_active;
create trigger trg_fm_escalation_rules_updated before update on public.fm_escalation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- ESCALATIONS (auditable history) — §32
-- ---------------------------------------------------------------
create table public.fm_escalations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('fm_request','work_order')),
  entity_id uuid not null,
  rule_id uuid references public.fm_escalation_rules(id) on delete set null,
  escalation_level integer not null default 1 check (escalation_level between 1 and 3),
  reason text not null,
  dedup_key text not null,            -- prevents duplicate open escalations (§23)
  triggered_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.fm_escalations enable row level security;
-- one OPEN escalation per condition
create unique index fm_escalations_open_dedup_uidx
  on public.fm_escalations (organization_id, dedup_key) where resolved_at is null;
create index fm_escalations_entity_idx on public.fm_escalations (organization_id, entity_type, entity_id);
create index fm_escalations_unresolved_idx
  on public.fm_escalations (organization_id, resolved_at) where resolved_at is null;

-- ---------------------------------------------------------------
-- NOTIFICATIONS (per-user, in-app only) — §19
-- ---------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  link_url text,
  priority text not null default 'normal' check (priority in ('normal','high','critical')),
  dedup_key text,                     -- idempotency (§23)
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
-- idempotency: one notification per (user, dedup_key)
create unique index notifications_user_dedup_uidx
  on public.notifications (user_id, dedup_key) where dedup_key is not null;
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null and dismissed_at is null;
create index notifications_user_recent_idx on public.notifications (user_id, created_at desc);
create index notifications_entity_idx on public.notifications (organization_id, entity_type, entity_id);

-- ---------------------------------------------------------------
-- NOTIFICATION PREFERENCES (minimal) — §44
-- Critical/SLA/system alerts always remain enabled regardless of prefs.
-- ---------------------------------------------------------------
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,             -- e.g. 'ppm','inspection','vendor','inventory','work_order','fm_request'
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);
alter table public.notification_preferences enable row level security;
create trigger trg_notification_prefs_updated before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- SLA COLUMNS on fm_requests (response) — §7, §50
-- ---------------------------------------------------------------
alter table public.fm_requests
  add column response_due_at timestamptz,
  add column first_responded_at timestamptz,
  add column response_sla_status text not null default 'pending'
    check (response_sla_status in ('pending','met','breached','not_applicable')),
  add column sla_response_target_minutes integer;   -- snapshot of target used (§50)

create index fm_requests_response_due_idx
  on public.fm_requests (response_due_at)
  where first_responded_at is null and response_sla_status = 'pending';

-- ---------------------------------------------------------------
-- SLA COLUMNS on work_orders (resolution) — §8, §50
-- manual due_date is preserved and kept separate (§13, §51)
-- ---------------------------------------------------------------
alter table public.work_orders
  add column resolution_due_at timestamptz,
  add column resolution_sla_status text not null default 'pending'
    check (resolution_sla_status in ('pending','met','breached','not_applicable')),
  add column breached_at timestamptz,
  add column escalation_level integer,
  add column sla_resolution_target_minutes integer;  -- snapshot of target used (§50)

create index work_orders_resolution_due_idx
  on public.work_orders (resolution_due_at)
  where closed_at is null and resolution_sla_status = 'pending';
create index work_orders_escalation_idx
  on public.work_orders (organization_id, escalation_level) where escalation_level is not null;

-- ---------------------------------------------------------------
-- SEED: sample default SLA rules (clearly labeled; NOT approved Society policy) — §5, §55
-- One active rule per priority; easy to change in Settings → SLA Rules.
-- ---------------------------------------------------------------
insert into public.fm_sla_rules
  (organization_id, name, priority_id, response_minutes, resolution_minutes,
   applies_to_request, applies_to_work_order, is_active, is_sample_default)
select o.id,
       'Sample Default - ' || p.name || ' (configure in Settings)',
       p.id,
       v.response_minutes, v.resolution_minutes,
       true, true, true, true
from public.organizations o
cross join (values
  ('critical', 30,   240),
  ('high',     120,  480),
  ('medium',   480,  2880),
  ('low',      1440, 10080)
) as v(code, response_minutes, resolution_minutes)
join public.fm_priorities p on p.code = v.code
on conflict do nothing;
