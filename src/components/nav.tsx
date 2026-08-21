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
 * NAV-AUTH-VISIBLE-2026-08-21: signed-in state is now visually distinct.
 * Signed-out: prominent blue "Sign in" pill (always visible, mobile + desktop).
 * Signed-in: colored initial avatar → click opens popover with email + Sign out.
 * Previous LogIn/LogOut icon pair was hidden on mobile and looked identical.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Target, LogOut, LogIn, Shield, Send, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

interface NavProps {
  /** Legacy arg kept for backward compat with `(app)/layout.tsx`. Unused. */
  previewTier?: "free" | "pro" | "elite" | null;
}

// Deterministic colour per user — hash email/id into one of six ring colours
// so the avatar circle isn't the same neutral grey for everyone.
const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-300 ring-blue-500/40",
  "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
  "bg-amber-500/20 text-amber-300 ring-amber-500/40",
  "bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/40",
  "bg-cyan-500/20 text-cyan-300 ring-cyan-500/40",
  "bg-rose-500/20 text-rose-300 ring-rose-500/40",
];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function avatarInitial(displayName: string | null | undefined, email: string | null | undefined): string {
  const source = (displayName || email || "?").trim();
  return source.charAt(0).toUpperCase() || "?";
}

export function Nav({ previewTier: _ = null }: NavProps) {
  void _;
  const pathname = usePathname();
  const { user, profile, loading, isAnonymous, signOut } = useAuth();
  const isSuperadmin = profile?.is_superadmin === true;
  // Only treat as truly signed-in when they have a real identity — anonymous
  // sessions (auto-created for favorites/tracker) shouldn't hide the Sign-in
  // button, that's the whole conversion hook.
  const isRealUser = !!user && !isAnonymous;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const linkClass = (href: string) =>
    cn(
      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
      isActive(href)
        ? "bg-white/[0.08] text-neutral-100"
        : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100",
    );

  const displayName = profile?.display_name ?? (user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? null;
  const email = profile?.email ?? user?.email ?? null;
  const avatarSeed = email ?? user?.id ?? "?";

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
          {!loading && (
            isRealUser ? (
              <div ref={menuRef} className="relative ml-1">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  title={email ?? displayName ?? "Signed in"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full ring-1 transition-transform hover:scale-105 focus:outline-none focus:ring-2",
                    avatarColor(avatarSeed),
                  )}
                >
                  <span className="text-xs font-semibold">{avatarInitial(displayName, email)}</span>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-xl"
                  >
                    <div className="border-b border-white/[0.06] px-3 py-2.5">
                      <p className="text-[11px] text-neutral-500">Signed in as</p>
                      <p className="truncate text-sm font-medium text-neutral-100" title={email ?? undefined}>
                        {displayName || email || "Account"}
                      </p>
                      {displayName && email && (
                        <p className="truncate text-[11px] text-neutral-500" title={email}>{email}</p>
                      )}
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-white/[0.05] hover:text-neutral-100"
                    >
                      <UserIcon className="h-3.5 w-3.5" />
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 border-t border-white/[0.06] px-3 py-2 text-left text-xs text-neutral-300 hover:bg-white/[0.05] hover:text-neutral-100"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-1 flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/25 hover:text-blue-200 sm:text-sm"
                title="Sign in"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign in</span>
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
