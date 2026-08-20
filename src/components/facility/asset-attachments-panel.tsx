"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AssetAttachmentWithUploader } from "@/lib/types/facility";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatFileSize, formatDateTime } from "@/lib/format";
import {
  recordAttachment,
  getAttachmentDownloadUrl,
  deleteAttachment,
} from "@/lib/actions/attachments";

const MAX_BYTES = 20 * 1024 * 1024;

export function AssetAttachmentsPanel({
  assetId,
  organizationId,
  attachments,
  canManage,
}: {
  assetId: string;
  organizationId: string;
  attachments: AssetAttachmentWithUploader[];
  canManage: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AssetAttachmentWithUploader | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      // Path convention enforced by Storage RLS: {org_id}/assets/{asset_id}/{unique-filename}
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${organizationId}/assets/${assetId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("asset-attachments")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        setError(uploadError.message.includes("row-level security")
          ? "You don't have permission to upload here."
          : "Upload failed. Please try again.");
        setUploading(false);
        return;
      }

      const res = await recordAttachment({
        asset_id: assetId,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
        attachment_type: null,
      });

      if (!res.ok) {
        // Roll back the orphaned storage object if the metadata insert failed.
        await supabase.storage.from("asset-attachments").remove([path]);
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

  async function handleDownload(att: AssetAttachmentWithUploader) {
    setDownloadingId(att.id);
    const res = await getAttachmentDownloadUrl(att.file_path);
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
    const res = await deleteAttachment({
      id: toDelete.id,
      asset_id: assetId,
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
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelected}
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <Button onClick={() => fileInputRef.current?.click()} isLoading={uploading} size="sm">
            Upload file
          </Button>
          <span className="ml-2 text-xs text-slate-400">Max 20 MB · images, PDF, Office, text</span>
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
          description={canManage ? "Upload manuals, photos, or documents for this asset." : "No files have been attached yet."}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{att.file_name}</p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(att.file_size)} · {formatDateTime(att.created_at)}
                  {att.uploader?.full_name ? ` · ${att.uploader.full_name}` : ""}
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
