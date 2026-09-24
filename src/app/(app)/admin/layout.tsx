export const dynamic = "force-dynamic";

import Link from "next/link";
import type { ReactNode } from "react";
import { requireSuperadmin } from "@/lib/admin-auth";
import { isBotBoardDevPreview, loadFleetStatus } from "@/lib/bot-board";
import { AdminShell } from "@/components/admin/admin-shell";

// Shared admin layout (ADMIN-SHARED-SHELL, 2026-09-24). Owner: "the left navigation menu, when I
// navigate to other pages, loses the navigation menu … the left menu should be a single component
// and we should only render the middle block." The sidebar used to live in admin/bots/admin-shell.tsx
// and wrapped /admin/bots only; every other admin page had its own back-link and max-width box.
//
// Now: this layout checks superadmin ONCE and renders the shell (src/components/admin/admin-shell.tsx)
// around {children}. Layouts persist across client navigation, so moving between admin pages
// swaps only the middle block. Each page KEEPS its own server-side superadmin check (defence in
// depth — a layout is not a guarantee for every render path), and API routes check for themselves.
//
// The public Nav/main from (app)/layout.tsx are skipped for /admin by src/components/public-chrome.tsx.
//
// Dev fixture preview (BOT_BOARD_FIXTURE + NODE_ENV=development, never in prod — see
// isBotBoardDevPreview): the layout skips its gate so /admin/bots renders without login; every
// other admin page still runs its own check and shows "Superadmin only." inside the shell.

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isBotBoardDevPreview()) {
    const gate = await requireSuperadmin();
    if ("error" in gate) return <Denied signedIn={gate.status === 403} />;
  }
  const fleet = await loadFleetStatus();
  return <AdminShell fleet={fleet.row}>{children}</AdminShell>;
}

function Denied({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
      <div>{signedIn ? "Superadmin only." : "Access denied."}</div>
      <div className="flex gap-4 text-sm">
        {!signedIn && (
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Sign in
          </Link>
        )}
        <Link href="/" className="underline underline-offset-4 hover:text-foreground">
          Back to oddsintel.app
        </Link>
      </div>
    </div>
  );
}
