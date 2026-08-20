import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>

        <ResetPasswordForm />
      </div>
    </div>
  );
}
