"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  updateUser,
  resetUserPassword,
  changeUserEmail,
  type UpdateUserInput,
} from "@/lib/actions/admin-users";
import type { AdminUserDetail, RoleOption, LocationOption } from "@/lib/types/users";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function UserDetailView({
  user,
  roles,
  locations,
  isSelf,
}: {
  user: AdminUserDetail;
  roles: RoleOption[];
  locations: LocationOption[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [jobTitle, setJobTitle] = useState(user.job_title ?? "");
  const [roleId, setRoleId] = useState(user.role_id ?? "");
  const [locationId, setLocationId] = useState(user.primary_location_id ?? "");

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function currentInput(overrides?: Partial<UpdateUserInput>): UpdateUserInput {
    return {
      user_id: user.id,
      full_name: fullName,
      phone: phone.trim() || null,
      job_title: jobTitle.trim() || null,
      role_id: roleId,
      primary_location_id: locationId || null,
      is_active: user.is_active,
      ...overrides,
    };
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        after?.();
        router.refresh();
      }
    });
  }

  function saveEdits() {
    if (!fullName.trim()) return setError("Full name cannot be empty.");
    if (!roleId) return setError("A role is required.");
    run(() => updateUser(currentInput()), () => setNotice("Changes saved."));
  }

  function toggleActive(next: boolean) {
    run(() => updateUser(currentInput({ is_active: next })), () =>
      setNotice(next ? "User activated." : "User deactivated.")
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/settings/users" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back to Users
        </Link>
      </div>

      <PageHeader
        title={user.full_name ?? user.email ?? "User"}
        description={user.email ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user.is_active ? (
              <Button size="sm" variant="ghost" onClick={() => setDeactivateOpen(true)} disabled={pending}>
                Deactivate
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => toggleActive(true)} isLoading={pending}>
                Activate
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(async () => {
                const res = await resetUserPassword(user.id);
                if (res.ok) setTempPassword(res.data.tempPassword);
                return res;
              })}
              isLoading={pending}
            >
              Reset password
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge variant={user.is_active ? "success" : "neutral"}>{user.is_active ? "Active" : "Inactive"}</Badge>
        <Badge variant="info">{user.role_name ?? "No role"}</Badge>
        {isSelf && <span className="text-xs text-slate-400">This is your own account.</span>}
      </div>

      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      {tempPassword && (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">New temporary password (shown once)</p>
          <p className="mt-1 select-all font-mono text-lg text-slate-900">{tempPassword}</p>
          <button className="mt-2 text-xs text-slate-500 underline" onClick={() => setTempPassword(null)}>Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Job Title</label>
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                  <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Primary Location</label>
                  <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                    <option value="">No primary location</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveEdits} isLoading={pending}>Save changes</Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Email</h2>
              <Button size="sm" variant="outline" onClick={() => { setNewEmail(user.email ?? ""); setEmailOpen(true); }}>
                Change email
              </Button>
            </div>
            <p className="text-sm text-slate-600">{user.email ?? "-"}</p>
            <p className="mt-1 text-xs text-slate-400">
              Changing the email updates the sign-in identity and keeps the login and profile in sync.
            </p>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Account</h2>
            <dl>
              <Row label="Status" value={user.is_active ? "Active" : "Inactive"} />
              <Row label="Role" value={user.role_name ?? "-"} />
              <Row label="Primary Location" value={user.location_name ?? "-"} />
              <Row label="Created" value={formatDate(user.created_at)} />
              <Row label="Last Sign In" value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Never"} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Activity</h2>
            <dl>
              <Row label="FM Requests submitted" value={user.fm_requests_submitted} />
              <Row label="Work Orders assigned" value={user.work_orders_assigned} />
            </dl>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={() => { setDeactivateOpen(false); toggleActive(false); }}
        title="Deactivate this user?"
        description="They will no longer be able to sign in or use the app. Their history is preserved and you can reactivate them later."
        confirmLabel="Deactivate"
        isLoading={pending}
      />

      <Dialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        title="Change email"
        description="This updates the sign-in email and the profile together."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEmailOpen(false)} disabled={pending}>Cancel</Button>
            <Button
              size="sm"
              isLoading={pending}
              disabled={!newEmail.trim()}
              onClick={() => run(() => changeUserEmail(user.id, newEmail), () => { setEmailOpen(false); setNotice("Email updated."); })}
            >
              Save email
            </Button>
          </>
        }
      >
        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@company.com" />
      </Dialog>
    </div>
  );
}
