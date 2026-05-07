"use client";

import { motion } from "framer-motion";
import type { AgentStatus } from "@/types/agent";

const config: Record<AgentStatus, { label: string; description: string }> = {
  idle: { label: "等待中", description: "告诉我你此刻的感受" },
  listening: { label: "正在聆听", description: "我在用心听你说" },
  transcribing: { label: "整理语音", description: "正在理解你的话语" },
  thinking: { label: "感受情绪", description: "在体会你的心情" },
  searching: { label: "寻找音乐", description: "为你挑选最合适的一首" },
  playing: { label: "正在播放", description: "希望这首歌能陪伴你" },
  paused: { label: "已暂停", description: "随时可以继续" },
  error: { label: "出了点问题", description: "让我重新为你找一首" },
};

export function StatusIndicator({ status }: { status: AgentStatus }) {
  const { label, description } = config[status];
  const isActive = !["idle", "paused", "error"].includes(status);

  return (
    <div className="flex items-center gap-2">
      <motion.span
        className="h-2 w-2 rounded-full bg-rose"
        animate={isActive ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.3 }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      <span className="text-xs text-muted/60">· {description}</span>
    </div>
  );
}
