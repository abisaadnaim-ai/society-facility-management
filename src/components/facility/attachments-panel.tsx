"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatFileSize, formatDateTime } from "@/lib/format";
import { personName } from "@/components/facility/status-badges";
import type { PersonRef } from "@/lib/types/fm";
import {
  recordFmRequestAttachment,
  deleteFmRequestAttachment,
  getFmRequestAttachmentUrl,
  recordWorkOrderAttachment,
  deleteWorkOrderAttachment,
  getWorkOrderAttachmentUrl,
} from "@/lib/actions/fm-attachments";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
const WO_TYPES = ["General", "Before", "After", "Completion"];

type AttachmentRow = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  attachment_type: string | null;
  created_at: string;
  uploader: PersonRef;
};

export function AttachmentsPanel({
  kind,
  parentId,
  organizationId,
  attachments,
  canManage,
}: {
  kind: "fm" | "wo";
  parentId: string;
  organizationId: string;
  attachments: AttachmentRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("General");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AttachmentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const bucket = kind === "fm" ? "fm-request-attachments" : "work-order-attachments";

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("File is too large. Maximum size is 20 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${organizationId}/${parentId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        setError(
          uploadError.message.includes("row-level security")
            ? "You don't have permission to upload here."
            : "Upload failed. Please try again."
        );
        setUploading(false);
        return;
      }

      const meta = {
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
        attachment_type: kind === "wo" ? type : null,
      };
      const res =
        kind === "fm"
          ? await recordFmRequestAttachment({ request_id: parentId, ...meta })
          : await recordWorkOrderAttachment({ work_order_id: parentId, ...meta });

      if (!res.ok) {
        await supabase.storage.from(bucket).remove([path]);
        setError(res.error);
      } else {
        router.refresh();
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(att: AttachmentRow) {
    setDownloadingId(att.id);
    const res =
      kind === "fm"
        ? await getFmRequestAttachmentUrl(att.file_path)
        : await getWorkOrderAttachmentUrl(att.file_path);
    setDownloadingId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const res =
      kind === "fm"
        ? await deleteFmRequestAttachment({
            id: toDelete.id,
            request_id: parentId,
            file_path: toDelete.file_path,
            file_name: toDelete.file_name,
          })
        : await deleteWorkOrderAttachment({
            id: toDelete.id,
            work_order_id: parentId,
            file_path: toDelete.file_path,
            file_name: toDelete.file_name,
          });
    setDeleting(false);
    setToDelete(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelected}
            accept={ACCEPT}
          />
          {kind === "wo" && (
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-36">
              {WO_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
          <Button onClick={() => fileInputRef.current?.click()} isLoading={uploading} size="sm">
            Upload file
          </Button>
          <span className="text-xs text-slate-400">Max 20 MB - images, PDF, Office, text</span>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <EmptyState
          title="No attachments"
          description={canManage ? "Upload photos or documents as evidence." : "No files have been attached yet."}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{att.file_name}</p>
                  {att.attachment_type && att.attachment_type !== "General" && (
                    <Badge variant="info">{att.attachment_type}</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {formatFileSize(att.file_size)} - {formatDateTime(att.created_at)}
                  {att.uploader ? ` - ${personName(att.uploader)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  isLoading={downloadingId === att.id}
                  onClick={() => handleDownload(att)}
                >
                  Download
                </Button>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => setToDelete(att)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete attachment?"
        description={toDelete ? `"${toDelete.file_name}" will be permanently removed.` : ""}
        confirmLabel="Delete"
        destructive
        isLoading={deleting}
      />
    </div>
  );
}
