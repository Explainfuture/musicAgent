import type { AgentStatus } from "@/types/agent";

const orbGradient: Record<AgentStatus, string> = {
  idle: "from-rose-pink/60 via-blush to-lavender-pink/50",
  listening: "from-coral/70 via-rose-pink/60 to-peach/50",
  transcribing: "from-dusty-rose/60 via-rose-pink/50 to-blush/60",
  thinking: "from-lavender-pink/60 via-rose-pink/50 to-rose-pink/40",
  searching: "from-rose-pink/50 via-peach/50 to-lavender-pink/60",
  playing: "from-coral/60 via-rose-pink/50 to-peach/50",
  paused: "from-rose-pink/40 via-blush/50 to-lavender-pink/40",
  error: "from-dusty-rose/50 via-rose-pink/40 to-blush/50",
};

const orbAccent: Record<AgentStatus, string> = {
  idle: "bg-rose-pink/25",
  listening: "bg-coral/35",
  transcribing: "bg-dusty-rose/30",
  thinking: "bg-lavender-pink/35",
  searching: "bg-rose-pink/30",
  playing: "bg-coral/35",
  paused: "bg-rose-pink/20",
  error: "bg-dusty-rose/30",
};

const orbInnerGlow: Record<AgentStatus, string> = {
  idle: "bg-white/70",
  listening: "bg-white/80",
  transcribing: "bg-white/70",
  thinking: "bg-white/75",
  searching: "bg-white/70",
  playing: "bg-white/80",
  paused: "bg-white/60",
  error: "bg-white/65",
};

export function AgentOrb({ status }: { status: AgentStatus }) {
  const isActive = !["idle", "paused", "error"].includes(status);

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Outer glow ring */}
      <div
        className={`relative h-[64px] w-[64px] rounded-full transition-all duration-700 ${
          isActive ? "animate-orb-glow" : ""
        }`}
      >
        {/* Largest halo */}
        <div
          className={`absolute inset-[-14px] rounded-full bg-gradient-to-br ${orbGradient[status]} blur-2xl transition-all duration-700 ${
            isActive ? "animate-orb-breathe" : ""
          }`}
        />

        {/* Mid glow ring */}
        <div
          className={`absolute inset-[-4px] rounded-full bg-gradient-to-br ${orbGradient[status]} blur-md transition-all duration-700 ${
            isActive ? "animate-orb-breathe" : "opacity-60"
          }`}
          style={isActive ? { animationDelay: "0.3s" } : undefined}
        />

        {/* Main orb body */}
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-white via-rose-pink/15 to-lavender-pink/20 shadow-[0_8px_32px_rgba(200,130,150,0.2)] transition-all duration-700 ${
            isActive ? "animate-orb-breathe" : ""
          }`}
          style={isActive ? { animationDelay: "0.15s" } : undefined}
        >
          {/* Inner ethereal swirl */}
          <div
            className={`absolute inset-[8px] rounded-full bg-gradient-to-br ${orbGradient[status]} transition-all duration-700 ${
              status === "thinking" ? "animate-[orb-rotate-slow_12s_linear_infinite]" : ""
            }`}
            style={{ opacity: isActive ? 0.6 : 0.35 }}
          />

          {/* Bright center */}
          <div
            className={`absolute left-1/2 top-1/2 h-[45%] w-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full ${orbInnerGlow[status]} blur-[2px] transition-all duration-700`}
          />

          {/* Core spark */}
          <div
            className={`absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-700 ${
              isActive ? "animate-status-pulse" : ""
            }`}
          />

          {/* Orbiting light particles */}
          {isActive && (
            <>
              <div
                className={`absolute right-[14px] top-[18px] h-[6px] w-[6px] rounded-full ${orbAccent[status]} blur-[1px]`}
                style={{ animation: "orb-rotate-slow 8s linear infinite" }}
              />
              <div
                className={`absolute bottom-[16px] left-[16px] h-[4px] w-[4px] rounded-full ${orbAccent[status]} blur-[1px]`}
                style={{ animation: "orb-rotate-slow 10s linear infinite reverse" }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
