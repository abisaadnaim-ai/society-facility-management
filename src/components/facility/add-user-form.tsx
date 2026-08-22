"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createUserWithPassword } from "@/lib/actions/admin-users";
import type { RoleOption, LocationOption } from "@/lib/types/users";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function AddUserForm({
  roles,
  locations,
}: {
  roles: RoleOption[];
  locations: LocationOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; userId: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [roleId, setRoleId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function resetForm() {
    setFullName(""); setEmail(""); setPhone(""); setJobTitle("");
    setRoleId(""); setLocationId(""); setIsActive(true);
    setPassword(""); setConfirmPassword("");
  }

  function submit() {
    setError(null);
    if (!fullName.trim()) return setError("Please enter a full name.");
    if (!email.trim()) return setError("Please enter an email address.");
    if (!roleId) return setError("Please choose a role.");
    if (password.length < 8) return setError("Temporary password must be at least 8 characters.");
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return setError("Temporary password must include at least one letter and one number.");
    }
    if (password !== confirmPassword) return setError("The temporary passwords do not match.");
    startTransition(async () => {
      const res = await createUserWithPassword({
        full_name: fullName,
        email,
        password,
        confirm_password: confirmPassword,
        role_id: roleId,
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
        primary_location_id: locationId || null,
        is_active: isActive,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // The temporary password is never shown again; drop it from memory now.
      setPassword("");
      setConfirmPassword("");
      setCreated({ email: res.data.email, userId: res.data.userId });
    });
  }

  if (created) {
    return (
      <div className="max-w-2xl space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            User created successfully. Share the temporary login credentials securely with the user.
          </p>
        </div>
        <p className="text-sm text-slate-600">
          The account for <span className="font-medium">{created.email}</span> is active and can sign
          in immediately. For security, the temporary password is not shown again — if it&apos;s lost,
          use <span className="font-medium">Reset password</span> on the user&apos;s profile to issue a new one.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/settings/users/${created.userId}`}>
            <Button size="sm">View user</Button>
          </Link>
          <Link href="/settings/users">
            <Button size="sm" variant="outline">Back to Users</Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCreated(null);
              resetForm();
            }}
          >
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href="/settings/users" className="text-sm text-slate-500 hover:text-slate-900">
          &larr; Back to Users
        </Link>
      </div>

      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Basic Information</h2>
          <Field label="Full Name" required>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Sara Al-Thani" />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+974 ..." />
            </Field>
            <Field label="Job Title">
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Maintenance Lead" />
            </Field>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-semibold text-slate-900">Access</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role" required>
              <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Select a role...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Primary Location">
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">No primary location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Active (can sign in and use the app)
          </label>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Temporary Password</h2>
            <p className="mt-1 text-xs text-slate-500">
              Set a temporary password so the user can sign in immediately (no confirmation email is
              sent). Share it securely; ask the user to change it after their first sign-in.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Temporary Password" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Confirm Temporary Password" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </Field>
          </div>
          <p className="text-xs text-slate-500">Use at least 8 characters, including a letter and a number.</p>
        </section>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Link href="/settings/users">
            <Button variant="outline" disabled={pending}>Cancel</Button>
          </Link>
          <Button onClick={submit} isLoading={pending}>Create user</Button>
        </div>
      </div>
    </div>
  );
}
