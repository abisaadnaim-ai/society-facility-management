-- =====================================================================
-- Phase 7: FM Inventory & Spare Parts — SCHEMA
-- Inventory tracking only. NO procurement (no PR/PO/RFQ/quote/approval).
-- =====================================================================

-- Composite-FK targets on existing tables (id is already unique, so these
-- unique indexes are always satisfiable and safe to add).
create unique index if not exists work_orders_id_org_uidx on public.work_orders (id, organization_id);
create unique index if not exists assets_id_org_uidx on public.assets (id, organization_id);

-- ---------------------------------------------------------------------
-- Configuration: categories
-- ---------------------------------------------------------------------
create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  parent_category_id uuid,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, code),
  foreign key (parent_category_id, organization_id)
    references public.inventory_categories (id, organization_id) on delete set null
);
alter table public.inventory_categories enable row level security;
create index inventory_categories_org_idx on public.inventory_categories (organization_id);

-- ---------------------------------------------------------------------
-- Configuration: units of measure
-- ---------------------------------------------------------------------
create table public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  abbreviation text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, abbreviation)
);
alter table public.units_of_measure enable row level security;
create index units_of_measure_org_idx on public.units_of_measure (organization_id);

-- ---------------------------------------------------------------------
-- Stock locations (physical storage) — NO seed data
-- ---------------------------------------------------------------------
create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  area_id uuid references public.areas(id) on delete set null,
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, code)
);
alter table public.stock_locations enable row level security;
create index stock_locations_org_idx on public.stock_locations (organization_id);
create index stock_locations_location_idx on public.stock_locations (location_id);

-- ---------------------------------------------------------------------
-- Inventory items (spare parts / consumables)
-- ---------------------------------------------------------------------
create sequence if not exists public.inventory_item_seq;
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_code text not null,
  name text not null,
  description text,
  category_id uuid not null,
  unit_of_measure_id uuid not null,
  manufacturer text,
  part_number text,
  barcode text,
  preferred_vendor_id uuid,
  minimum_stock_level numeric(14,3),
  reorder_reference_level numeric(14,3),
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, item_code),
  foreign key (category_id, organization_id)
    references public.inventory_categories (id, organization_id) on delete restrict,
  foreign key (unit_of_measure_id, organization_id)
    references public.units_of_measure (id, organization_id) on delete restrict,
  foreign key (preferred_vendor_id, organization_id)
    references public.vendors (id, organization_id) on delete set null,
  check (minimum_stock_level is null or minimum_stock_level >= 0),
  check (reorder_reference_level is null or reorder_reference_level >= 0)
);
alter table public.inventory_items enable row level security;
create index inventory_items_org_idx on public.inventory_items (organization_id);
create index inventory_items_category_idx on public.inventory_items (category_id);
create index inventory_items_active_idx on public.inventory_items (organization_id, is_active);

-- ---------------------------------------------------------------------
-- Inventory balances (derived from movements; never edited directly)
-- ---------------------------------------------------------------------
create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null,
  stock_location_id uuid not null,
  quantity_on_hand numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (inventory_item_id, stock_location_id),
  foreign key (inventory_item_id, organization_id)
    references public.inventory_items (id, organization_id) on delete cascade,
  foreign key (stock_location_id, organization_id)
    references public.stock_locations (id, organization_id) on delete restrict,
  check (quantity_on_hand >= 0)
);
alter table public.inventory_balances enable row level security;
create index inventory_balances_item_idx on public.inventory_balances (inventory_item_id);
create index inventory_balances_location_idx on public.inventory_balances (stock_location_id);

-- ---------------------------------------------------------------------
-- Inventory movements (source of truth for stock)
-- ---------------------------------------------------------------------
create sequence if not exists public.inventory_movement_seq;
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  movement_number text not null,
  inventory_item_id uuid not null,
  stock_location_id uuid not null,
  movement_type text not null check (movement_type in (
    'opening_balance','stock_in','issue','return',
    'adjustment_increase','adjustment_decrease','transfer_out','transfer_in')),
  quantity numeric(14,3) not null check (quantity > 0),
  work_order_id uuid,
  technician_id uuid references public.profiles(id) on delete set null,
  transfer_group_id uuid,
  reference text,
  reason text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, movement_number),
  foreign key (inventory_item_id, organization_id)
    references public.inventory_items (id, organization_id) on delete restrict,
  foreign key (stock_location_id, organization_id)
    references public.stock_locations (id, organization_id) on delete restrict,
  foreign key (work_order_id, organization_id)
    references public.work_orders (id, organization_id) on delete set null
);
alter table public.inventory_movements enable row level security;
create index inventory_movements_org_idx on public.inventory_movements (organization_id);
create index inventory_movements_item_idx on public.inventory_movements (inventory_item_id);
create index inventory_movements_location_idx on public.inventory_movements (stock_location_id);
create index inventory_movements_wo_idx on public.inventory_movements (work_order_id);
create index inventory_movements_created_idx on public.inventory_movements (created_at desc);

