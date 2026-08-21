"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { personName } from "@/components/facility/status-badges";
import type { PersonRef } from "@/lib/types/fm";

type CommentItem = {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author: PersonRef;
};

export function CommentThread({
  comments,
  canPostPublic,
  canPostInternal,
  onSubmit,
}: {
  comments: CommentItem[];
  canPostPublic: boolean;
  canPostInternal: boolean;
  onSubmit: (body: string, isInternal: boolean) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canPost = canPostPublic || canPostInternal;

  function submit() {
    if (!body.trim()) return;
    setError(null);
    const isInternal = canPostInternal ? internal : false;
    startTransition(async () => {
      const res = await onSubmit(body.trim(), isInternal);
      if (!res.ok) setError(res.error ?? "Couldn't post comment.");
      else {
        setBody("");
        setInternal(false);
      }
    });
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="text-sm text-slate-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={[
                "rounded-lg border px-3 py-2",
                c.is_internal ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{personName(c.author)}</span>
                {c.is_internal && <Badge variant="warning">Internal</Badge>}
                <span className="text-xs text-slate-400">{formatDateTime(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <div className="mt-4">
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={internal ? "Internal note (not visible to the requester)..." : "Add a comment..."}
          />
          {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
          <div className="mt-2 flex items-center justify-between">
            {canPostInternal ? (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Internal only
              </label>
            ) : (
              <span className="text-xs text-slate-400">Visible to the facility team</span>
            )}
            <Button size="sm" onClick={submit} isLoading={pending} disabled={!body.trim()}>
              Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
