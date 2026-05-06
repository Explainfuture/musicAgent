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
    }, 1300);

    return () => window.clearTimeout(timeoutId);
  }, [active, segments.length, visibleCount]);

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-emerald-700">
        $ explain --waiting<br />
        播放后，我会慢慢告诉你为什么是这首。
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-4">
      {segments.slice(0, visibleCount).map((segment, index) => (
        <p
          key={`${segment}-${index}`}
          className="rounded-xl bg-emerald-400/10 px-3 py-2 text-sm leading-6 text-emerald-50"
        >
          {segment}
        </p>
      ))}
    </div>
  );
}
