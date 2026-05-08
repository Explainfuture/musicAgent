"use client";

import { motion } from "framer-motion";
import { Mic } from "lucide-react";

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
    <motion.button
      type="button"
      onClick={isListening ? onStop : onStart}
      whileTap={{ scale: 0.95 }}
      aria-label={isListening ? "停止语音输入" : "开始语音输入"}
      aria-pressed={isListening}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        isListening
          ? "bg-rose/10 text-rose"
          : "text-muted/60 hover:bg-black/[0.03] hover:text-muted"
      }`}
    >
      {isListening ? (
        <>
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Mic size={14} strokeWidth={1.5} aria-hidden="true" />
          </motion.span>
          聆听中
        </>
      ) : (
        <>
          <Mic size={14} strokeWidth={1.5} aria-hidden="true" />
          语音
        </>
      )}
    </motion.button>
  );
}
