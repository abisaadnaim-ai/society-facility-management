"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AssetWithRelations,
  AssetActivityWithActor,
  AssetAttachmentWithUploader,
} from "@/lib/types/facility";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AssetAttachmentsPanel } from "@/components/facility/asset-attachments-panel";
import { formatDate, formatDateTime, statusVariant } from "@/lib/format";
import { setAssetActive } from "@/lib/actions/assets";

type Tab = "details" | "attachments" | "activity" | "maintenance" | "work_orders" | "ppm";

const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "attachments", label: "Attachments" },
  { id: "activity", label: "Activity" },
  { id: "maintenance", label: "Maintenance History" },
  { id: "work_orders", label: "Work Orders" },
  { id: "ppm", label: "PPM" },
];

export function AssetDetailView({
  asset,
  activity,
  attachments,
  canManage,
  organizationId,
}: {
  asset: AssetWithRelations;
  activity: AssetActivityWithActor[];
  attachments: AssetAttachmentWithUploader[];
  canManage: boolean;
  organizationId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("details");
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    const res = await setAssetActive(asset.id, !asset.is_active);
    setBusy(false);
    setConfirmRetire(false);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/assets" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to Asset Register
        </Link>
      </div>

      <PageHeader
        title={asset.name}
        description={asset.asset_code ? `Code: ${asset.asset_code}` : undefined}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Link href={`/assets/${asset.id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
              <Button
                variant={asset.is_active ? "ghost" : "primary"}
                onClick={() => (asset.is_active ? setConfirmRetire(true) : toggleActive())}
                isLoading={busy}
              >
                {asset.is_active ? "Retire" : "Reactivate"}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(asset.status?.code)}>{asset.status?.name ?? "—"}</Badge>
        {!asset.is_active && <Badge variant="neutral">Inactive</Badge>}
        <span className="text-sm text-slate-500">
          {asset.location?.name ?? "—"} · {asset.area?.name ?? "—"} · {asset.category?.name ?? "—"}
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-5 border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "details" && <DetailsTab asset={asset} />}

      {tab === "attachments" && (
        <AssetAttachmentsPanel
          assetId={asset.id}
          organizationId={organizationId}
          attachments={attachments}
          canManage={canManage}
        />
      )}

      {tab === "activity" && <ActivityTab activity={activity} />}

      {tab === "maintenance" && (
        <EmptyState
          title="No maintenance history is available yet"
          description="Completed maintenance for this asset will appear here in a future phase."
        />
      )}
      {tab === "work_orders" && (
        <EmptyState
          title="No work orders yet"
          description="Work orders raised against this asset will appear here in a future phase."
        />
      )}
      {tab === "ppm" && (
        <EmptyState
          title="No preventive maintenance scheduled"
          description="PPM schedules for this asset will appear here in a future phase."
        />
      )}

      <ConfirmDialog
        open={confirmRetire}
        onClose={() => setConfirmRetire(false)}
        onConfirm={toggleActive}
        title="Retire this asset?"
        description="It will be hidden from the active register but its history is preserved. You can reactivate it later."
        confirmLabel="Retire asset"
        isLoading={busy}
      />
    </div>
  );
}

function DetailsTab({ asset }: { asset: AssetWithRelations }) {
  const rows: { label: string; value: string }[] = [
    { label: "Manufacturer", value: asset.manufacturer || "—" },
    { label: "Model", value: asset.model || "—" },
    { label: "Serial number", value: asset.serial_number || "—" },
    { label: "Supplier", value: asset.supplier_name || "—" },
    { label: "Purchase date", value: formatDate(asset.purchase_date) },
    { label: "Installation date", value: formatDate(asset.installation_date) },
    { label: "Warranty expiry", value: formatDate(asset.warranty_expiry) },
    {
      label: "Expected life",
      value: asset.expected_life_years != null ? `${asset.expected_life_years} years` : "—",
    },
    { label: "Created", value: formatDateTime(asset.created_at) },
    { label: "Last updated", value: formatDateTime(asset.updated_at) },
  ];

  return (
    <div className="flex flex-col gap-5">
      {asset.description && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Description</h2>
          <p className="text-sm text-slate-600">{asset.description}</p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Specifications</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 border-b border-slate-50 pb-2">
              <dt className="text-sm text-slate-500">{r.label}</dt>
              <dd className="text-right text-sm font-medium text-slate-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {asset.notes && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{asset.notes}</p>
        </section>
      )}
    </div>
  );
}

function ActivityTab({ activity }: { activity: AssetActivityWithActor[] }) {
  if (activity.length === 0) {
    return (
      <EmptyState
        title="No activity recorded"
        description="Changes to this asset — status updates, moves, edits — will be logged here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <ul className="divide-y divide-slate-100">
        {activity.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{humanizeAction(a.action)}</p>
              <p className="text-xs text-slate-500">
                {a.actor?.full_name || a.actor?.email || "System"}
              </p>
            </div>
            <span className="whitespace-nowrap text-xs text-slate-400">
              {formatDateTime(a.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function humanizeAction(action: string): string {
  switch (action) {
    case "created":
      return "Asset created";
    case "updated":
      return "Details updated";
    case "status_changed":
      return "Status changed";
    case "moved":
      return "Location or area changed";
    case "deactivated":
      return "Asset retired";
    case "reactivated":
      return "Asset reactivated";
    case "attachment_added":
      return "Attachment added";
    case "attachment_removed":
      return "Attachment removed";
    default:
      return action.replace(/_/g, " ");
  }
}
