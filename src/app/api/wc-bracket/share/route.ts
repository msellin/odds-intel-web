import { NextResponse } from "next/server";

import { getOrCreateShareToken } from "@/app/(app)/world-cup/actions";

/**
 * POST /api/wc-bracket/share
 *
 * Returns the share URL for the calling user's bracket, creating a token on
 * first call. Used by the "Share my bracket" button in WCBracketBoard.
 *
 * Auth + champion-pick guard live in the server action. We just adapt the
 * action result to a JSON response so the client can copy / native-share.
 */
export async function POST() {
  const res = await getOrCreateShareToken();
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error ?? "Could not generate share link." },
      { status: 400 }
    );
  }
  return NextResponse.json({ token: res.token, url: res.url });
}
