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
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        isListening
          ? "bg-rose/10 text-rose"
          : "text-muted/60 hover:text-muted hover:bg-black/[0.03]"
      }`}
    >
      {isListening ? (
        <>
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Mic size={14} strokeWidth={1.5} />
          </motion.span>
          聆听中
        </>
      ) : (
        <>
          <Mic size={14} strokeWidth={1.5} />
          语音
        </>
      )}
    </motion.button>
  );
}
