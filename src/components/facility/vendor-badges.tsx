import { Badge } from "@/components/ui/badge";
import {
  type VendorStatus,
  type ExpiryState,
  type DocValidity,
  VENDOR_STATUS_LABEL,
  EXPIRY_LABEL,
} from "@/lib/types/vendors";

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  const variant = status === "active" ? "success" : status === "suspended" ? "danger" : "neutral";
  return <Badge variant={variant}>{VENDOR_STATUS_LABEL[status]}</Badge>;
}

export function ContractStateBadge({ state }: { state: ExpiryState }) {
  const variant =
    state === "active"
      ? "success"
      : state === "expired" || state === "terminated"
      ? "danger"
      : state === "expiring_30"
      ? "warning"
      : state === "expiring_60" || state === "expiring_90"
      ? "info"
      : "neutral";
  return <Badge variant={variant}>{EXPIRY_LABEL[state]}</Badge>;
}

export function DocValidityBadge({ validity }: { validity: DocValidity }) {
  if (validity === "none") return null;
  const variant = validity === "valid" ? "success" : validity === "expiring" ? "warning" : "danger";
  const label = validity === "valid" ? "Valid" : validity === "expiring" ? "Expiring Soon" : "Expired";
  return <Badge variant={variant}>{label}</Badge>;
}
