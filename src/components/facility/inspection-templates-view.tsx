"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { setInspectionTemplateStatus } from "@/lib/actions/inspections";
import type { InspectionTemplateRow } from "@/lib/types/inspections";

export function InspectionTemplatesView({ templates, canManage }: { templates: InspectionTemplateRow[]; canManage: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(id: string, status: "active" | "archived") {
    setBusyId(id);
    await setInspectionTemplateStatus(id, status);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/inspections" className="text-sm text-slate-500 hover:text-slate-900">&larr; Inspections</Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Inspection Templates</h1>
        </div>
        {canManage && <Link href="/inspections/templates/new"><Button>New template</Button></Link>}
      </div>

      {templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Create a checklist template to start scheduling inspections."
          action={canManage ? <Link href="/inspections/templates/new"><Button>New template</Button></Link> : undefined} />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/inspections/templates/${t.id}`} className="font-medium text-slate-900 hover:underline">{t.name}</Link>
                    <Badge variant={t.status === "active" ? "success" : "neutral"}>{t.status === "active" ? "Active" : "Archived"}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.template_number} · {t.section_count} section{t.section_count === 1 ? "" : "s"} · {t.item_count} item{t.item_count === 1 ? "" : "s"} · {t.schedule_count} schedule{t.schedule_count === 1 ? "" : "s"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Link href={`/inspections/templates/${t.id}`}><Button variant="outline" size="sm">Edit</Button></Link>
                    {t.status === "active" ? (
                      <Button variant="ghost" size="sm" isLoading={busyId === t.id} onClick={() => toggle(t.id, "archived")}>Archive</Button>
                    ) : (
                      <Button variant="ghost" size="sm" isLoading={busyId === t.id} onClick={() => toggle(t.id, "active")}>Activate</Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
