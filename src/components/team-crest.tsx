"use client";

import { useState } from "react";
import Image from "next/image";

export function TeamCrest({ logo, name, size = 6 }: { logo: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const px = `size-${size}`;
  const textSize = size <= 5 ? "text-[8px]" : "text-[10px]";

  if (logo && !failed) {
    return (
      <div className={`relative ${px} shrink-0 overflow-hidden rounded-full bg-white/[0.06]`}>
        <Image
          src={logo}
          alt={name}
          fill
          sizes={`${size * 4}px`}
          className="object-contain p-0.5"
          unoptimized
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className={`${px} shrink-0 rounded-full bg-white/[0.08] flex items-center justify-center`}>
      <span className={`${textSize} font-bold text-muted-foreground`}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}
