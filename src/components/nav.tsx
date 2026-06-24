"use client";

/**
 * Minimal nav for the in-app shell ((app)/layout.tsx).
 *
 * Public surface today is only /performance + /track-record + /admin (gated),
 * so the nav is intentionally tiny. The previous 688-line version with
 * /matches /value-bets /live /world-cup /pricing tabs is gone — those pages
 * were deleted in the 2026-06-24 product collapse.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LogOut, LogIn, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

interface NavProps {
  previewTier?: "free" | "pro" | "elite" | null;
}

// `previewTier` arg kept for backward compat with the layout caller. Not used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Nav({ previewTier: _ = null }: NavProps) {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();
  const isSuperadmin = profile?.is_superadmin === true;

  const linkClass = (href: string) =>
    cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-white/[0.08] text-foreground"
        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
    );

  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4">
        <Link
          href="/"
          className="font-mono text-sm font-bold tracking-tight text-foreground"
        >
          ODDSINTEL
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/performance" className={linkClass("/performance")}>
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Track Record</span>
            <span className="sm:hidden">Stats</span>
          </Link>
          {isSuperadmin && (
            <Link href="/admin" className={linkClass("/admin")}>
              <Shield className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
          {!loading && (
            user ? (
              <button
                onClick={() => signOut()}
                className="ml-1 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-1 flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-foreground hover:bg-white/[0.08] transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Login</span>
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
