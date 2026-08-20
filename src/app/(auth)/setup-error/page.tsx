import { SignOutLink } from "@/components/auth/sign-out-link";

export default function SetupErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Account setup incomplete</h1>
        <p className="mt-2 text-sm text-slate-500">
          We couldn&apos;t find a profile for your account. This usually means account setup
          didn&apos;t finish correctly. Contact your organization&apos;s administrator for help.
        </p>
        <SignOutLink className="mt-6" />
      </div>
    </div>
  );
}
