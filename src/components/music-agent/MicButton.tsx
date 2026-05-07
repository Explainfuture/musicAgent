"use client";

export function MicButton({
  isListening,
  isSupported,
  onStart,
  onStop,
}: {
  isListening: boolean;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={isListening ? onStop : onStart}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all active:scale-95 ${
        isListening
          ? "bg-coral/15 text-coral shadow-[0_0_0_3px_rgba(232,121,139,0.12)]"
          : "bg-white/60 text-muted-plum/70 hover:text-muted-plum hover:bg-rose-pink/8"
      }`}
      title={isListening ? "停止聆听" : "点击说话"}
    >
      {/* Mic icon */}
      <svg
        className={`h-3.5 w-3.5 ${isListening ? "animate-status-pulse" : ""}`}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>
      {isListening ? "聆听中" : "语音"}
    </button>
  );
}
