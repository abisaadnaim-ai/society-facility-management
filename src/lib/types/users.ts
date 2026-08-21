import type { RoleCode } from "@/lib/types/auth";

/** A row in the User Management table (from admin_list_users). */
export type AdminUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  role_id: string | null;
  role_code: RoleCode | null;
  role_name: string | null;
  primary_location_id: string | null;
  location_name: string | null;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

/** A single user's detail (from admin_get_user), with activity counts. */
export type AdminUserDetail = AdminUserRow & {
  fm_requests_submitted: number;
  work_orders_assigned: number;
};

export type RoleOption = { id: string; code: RoleCode; name: string };
export type LocationOption = { id: string; name: string };
