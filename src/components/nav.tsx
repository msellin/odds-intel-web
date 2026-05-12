"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Target,
  TrendingUp,
  Menu,
  X,
  LogOut,
  LogIn,
  Bot,
  BookOpen,
  Info,
  Crosshair,
  ChevronDown,
  User,
  Wallet,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

const primaryLinks = [
  { href: "/matches", label: "Matches", icon: Activity },
  { href: "/value-bets", label: "Value Bets", icon: Target },
  { href: "/performance", label: "Performance", icon: BarChart3 },
  { href: "/predictions", label: "Predictions", icon: TrendingUp },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, profile, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut();
    router.push("/");
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href={user ? "/matches" : "/"} className="flex items-center gap-2">
          <span className="font-mono text-xl font-black uppercase italic tracking-tight text-white whitespace-nowrap">
            ODDS<span className="text-green-500 ml-[0.15em]">INTEL</span>
          </span>
          <span className="rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 px-1.5 py-0.5 border border-amber-500/30">
            Beta
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}

          <div className="ml-2 h-5 w-px bg-border" />

          {!loading && user ? (
            /* Logged-in: profile dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  profileOpen
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {initials}
                </div>
                <ChevronDown className={cn("h-3 w-3 transition-transform", profileOpen && "rotate-180")} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border/60 bg-popover shadow-xl ring-1 ring-black/5">
                  {/* Email header */}
                  <div className="border-b border-border/40 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>

                  <div className="p-1">
                    <Link
                      href="/my-picks"
                      onClick={() => setProfileOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        pathname === "/my-picks"
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      <Crosshair className="h-3.5 w-3.5" />
                      My Picks
                    </Link>
                    {(profile?.tier === "elite" || profile?.is_superadmin) && (
                      <Link
                        href="/bankroll"
                        onClick={() => setProfileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          pathname === "/bankroll"
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-accent"
                        )}
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        Bankroll Analytics
                        <span className="ml-auto rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400">Elite</span>
                      </Link>
                    )}
                    <Link
                      href="/profile"
                      onClick={() => setProfileOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        pathname === "/profile"
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      <User className="h-3.5 w-3.5" />
                      Profile & Billing
                    </Link>
                  </div>

                  <div className="border-t border-border/40 p-1">
                    <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                      Learn
                    </p>
                    <Link
                      href="/learn"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Glossary
                    </Link>
                    <Link
                      href="/how-it-works"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      <Info className="h-3.5 w-3.5" />
                      How it Works
                    </Link>
                  </div>

                  {profile?.is_superadmin && (
                    <div className="border-t border-border/40 p-1">
                      <Link
                        href="/admin/bots"
                        onClick={() => setProfileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          pathname === "/admin/bots"
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-amber-500/70 hover:bg-accent hover:text-amber-400"
                        )}
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Bot Dashboard
                      </Link>
                      <Link
                        href="/admin/ops"
                        onClick={() => setProfileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          pathname === "/admin/ops"
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-amber-500/70 hover:bg-accent hover:text-amber-400"
                        )}
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Ops Dashboard
                      </Link>
                      <Link
                        href="/admin/place"
                        onClick={() => setProfileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          pathname === "/admin/place"
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-amber-500/70 hover:bg-accent hover:text-amber-400"
                        )}
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Place Bet
                      </Link>
                      <Link
                        href="/admin/real-bets"
                        onClick={() => setProfileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          pathname === "/admin/real-bets"
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-amber-500/70 hover:bg-accent hover:text-amber-400"
                        )}
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Real Bets
                      </Link>
                    </div>
                  )}

                  <div className="border-t border-border/40 p-1">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : !loading ? (
            /* Logged-out */
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                Log In
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Sign Up
              </Link>
            </>
          ) : null}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-muted-foreground"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t border-border/50 bg-background px-4 pb-4 pt-3 md:hidden">
          {/* Section: Features */}
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
            Features
          </p>
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-l-2 border-primary bg-primary/10 text-primary"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}

          {!loading && user ? (
            <>
              {/* Section: Account */}
              <div className="my-2 h-px bg-border/50" />
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Account
              </p>
              <Link
                href="/my-picks"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                  pathname === "/my-picks"
                    ? "border-l-2 border-primary bg-primary/10 text-primary"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Crosshair className="h-4 w-4" />
                My Picks
              </Link>
              {(profile?.tier === "elite" || profile?.is_superadmin) && (
                <Link
                  href="/bankroll"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                    pathname === "/bankroll"
                      ? "border-l-2 border-primary bg-primary/10 text-primary"
                      : "border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Wallet className="h-4 w-4" />
                  Bankroll Analytics
                </Link>
              )}
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                  pathname === "/profile"
                    ? "border-l-2 border-primary bg-primary/10 text-primary"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <User className="h-4 w-4" />
                Profile & Billing
              </Link>

              {/* Section: Learn */}
              <div className="my-2 h-px bg-border/50" />
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Learn
              </p>
              <Link
                href="/learn"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 border-l-2 border-transparent rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Glossary
              </Link>
              <Link
                href="/how-it-works"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 border-l-2 border-transparent rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Info className="h-4 w-4" />
                How it Works
              </Link>
              {profile?.is_superadmin && (
                <>
                  <div className="my-2 h-px bg-border/50" />
                  <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-amber-500/40">
                    Admin
                  </p>
                  <Link
                    href="/admin/bots"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 border-l-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                      pathname === "/admin/bots"
                        ? "border-amber-400 bg-amber-500/10 text-amber-400"
                        : "border-transparent text-amber-500/70 hover:bg-accent hover:text-amber-400"
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    Bot Dashboard
                  </Link>
                  <Link
                    href="/admin/ops"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 border-l-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                      pathname === "/admin/ops"
                        ? "border-amber-400 bg-amber-500/10 text-amber-400"
                        : "border-transparent text-amber-500/70 hover:bg-accent hover:text-amber-400"
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    Ops Dashboard
                  </Link>
                  <Link
                    href="/admin/place"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 border-l-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                      pathname === "/admin/place"
                        ? "border-amber-400 bg-amber-500/10 text-amber-400"
                        : "border-transparent text-amber-500/70 hover:bg-accent hover:text-amber-400"
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    Place Bet
                  </Link>
                  <Link
                    href="/admin/real-bets"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 border-l-2 rounded-md px-3 py-2.5 text-sm transition-colors",
                      pathname === "/admin/real-bets"
                        ? "border-amber-400 bg-amber-500/10 text-amber-400"
                        : "border-transparent text-amber-500/70 hover:bg-accent hover:text-amber-400"
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    Real Bets
                  </Link>
                </>
              )}
              <div className="my-2 h-px bg-border/50" />
              <button
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                className="flex w-full items-center gap-2 border-l-2 border-transparent rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          ) : !loading ? (
            <>
              {/* Section: Learn */}
              <div className="my-2 h-px bg-border/50" />
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Learn
              </p>
              <Link
                href="/learn"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 border-l-2 border-transparent rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Glossary
              </Link>
              <Link
                href="/how-it-works"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 border-l-2 border-transparent rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Info className="h-4 w-4" />
                How it Works
              </Link>
              <div className="my-2 h-px bg-border/50" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 border-l-2 border-transparent rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Log In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors mt-1"
              >
                <User className="h-4 w-4" />
                Sign Up Free
              </Link>
            </>
          ) : null}
        </nav>
      )}
    </header>
  );
}