-- ---------------------------------------------------------------------
-- Asset <-> spare part compatibility (optional links)
-- ---------------------------------------------------------------------
create table public.asset_spare_parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null,
  inventory_item_id uuid not null,
  notes text,
  is_preferred boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (asset_id, inventory_item_id),
  foreign key (asset_id, organization_id)
    references public.assets (id, organization_id) on delete cascade,
  foreign key (inventory_item_id, organization_id)
    references public.inventory_items (id, organization_id) on delete cascade
);
alter table public.asset_spare_parts enable row level security;
create index asset_spare_parts_asset_idx on public.asset_spare_parts (asset_id);
create index asset_spare_parts_item_idx on public.asset_spare_parts (inventory_item_id);

-- ---------------------------------------------------------------------
-- Immutable audit trail
-- ---------------------------------------------------------------------
create table public.inventory_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid,
  stock_location_id uuid,
  movement_id uuid,
  action text not null,
  detail text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
alter table public.inventory_activity enable row level security;
create index inventory_activity_org_idx on public.inventory_activity (organization_id);
create index inventory_activity_item_idx on public.inventory_activity (inventory_item_id);

-- ---------------------------------------------------------------------
-- updated_at triggers (reuse existing set_updated_at())
-- ---------------------------------------------------------------------
create trigger trg_inventory_categories_updated before update on public.inventory_categories for each row execute function public.set_updated_at();
create trigger trg_units_of_measure_updated before update on public.units_of_measure for each row execute function public.set_updated_at();
create trigger trg_stock_locations_updated before update on public.stock_locations for each row execute function public.set_updated_at();
create trigger trg_inventory_items_updated before update on public.inventory_items for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Numbering (concurrency-safe via sequences)
-- ---------------------------------------------------------------------
create or replace function public.set_inventory_item_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.item_code is null or new.item_code = '' then
    new.item_code := 'ITEM-' || lpad(nextval('public.inventory_item_seq')::text, 6, '0');
  end if;
  return new;
end $$;
create trigger trg_set_inventory_item_number before insert on public.inventory_items
  for each row execute function public.set_inventory_item_number();

create or replace function public.set_inventory_movement_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.movement_number is null or new.movement_number = '' then
    new.movement_number := 'MOV-' || lpad(nextval('public.inventory_movement_seq')::text, 6, '0');
  end if;
  return new;
end $$;
create trigger trg_set_inventory_movement_number before insert on public.inventory_movements
  for each row execute function public.set_inventory_movement_number();

-- ---------------------------------------------------------------------
-- Integrity: stock location must reference same-org location/area
-- ---------------------------------------------------------------------
create or replace function public.phase7_assert_stock_location_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.locations where id = new.location_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'Stock location must reference a location in the same organization';
  end if;
  if new.area_id is not null then
    select organization_id into v_org from public.areas where id = new.area_id;
    if v_org is null or v_org <> new.organization_id then
      raise exception 'Area must belong to the same organization';
    end if;
  end if;
  return new;
end $$;
create trigger trg_phase7_stock_location_org before insert or update on public.stock_locations
  for each row execute function public.phase7_assert_stock_location_org();

-- ---------------------------------------------------------------------
-- Seed configuration (categories + units) for every organization.
-- No fake items / stock / stock-locations.
-- ---------------------------------------------------------------------
insert into public.inventory_categories (organization_id, name, code, sort_order)
select o.id, c.name, c.code, c.sort_order
from public.organizations o
cross join (values
  ('Electrical','ELE',1),('Plumbing','PLM',2),('HVAC','HVAC',3),('Gym Equipment','GYM',4),
  ('Pool Equipment','POOL',5),('Sauna / Steam','SAUNA',6),('Fire & Life Safety','FLS',7),
  ('Access Control','ACS',8),('IT / Low Current','ITLC',9),('Cleaning','CLN',10),
  ('Hardware','HW',11),('Tools','TOOL',12),('Consumables','CONS',13),
  ('General Maintenance','GEN',14),('Indoor Ski','SKI',15),('Other','OTH',16)
) as c(name,code,sort_order)
on conflict (organization_id, code) do nothing;

insert into public.units_of_measure (organization_id, name, abbreviation, sort_order)
select o.id, u.name, u.abbreviation, u.sort_order
from public.organizations o
cross join (values
  ('Piece','PC',1),('Box','BOX',2),('Pack','PACK',3),('Meter','M',4),('Liter','L',5),
  ('Kilogram','KG',6),('Set','SET',7),('Roll','ROLL',8),('Bottle','BTL',9),
  ('Can','CAN',10),('Pair','PR',11)
) as u(name,abbreviation,sort_order)
on conflict (organization_id, abbreviation) do nothing;
