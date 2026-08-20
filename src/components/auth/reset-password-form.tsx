"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";

type SessionState = "checking" | "valid" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // The /auth/confirm route handler already exchanged the recovery link's
    // token for a session server-side (cookie-based). We just need to confirm
    // a session actually exists before letting the user set a new password --
    // if they land here directly without a valid/unexpired link, there won't be one.
    supabase.auth.getUser().then(({ data }) => {
      setSessionState(data.user ? "valid" : "invalid");
    });

    // Also listen for the PASSWORD_RECOVERY event, which fires if the browser
    // client itself detects recovery tokens in the URL (covers older/alternate
    // email template formats that don't go through /auth/confirm).
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionState("valid");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setIsLoading(false);
    }
  }

  if (sessionState === "checking") {
    return <LoadingState label="Verifying your reset link..." />;
  }

  if (sessionState === "invalid") {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          This reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password">
          <Button className="w-full">Request a new link</Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <p className="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Password updated. Redirecting you in...
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          New password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        Update password
      </Button>
    </form>
  );
}
