/**
 * GROWTH-UNIFIED-NAV (2026-06-05) — single nav component for landing /
 * pricing / legal pages.
 *
 * Replaces five duplicated inline `<nav>` blocks (page.tsx, pricing,
 * privacy, changelog, terms). Each of those pages now renders
 * `<MarketingNav />` and that's it — no more drift between the inline
 * implementations.
 *
 * Auth-aware: when a session exists, the right side switches from
 * "Log In / Sign Up Free" to a profile dropdown. This is a thin
 * version of what the in-app `<Nav>` does — marketing pages don't
 * need the full primaryLinks grid or tier-preview controls.
 *
 * Active-link highlighting via usePathname.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MARKETING_LINKS,
  MARKETING_LINKS_MOBILE,
} from "@/lib/nav-links";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

export function MarketingNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const { user, profile, signOut } = useAuth();

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : null;

  return (
    <nav
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/90 backdrop-blur-lg"
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo + Beta tag */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-xl font-black uppercase italic tracking-tight text-white whitespace-nowrap">
            ODDS<span className="text-green-500 ml-[0.15em]">INTEL</span>
          </span>
          <span className="rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 px-1.5 py-0.5 border border-amber-500/30">
            Beta
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Desktop link list — driven by MARKETING_LINKS */}
          {MARKETING_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "hidden text-sm font-medium transition-colors sm:block",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Auth-aware right side */}
          {user && profile ? (
            // Logged-in: profile dropdown
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Account menu"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {initials}
                </div>
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", profileOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border/60 bg-popover shadow-xl ring-1 ring-black/5">
                  <div className="border-b border-border/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="p-1">
                    <Link
                      href="/matches"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      Open app →
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      <UserIcon className="h-3.5 w-3.5" aria-hidden />
                      Profile & Billing
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileOpen(false);
                        await signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Anonymous: Log In + Sign Up Free
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
              >
                Log In
              </Link>
              <Button
                size="sm"
                className="bg-green-700 text-white hover:bg-green-800"
                nativeButton={false}
                render={<Link href="/signup" />}
              >
                Sign Up Free
              </Button>
            </>
          )}

          {/* Mobile hamburger — drawer below */}
          <div className="sm:hidden">
            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-foreground transition-colors hover:bg-white/[0.06]"
            >
              {mobileOpen ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer — slides down below the nav. Same backdrop +
          link-list pattern as the prior <LandingMobileMenu>, but now
          driven by MARKETING_LINKS_MOBILE so the link set always
          matches what we promise users. */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 top-14 z-40 bg-background/70 backdrop-blur-sm sm:hidden"
          />
          <div className="fixed inset-x-0 top-14 z-50 border-b border-white/[0.08] bg-background/95 backdrop-blur-xl sm:hidden">
            <ul className="mx-auto flex max-w-7xl flex-col px-4 py-2">
              {MARKETING_LINKS_MOBILE.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex h-12 items-center text-base font-medium text-foreground/85 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {!user && (
                <li className="mt-1 border-t border-white/[0.06] pt-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex h-12 items-center text-base font-medium text-foreground/85 transition-colors hover:text-foreground"
                  >
                    Log In
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </nav>
  );
}
