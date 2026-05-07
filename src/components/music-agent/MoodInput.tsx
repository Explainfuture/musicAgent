"use client";

import { FormEvent } from "react";
import { motion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import { MicButton } from "./MicButton";
import { Button } from "@/components/ui/button";

export function MoodInput({
  inputText,
  setInputText,
  canSubmit,
  onSubmit,
  isSearching,
  isListening,
  isSpeechSupported,
  interimText,
  onMicStart,
  onMicStop,
}: {
  inputText: string;
  setInputText: (v: string) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  isSearching: boolean;
  isListening: boolean;
  isSpeechSupported: boolean;
  interimText: string;
  onMicStart: () => void;
  onMicStop: () => void;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit(); }}
      className="space-y-2"
    >
      <div className="rounded-2xl border border-border bg-surface/80 px-3 py-2 transition-all focus-within:border-rose/20 focus-within:shadow-sm">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="说说你现在的感受..."
          rows={2}
          className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <MicButton
            isListening={isListening}
            isSupported={isSpeechSupported}
            onStart={onMicStart}
            onStop={onMicStop}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
          >
            {isSearching ? "寻找中..." : "为我播放"}
            <SendHorizonal size={12} />
          </Button>
        </div>
      </div>

      {interimText && isListening && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl bg-rose-surface/50 px-3 py-1.5 text-xs italic text-muted/70"
        >
          {interimText}
        </motion.div>
      )}

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {["有点累了", "需要治愈", "给我动力", "想要安静"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setInputText(s)}
            className="rounded-full border border-border/80 px-3 py-1 text-[11px] text-muted/70 transition-colors hover:border-rose/15 hover:bg-rose-surface/50 hover:text-rose/80"
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}
