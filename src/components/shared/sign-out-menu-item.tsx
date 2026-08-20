"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutMenuItem() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenuItem onClick={handleSignOut} danger>
      {isSigningOut ? "Signing out..." : "Log out"}
    </DropdownMenuItem>
  );
}
