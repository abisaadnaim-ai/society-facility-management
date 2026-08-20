import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          Society Facility Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your account.</p>

        {error === "network" && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            We couldn&apos;t verify your session due to a connection issue. Please sign in
            again.
          </p>
        )}
        {error === "invalid-reset-link" && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            That reset link is invalid or has expired. Request a new one from the
            &quot;Forgot password&quot; link below.
          </p>
        )}

        <LoginForm />
      </div>
    </div>
  );
}
