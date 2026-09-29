/**
 * StoryRing — wraps any avatar with a glowing bubble ring when the user
 * has at least one active (non-expired) 24h story.
 *
 * Always renders the avatar as a circle. With an active story:
 *   - Conic gradient (orange→pink→purple) ring
 *   - Animated outer glow ("bubble light") that pulses
 *   - Tappable to open the user's stories
 *
 * Without an active story:
 *   - Plain circular wrapper, NO ring, NO glow
 *   - Children should still appear circular (we keep overflow-hidden + rounded-full)
 */
import React from "react";
import { motion } from "framer-motion";

export default function StoryRing({
  hasActive = false,
  size = 56,
  thickness = 2,
  onOpen,
  children,
  testId,
  watched = false,
  glow = true,
}) {
  // Always: circular box of `size`
  const baseStyle = { width: size, height: size };

  if (!hasActive) {
    return (
      <div
        style={baseStyle}
        className="relative shrink-0 rounded-full overflow-hidden"
        data-testid={testId || "story-ring-inactive"}
      >
        {children}
      </div>
    );
  }

  const inner = size - thickness * 2;
  const ringGradient = watched
    ? "linear-gradient(135deg,#a1a1aa,#71717a)"
    : "conic-gradient(from 220deg, #ff6a00, #ff2d75, #b446ff, #ff6a00)";

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      whileTap={{ scale: 0.95 }}
      data-testid={testId || "story-ring"}
      style={{ ...baseStyle, padding: thickness }}
      className="relative shrink-0 rounded-full inline-grid place-items-center"
    >
      {/* Outer glow / "bubble light" pulse — only when active and not watched */}
      {glow && !watched && (
        <motion.span
          aria-hidden
          animate={{
            opacity: [0.55, 0.95, 0.55],
            scale: [1, 1.18, 1],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,138,69,0.55) 0%, rgba(255,72,127,0.35) 45%, rgba(180,70,255,0) 70%)",
            filter: "blur(6px)",
          }}
        />
      )}

      {/* Conic gradient ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ background: ringGradient }}
      />

      {/* Inner background ring (so the avatar floats on top of the gradient) */}
      <span
        aria-hidden
        className="absolute rounded-full bg-background"
        style={{ inset: thickness - 0.5 }}
      />

      {/* Avatar container — ALWAYS perfectly round */}
      <span
        className="relative grid place-items-center rounded-full overflow-hidden"
        style={{ width: inner, height: inner }}
      >
        {children}
      </span>

      {/* Subtle inner highlight to feel like a glossy bubble */}
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: thickness + 0.5,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 35%)",
          mixBlendMode: "screen",
        }}
      />
    </motion.button>
  );
}
