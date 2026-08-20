"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });

      // Always show the same success message regardless of whether the email
      // exists, so this form can't be used to enumerate registered accounts.
      if (resetError) {
        console.error("resetPasswordForEmail failed:", resetError.message);
      }
      setSubmitted(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        If an account exists for that email, a password reset link is on its way. Check
        your inbox (and spam folder).
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        Send reset link
      </Button>

      <Link href="/login" className="text-center text-sm font-medium text-slate-500 hover:text-slate-900">
        Back to sign in
      </Link>
    </form>
  );
}
