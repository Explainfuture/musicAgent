"use client";

import type { FeedbackType } from "@/types/agent";

const feedbackItems: Array<{
  value: FeedbackType;
  label: string;
  emoji: string;
}> = [
  { value: "good_fit", label: "对味", emoji: "♪" },
  { value: "not_fit", label: "不对味", emoji: "✕" },
  { value: "too_loud", label: "太吵", emoji: "~" },
  { value: "too_sad", label: "太丧", emoji: "°" },
  { value: "too_flat", label: "太平", emoji: "—" },
];

export function FeedbackBar({
  disabled,
  onFeedback,
}: {
  disabled: boolean;
  onFeedback: (feedback: FeedbackType) => void;
}) {
  if (disabled) return null;

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {feedbackItems.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onFeedback(item.value)}
          className="rounded-full border border-rose-pink/12 bg-white/50 px-3 py-1.5 text-[11px] font-medium text-muted-plum/80 transition-all hover:border-rose-pink/25 hover:bg-rose-pink/5 hover:text-plum active:scale-95"
        >
          <span className="mr-1 opacity-40">{item.emoji}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
