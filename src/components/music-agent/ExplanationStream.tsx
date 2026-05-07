"use client";

import { useEffect, useState } from "react";

export function ExplanationStream({
  segments,
  active,
}: {
  segments: string[];
  active: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(active && segments.length > 0 ? 1 : 0);
  }, [active, segments]);

  useEffect(() => {
    if (!active || visibleCount >= segments.length) return;

    const timeoutId = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, segments.length));
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [active, segments.length, visibleCount]);

  if (segments.length === 0) {
    if (!active) return null;
    return (
      <div className="rounded-2xl bg-rose-pink/5 px-4 py-3 text-[12px] leading-relaxed text-muted-plum/70">
        播放后，我会告诉你为什么选了这首歌...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {segments.slice(0, visibleCount).map((segment, index) => (
        <div
          key={index}
          className="animate-fade-in-up rounded-[18px] rounded-bl-md bg-white/75 px-4 py-2.5 text-[13px] leading-relaxed text-plum shadow-[0_1px_8px_rgba(180,120,140,0.05)]"
        >
          {segment}
        </div>
      ))}
    </div>
  );
}
