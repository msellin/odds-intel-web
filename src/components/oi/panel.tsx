// Product-wide building blocks (#139 admin visual direction §4, 2026-09-24). Admin is the first
// consumer; they are named and styled so the public pages can adopt them later (#143). The site's
// look: dark tokens, borders not shadows, rounded-xl cards, mono uppercase eyebrow labels.

import type { ReactNode } from "react";
import { InfoTip } from "./info-tip";

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[11px] uppercase tracking-wider text-muted-foreground ${className}`}>{children}</div>;
}

export function Panel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 rounded-xl border border-border bg-card ${className}`}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
      <div className="min-w-0">
        {/* answer-first pass (2026-09-25): the explanation is an ⓘ tip, not a paragraph under
            every title — the owner found the admin read like a report */}
        <h2 className="inline-flex items-center gap-1 text-sm font-medium">
          {title}
          {description && <InfoTip>{description}</InfoTip>}
        </h2>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
