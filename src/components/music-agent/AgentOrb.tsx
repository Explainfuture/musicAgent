import type { AgentStatus } from "@/types/agent";

const statusClassName: Record<AgentStatus, string> = {
  idle: "scale-100 opacity-80",
  listening: "scale-110 animate-pulse opacity-100",
  transcribing: "scale-105 animate-pulse opacity-90",
  thinking: "scale-105 animate-spin opacity-95",
  searching: "scale-110 animate-pulse opacity-95",
  playing: "scale-110 animate-bounce opacity-100",
  paused: "scale-95 opacity-70",
  error: "scale-100 opacity-90",
};

export function AgentOrb({ status }: { status: AgentStatus }) {
  return (
    <div className="relative flex justify-center py-2">
      <div className="absolute h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
      <div
        className={`relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-300 via-cyan-300 to-sky-500 shadow-[0_18px_60px_rgba(16,185,129,0.25)] transition-all duration-500 ${statusClassName[status]}`}
        aria-label={`Agent status: ${status}`}
      />
    </div>
  );
}
