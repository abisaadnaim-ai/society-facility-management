import type { RoleCode, SessionProfile } from "@/lib/types/auth";

/**
 * Client-side role/permission helpers. These exist for UI convenience only
 * (e.g. hiding a nav item) and must NEVER be treated as the actual security
 * boundary -- that lives in Postgres RLS policies and the SECURITY DEFINER
 * helper functions (current_user_role_code, is_super_admin, etc). A user
 * could disable JavaScript or call the API directly and bypass anything
 * checked only here.
 */

export function hasRole(
  profile: SessionProfile | null,
  ...codes: RoleCode[]
): boolean {
  if (!profile?.role) return false;
  return codes.includes(profile.role.code as RoleCode);
}

export function isSuperAdmin(profile: SessionProfile | null): boolean {
  return hasRole(profile, "super_admin");
}

export function displayRoleName(profile: SessionProfile | null): string {
  return profile?.role?.name ?? "No role assigned";
}

export function displayOrganizationName(profile: SessionProfile | null): string {
  return profile?.organization?.name ?? "No organization";
}

/**
 * Facility-level permission helpers, mirroring the SQL predicates of the same
 * name. UI convenience ONLY -- the real enforcement is in RLS. These decide
 * whether to render create/edit controls; a user who bypasses them still hits
 * a row-level-security denial on the server.
 */
export function canManageFacility(profile: SessionProfile | null): boolean {
  return hasRole(profile, "super_admin", "facility_manager");
}

export function canManageConfiguration(profile: SessionProfile | null): boolean {
  return hasRole(profile, "super_admin");
}

export function isReadOnlyUser(profile: SessionProfile | null): boolean {
  return !canManageFacility(profile);
}
