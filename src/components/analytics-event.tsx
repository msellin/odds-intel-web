"use client";

import { useEffect } from "react";
import { captureEvent } from "@/components/posthog-provider";

interface Props {
  event: string;
  properties?: Record<string, unknown>;
}

export function AnalyticsEvent({ event, properties }: Props) {
  useEffect(() => {
    captureEvent(event, properties);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
