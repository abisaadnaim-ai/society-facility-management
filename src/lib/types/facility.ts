import type { Tables } from "@/lib/types/database";

export type Location = Tables<"locations">;
export type Area = Tables<"areas">;
export type AssetCategory = Tables<"asset_categories">;
export type AssetStatus = Tables<"asset_statuses">;
export type Asset = Tables<"assets">;
export type AssetAttachment = Tables<"asset_attachments">;
export type AssetActivity = Tables<"asset_activity">;

/** A location with a computed count of its active areas. */
export type LocationWithAreaCount = Location & {
  active_area_count: number;
};

/** An area joined with its parent location's name. */
export type AreaWithLocation = Area & {
  location: Pick<Location, "id" | "name"> | null;
};

/** An asset row joined with the display names of its related entities. */
export type AssetWithRelations = Asset & {
  location: Pick<Location, "id" | "name"> | null;
  area: Pick<Area, "id" | "name"> | null;
  category: Pick<AssetCategory, "id" | "name"> | null;
  status: Pick<AssetStatus, "id" | "name" | "code"> | null;
};

/** An asset activity row joined with the actor's display name. */
export type AssetActivityWithActor = AssetActivity & {
  actor: { full_name: string | null; email: string | null } | null;
};

/** An attachment joined with the uploader's display name. */
export type AssetAttachmentWithUploader = AssetAttachment & {
  uploader: { full_name: string | null; email: string | null } | null;
};

/** Filter state for the Asset Register. Empty string means "no filter". */
export type AssetFilters = {
  search: string;
  locationId: string;
  areaId: string;
  categoryId: string;
  statusId: string;
  includeInactive: boolean;
};
