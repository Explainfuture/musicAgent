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
  return (
    <button
      type="button"
      onClick={isListening ? onStop : onStart}
      className="rounded-full border border-emerald-400/20 bg-white/5 px-4 py-2 text-sm font-medium text-emerald-100 shadow-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={!isSupported}
      title={isSupported ? "点击说话" : "当前浏览器不支持语音识别"}
    >
      {isListening ? "停止聆听" : "点击说话"}
    </button>
  );
}
