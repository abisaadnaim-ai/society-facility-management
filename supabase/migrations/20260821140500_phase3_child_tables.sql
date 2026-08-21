-- Attachments, activity log, and comments for FM Requests and Work Orders.
-- Child rows cascade-delete with their parent. RLS added in a later migration.

create table public.fm_request_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  request_id uuid not null references public.fm_requests(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  attachment_type text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index fm_request_attachments_request_id_idx on public.fm_request_attachments (request_id);
create index fm_request_attachments_org_idx on public.fm_request_attachments (organization_id);
alter table public.fm_request_attachments enable row level security;

create table public.fm_request_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  request_id uuid not null references public.fm_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index fm_request_activity_request_id_idx on public.fm_request_activity (request_id, created_at desc);
create index fm_request_activity_org_idx on public.fm_request_activity (organization_id);
alter table public.fm_request_activity enable row level security;

create table public.fm_request_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  request_id uuid not null references public.fm_requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.fm_request_comments.is_internal is 'true = FM-only, never visible to the requester (enforced by RLS). false = requester-visible.';
create index fm_request_comments_request_id_idx on public.fm_request_comments (request_id, created_at);
create index fm_request_comments_org_idx on public.fm_request_comments (organization_id);
create trigger set_fm_request_comments_updated_at before update on public.fm_request_comments for each row execute function public.set_updated_at();
alter table public.fm_request_comments enable row level security;

create table public.work_order_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  attachment_type text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
comment on column public.work_order_attachments.attachment_type is 'Free-form label such as General, Before, After, Completion. Not constrained, to allow future values.';
create index work_order_attachments_wo_id_idx on public.work_order_attachments (work_order_id);
create index work_order_attachments_org_idx on public.work_order_attachments (organization_id);
alter table public.work_order_attachments enable row level security;

create table public.work_order_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index work_order_activity_wo_id_idx on public.work_order_activity (work_order_id, created_at desc);
create index work_order_activity_org_idx on public.work_order_activity (organization_id);
alter table public.work_order_activity enable row level security;

create table public.work_order_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.work_order_comments.is_internal is 'true = FM/technician operational discussion, never shown to requesters.';
create index work_order_comments_wo_id_idx on public.work_order_comments (work_order_id, created_at);
create index work_order_comments_org_idx on public.work_order_comments (organization_id);
create trigger set_work_order_comments_updated_at before update on public.work_order_comments for each row execute function public.set_updated_at();
alter table public.work_order_comments enable row level security;
