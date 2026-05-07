"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ExplanationStream({
  segments,
  active,
}: {
  segments: string[];
  active: boolean;
}) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(active && segments.length > 0 ? 1 : 0);
  }, [active, segments]);

  useEffect(() => {
    if (!active || visible >= segments.length) return;
    const id = setTimeout(() => setVisible((c) => Math.min(c + 1, segments.length)), 1600);
    return () => clearTimeout(id);
  }, [active, segments.length, visible]);

  if (segments.length === 0) return null;

  return (
    <AnimatePresence>
      {segments.slice(0, visible).map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface/70 px-3.5 py-2.5 text-sm leading-relaxed text-foreground/80 shadow-xs"
        >
          {s}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
