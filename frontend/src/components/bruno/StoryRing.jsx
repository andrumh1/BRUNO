/**
 * StoryRing — wraps any avatar with a gradient story ring when the user
 * has at least one active (non-expired) 24h story.
 *
 * Behavior:
 *   - If `hasActive` is true, draws a 2px conic gradient ring (orange→purple→pink)
 *     and makes the avatar tappable to open the user's stories.
 *   - If `hasActive` is false, renders the avatar unchanged.
 *   - Click handler is exposed via `onOpen` (parent handles BrunoStoryViewer).
 *
 * Usage:
 *   <StoryRing userId={u.id} hasActive size={56} onOpen={() => openStories(u.id)}>
 *     <img src={u.avatar_url} className="rounded-full" />
 *   </StoryRing>
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
}) {
  if (!hasActive) {
    return <div style={{ width: size, height: size }} className="relative shrink-0">{children}</div>;
  }

  const inner = size - thickness * 2;
  const ringGradient = watched
    ? "linear-gradient(135deg,#a1a1aa,#71717a)" // muted gray for already-watched
    : "conic-gradient(from 220deg, #ff5a00, #ff2d75, #b446ff, #ff5a00)";

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      whileTap={{ scale: 0.95 }}
      data-testid={testId || "story-ring"}
      style={{ width: size, height: size, padding: thickness }}
      className="relative shrink-0 rounded-full inline-grid place-items-center"
    >
      {/* gradient ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ background: ringGradient }}
      />
      {/* inner background ring (so avatar sits on top of gradient) */}
      <span
        aria-hidden
        className="absolute rounded-full bg-background"
        style={{ inset: thickness - 0.5 }}
      />
      <span
        className="relative grid place-items-center rounded-full overflow-hidden"
        style={{ width: inner, height: inner }}
      >
        {children}
      </span>
    </motion.button>
  );
}
