"use client";

import type { FeedbackType } from "@/types/agent";

const feedbackItems: Array<{ value: FeedbackType; label: string }> = [
  { value: "good_fit", label: "对味" },
  { value: "not_fit", label: "不对味" },
  { value: "too_loud", label: "太吵" },
  { value: "too_sad", label: "太丧" },
  { value: "too_flat", label: "太平" },
];

export function FeedbackBar({
  disabled,
  onFeedback,
}: {
  disabled: boolean;
  onFeedback: (feedback: FeedbackType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {feedbackItems.map((item) => (
        <button
          key={item.value}
          type="button"
          disabled={disabled}
          onClick={() => onFeedback(item.value)}
          className="rounded-full border border-emerald-400/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-emerald-100 shadow-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
