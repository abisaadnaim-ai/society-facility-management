"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Supabase returns the same generic message for "no such user" and
        // "wrong password" -- intentionally, to avoid leaking which emails
        // have accounts. We surface it as-is rather than trying to be clever.
        setError(
          signInError.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : signInError.message
        );
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setIsLoading(false);
    }
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

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-slate-500 hover:text-slate-900">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" isLoading={isLoading} className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}
