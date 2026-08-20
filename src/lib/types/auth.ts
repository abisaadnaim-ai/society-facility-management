import type { Tables } from "@/lib/types/database";

export type Profile = Tables<"profiles">;
export type Role = Tables<"roles">;
export type Organization = Tables<"organizations">;

/** The authenticated user's profile joined with their role and organization. */
export type SessionProfile = Profile & {
  role: Role | null;
  organization: Organization | null;
};

export type RoleCode =
  | "super_admin"
  | "facility_manager"
  | "technician"
  | "requester"
  | "viewer";
