"use client";

/**
 * Unified public nav used by:
 *   - /                        (landing — renders this directly)
 *   - /picks                   (live picks page — renders this directly)
 *   - /performance, /admin, …  (via `(app)/layout.tsx`)
 *
 * Before 2026-06-24 these three surfaces had THREE different nav blocks
 * (inline JSX on / and /picks, the legacy <Nav> on the (app) layout) and
 * the items shifted as you moved between pages — confusing UX.
 *
 * One component now. Items shown:
 *   ODDSINTEL                Live Picks · Track Record · API · Telegram · [Login / Logout]
 *   (logo links to /)        (current page is highlighted; superadmin sees Admin)
 *
 * Auth-aware via useAuth(); shows Login link if signed out, Logout button
 * if signed in. Admin link appears only when profile.is_superadmin = true.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Target, LogOut, LogIn, Shield, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

interface NavProps {
  /** Legacy arg kept for backward compat with `(app)/layout.tsx`. Unused. */
  previewTier?: "free" | "pro" | "elite" | null;
}

export function Nav({ previewTier: _ = null }: NavProps) {
  void _;
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();
  const isSuperadmin = profile?.is_superadmin === true;

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const linkClass = (href: string) =>
    cn(
      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
      isActive(href)
        ? "bg-white/[0.08] text-neutral-100"
        : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100",
    );

  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-3 sm:px-4">
        <Link
          href="/"
          className="font-mono text-sm font-bold tracking-tight text-neutral-100"
        >
          ODDSINTEL
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/picks" className={linkClass("/picks")}>
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Live Picks</span>
            <span className="sm:hidden">Picks</span>
          </Link>
          <Link href="/performance" className={linkClass("/performance")}>
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Track Record</span>
            <span className="sm:hidden">Stats</span>
          </Link>
          {isSuperadmin && (
            <Link href="/admin/bots" className={linkClass("/admin")}>
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link
            href="https://t.me/oddsintelpicks"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 sm:text-sm"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Telegram</span>
          </Link>
          {!loading &&
            (user ? (
              <button
                onClick={() => signOut()}
                className="hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100 transition-colors sm:text-sm"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                href="/login"
                className="hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100 transition-colors sm:text-sm"
                title="Sign in"
              >
                <LogIn className="h-3.5 w-3.5" />
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
