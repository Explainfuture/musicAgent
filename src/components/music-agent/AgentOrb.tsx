"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { AgentStatus } from "@/types/agent";

const statusGlow: Record<AgentStatus, string> = {
  idle: "rgba(212,149,168,0.12)",
  listening: "rgba(212,149,168,0.28)",
  transcribing: "rgba(184,130,150,0.22)",
  thinking: "rgba(212,149,168,0.24)",
  searching: "rgba(212,149,168,0.22)",
  playing: "rgba(212,149,168,0.30)",
  paused: "rgba(212,149,168,0.10)",
  error: "rgba(200,120,130,0.18)",
};

export function AgentOrb({ status }: { status: AgentStatus }) {
  const isActive = !["idle", "paused", "error"].includes(status);
  const glow = statusGlow[status];

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Outer glow */}
      <motion.div
        className="absolute h-[72px] w-[72px] rounded-full"
        animate={{
          boxShadow: [
            `0 0 24px ${glow}, 0 0 48px ${glow}`,
            `0 0 40px ${glow}, 0 0 64px ${glow}`,
            `0 0 24px ${glow}, 0 0 48px ${glow}`,
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ opacity: isActive ? 1 : 0.3 }}
      />

      {/* Orb body */}
      <motion.div
        className="relative h-[56px] w-[56px] rounded-full border border-rose/10 bg-white/80 backdrop-blur shadow-[inset_0_0_30px_rgba(212,149,168,0.06)]"
        animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Inner gradient */}
        <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-rose-light/60 via-rose-surface to-white" />

        {/* Spark icon */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={isActive ? { rotate: [0, 360] } : {}}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles
            size={18}
            className="text-rose/70"
            strokeWidth={1.5}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
