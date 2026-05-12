"use client";

import { useState } from "react";
import Image from "next/image";

export function TeamLogoHeader({
  logo,
  name,
  size = "lg",
}: {
  logo: string | null;
  name: string;
  size?: "sm" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase();
  const px = size === "lg" ? "size-10 sm:size-12" : "size-6";
  const textSize = size === "lg" ? "text-sm" : "text-[8px]";

  if (logo && !failed) {
    return (
      <div className={`relative ${px} shrink-0 overflow-hidden rounded-full bg-white/[0.06]`}>
        <Image
          src={logo}
          alt={name}
          fill
          sizes={size === "lg" ? "48px" : "24px"}
          className="object-contain p-0.5"
          priority={size === "lg"}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${px} shrink-0 rounded-full bg-white/[0.08] flex items-center justify-center`}>
      <span className={`${textSize} font-bold text-muted-foreground`}>{initial}</span>
    </div>
  );
}
