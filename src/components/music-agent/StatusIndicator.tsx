"use client";

import { motion } from "framer-motion";
import type { AgentStatus } from "@/types/agent";
import { Bot, Ear, LoaderCircle, Radio, PauseCircle, AlertTriangle, Sparkles } from "lucide-react";

const config: Record<AgentStatus, { label: string; description: string; icon: typeof Sparkles }> = {
  idle: { label: "待命", description: "随时接住你的情绪", icon: Bot },
  listening: { label: "正在聆听", description: "我在认真听你说", icon: Ear },
  transcribing: { label: "整理语音", description: "把你的表达转成文字", icon: LoaderCircle },
  thinking: { label: "理解情绪", description: "正在分析你的心情", icon: Sparkles },
  searching: { label: "寻找音乐", description: "正在匹配最合适的歌", icon: Radio },
  playing: { label: "正在播放", description: "希望这首歌陪着你", icon: Radio },
  paused: { label: "已暂停", description: "你随时可以继续", icon: PauseCircle },
  ended: { label: "已听完", description: "我会接着找下一首", icon: Sparkles },
  error: { label: "出了点问题", description: "我会马上重试", icon: AlertTriangle },
};

export function StatusIndicator({ status, detail }: { status: AgentStatus; detail?: string }) {
  const { label, description, icon: Icon } = config[status];
  const spinning = ["thinking", "searching", "transcribing"].includes(status);

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0.6, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 shadow-xs"
    >
      <motion.div
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { duration: 1.4, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}
        className="rounded-full bg-rose-surface p-1.5 text-rose"
      >
        <Icon size={14} aria-hidden="true" />
      </motion.div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground/85">{label}</p>
        <p className="truncate text-[11px] text-muted/70">{detail || description}</p>
      </div>
    </motion.div>
  );
}
