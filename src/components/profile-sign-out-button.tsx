"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export function ProfileSignOutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
