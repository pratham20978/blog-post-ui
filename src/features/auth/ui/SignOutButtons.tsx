"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/ui/Button";

/**
 * Sign out here, or everywhere.
 *
 * The two are genuinely different: `all_devices` revokes every refresh-token
 * family for the account, which is the control someone reaches for after
 * losing a laptop. Offering only one would hide that.
 */
export function SignOutButtons() {
  const { signOut, isPending } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<"one" | "all" | null>(null);

  async function run(scope: "one" | "all") {
    setBusy(scope);
    try {
      await signOut({ allDevices: scope === "all" });
      router.push("/blogs");
      // The server components above still hold the signed-in render.
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const disabled = isPending || busy !== null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button variant="secondary" disabled={disabled} onClick={() => void run("one")}>
        {busy === "one" ? "Signing out…" : "Sign out"}
      </Button>

      <Button variant="ghost" disabled={disabled} onClick={() => void run("all")}>
        {busy === "all" ? "Signing out…" : "Sign out on all devices"}
      </Button>
    </div>
  );
}
