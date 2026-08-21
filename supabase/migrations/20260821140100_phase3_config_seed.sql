-- Seed Phase 3 configuration for the Society organization. No enums; all records.

-- FM categories (18)
insert into public.fm_categories (organization_id, name, code, sort_order)
select o.id, v.name, v.code, v.sort_order
from public.organizations o cross join (values
  ('Electrical','electrical',1),('Plumbing','plumbing',2),('HVAC','hvac',3),
  ('Civil','civil',4),('Carpentry','carpentry',5),('Gym Equipment','gym_equipment',6),
  ('Pool','pool',7),('Sauna / Steam','sauna_steam',8),('Access Control','access_control',9),
  ('Fire & Life Safety','fire_life_safety',10),('Cleaning','cleaning',11),('Pest Control','pest_control',12),
  ('Furniture','furniture',13),('Lighting','lighting',14),('General Maintenance','general_maintenance',15),
  ('Indoor Ski','indoor_ski',16),('IT / Low Current','it_low_current',17),('Other','other',18)
) as v(name, code, sort_order) where o.code = 'SOCIETY';

-- FM priorities (4)
insert into public.fm_priorities (organization_id, name, code, description, sort_order)
select o.id, v.name, v.code, v.description, v.sort_order
from public.organizations o cross join (values
  ('Critical','critical','Safety risk, serious operational disruption, facility shutdown, or significant member/staff impact.',1),
  ('High','high','Major operational issue requiring prompt action.',2),
  ('Medium','medium','Normal operational issue with moderate impact.',3),
  ('Low','low','Minor, cosmetic, or non-urgent issue.',4)
) as v(name, code, description, sort_order) where o.code = 'SOCIETY';

-- FM request statuses (6)
insert into public.fm_request_statuses (organization_id, name, code, sort_order)
select o.id, v.name, v.code, v.sort_order
from public.organizations o cross join (values
  ('New','new',1),('Under Review','under_review',2),('Work Order Created','work_order_created',3),
  ('Closed','closed',4),('Rejected','rejected',5),('Cancelled','cancelled',6)
) as v(name, code, sort_order) where o.code = 'SOCIETY';

-- Work order statuses (12)
insert into public.work_order_statuses (organization_id, name, code, sort_order)
select o.id, v.name, v.code, v.sort_order
from public.organizations o cross join (values
  ('New','new',1),('Assigned','assigned',2),('In Progress','in_progress',3),('On Hold','on_hold',4),
  ('Waiting for Parts','waiting_parts',5),('Waiting for Vendor','waiting_vendor',6),
  ('Waiting for Procurement','waiting_procurement',7),('Waiting for Approval','waiting_approval',8),
  ('Completed','completed',9),('Verified','verified',10),('Closed','closed',11),('Cancelled','cancelled',12)
) as v(name, code, sort_order) where o.code = 'SOCIETY';
