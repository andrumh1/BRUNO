import React from "react";
import { motion } from "framer-motion";

/**
 * TypingDots — three dots that pulse in sequence, WhatsApp/iMessage style.
 *
 * Props:
 *   label   — optional text shown before dots (e.g., "María")
 *   testId
 */
export default function TypingDots({ label, testId = "typing-dots" }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-primary font-medium"
      data-testid={testId}
    >
      {label && <span>{label}</span>}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      ))}
    </span>
  );
}
