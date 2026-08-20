insert into public.organizations (name, code, is_active)
values ('Society', 'SOCIETY', true);

insert into public.roles (name, code, description, permissions, is_active)
values
  ('Super Admin', 'super_admin', 'Full system access, including user and role management.', '{"all": true}'::jsonb, true),
  ('Facility Manager', 'facility_manager', 'Manages work orders, assets, and day-to-day facility operations.', '{}'::jsonb, true),
  ('Technician', 'technician', 'Executes assigned work orders and updates their status.', '{}'::jsonb, true),
  ('Requester', 'requester', 'Submits maintenance requests and tracks their own work orders.', '{}'::jsonb, true),
  ('Viewer', 'viewer', 'Read-only access. Default role for newly created accounts.', '{}'::jsonb, true);
