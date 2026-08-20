-- 5 protected Society locations
insert into public.locations (organization_id, name, code, location_type, is_active, is_protected, sort_order)
select o.id, v.name, v.code, v.location_type, true, true, v.sort_order
from public.organizations o cross join (values
  ('01 Indoor Ski','01','Leisure',1),
  ('03 Mall - UFC Gym','03','Gym',2),
  ('04 Mall - UFC Gym','04','Gym',3),
  ('Centro Mall','CENTRO','Mixed',4),
  ('Teebah Gardens','TEEBAH','Mixed',5)
) as v(name, code, location_type, sort_order) where o.code = 'SOCIETY';

-- 6 asset statuses
insert into public.asset_statuses (organization_id, name, code, sort_order)
select o.id, v.name, v.code, v.sort_order
from public.organizations o cross join (values
  ('Operational','operational',1),
  ('Under Maintenance','under_maintenance',2),
  ('Out of Service','out_of_service',3),
  ('Awaiting Parts','awaiting_parts',4),
  ('Awaiting Vendor','awaiting_vendor',5),
  ('Decommissioned','decommissioned',6)
) as v(name, code, sort_order) where o.code = 'SOCIETY';

-- 17 asset categories
insert into public.asset_categories (organization_id, name, code, sort_order)
select o.id, v.name, v.code, v.sort_order
from public.organizations o cross join (values
  ('Electrical','electrical',1),('Plumbing','plumbing',2),('HVAC','hvac',3),
  ('Civil','civil',4),('Carpentry','carpentry',5),('Gym Equipment','gym_equipment',6),
  ('Pool Equipment','pool_equipment',7),('Sauna / Steam','sauna_steam',8),
  ('Access Control','access_control',9),('Fire & Life Safety','fire_life_safety',10),
  ('Cleaning Equipment','cleaning_equipment',11),('Furniture','furniture',12),
  ('Lighting','lighting',13),('General Equipment','general_equipment',14),
  ('Indoor Ski Equipment','indoor_ski_equipment',15),('IT / Low Current','it_low_current',16),
  ('Other','other',17)
) as v(name, code, sort_order) where o.code = 'SOCIETY';
