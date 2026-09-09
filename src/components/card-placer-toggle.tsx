"use client";

import { CoolbetPlacerToggle } from "./coolbet-placer-toggle";

/**
 * The real-money placement toggle, embedded on a bot CARD.
 *
 * The card is a full-card <Link> to the bot detail page, so a bare click on the
 * toggle would also navigate. This wrapper stops that: it preventDefaults +
 * stops propagation on the click, which (a) keeps next/link from navigating —
 * Link ignores a click whose default was prevented — and (b) leaves the toggle's
 * own handler untouched (it runs first, on the target, before this bubble-phase
 * guard). The real-money semantics (OFF→ON confirm, fail-closed) are entirely in
 * CoolbetPlacerToggle and unchanged.
 */
export function CardPlacerToggle({
  botName,
  initialEnabled,
}: {
  botName: string;
  initialEnabled: boolean;
}) {
  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <CoolbetPlacerToggle botName={botName} initialEnabled={initialEnabled} />
    </div>
  );
}
