import { Badge } from "@/components/ui/badge";
import { type StockStatus, type MovementType, STOCK_STATUS_LABEL, MOVEMENT_TYPE_LABEL } from "@/lib/types/inventory";

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const variant = status === "in_stock" ? "success" : status === "low_stock" ? "warning" : "danger";
  return <Badge variant={variant}>{STOCK_STATUS_LABEL[status]}</Badge>;
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const increases: MovementType[] = ["opening_balance", "stock_in", "return", "adjustment_increase", "transfer_in"];
  const variant = type === "issue" || type === "adjustment_decrease" || type === "transfer_out"
    ? "danger"
    : increases.includes(type)
      ? "info"
      : "neutral";
  return <Badge variant={variant}>{MOVEMENT_TYPE_LABEL[type]}</Badge>;
}
