"use client";

// The public site chrome for the (app) route group: Nav + the centred max-w-7xl <main>.
// /admin/** is a full-height app shell with its own sidebar (src/app/(app)/admin/layout.tsx),
// so there the chrome steps aside and renders children bare. A pathname check rather than moving
// admin into its own route group: the admin tree is referenced by path from many places (engine
// smoke tests, docs), and a move would rewrite all of them for no behavioural gain.

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function isAdminPath(pathname: string | null): boolean {
  return !!pathname && (pathname === "/admin" || pathname.startsWith("/admin/"));
}

export function PublicChrome({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  if (isAdminPath(pathname)) return <>{children}</>;
  return (
    <>
      {nav}
      <main className="mx-auto w-full max-w-7xl flex-1 px-2 sm:px-4 py-6">{children}</main>
    </>
  );
}
