import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import QuickStoryButton from "@/components/bruno/QuickStoryButton";

// Routes where the FAB would clutter the UX
const HIDDEN_PATTERNS = [
  /^\/login/,
  /^\/register/,
  /^\/welcome/,
  /^\/landing/,
  /^\/website/,
  /^\/bruno/,
  /^\/contact/,
  /^\/help/,
  /^\/pricing/,
  /^\/privacy/,
  /^\/terms/,
  /^\/cookies/,
  /^\/legal/,
  /^\/c\//, // public card view
  /^\/n\//, // NFC redirect
  /^\/chat/,
  /^\/camera/,
  /^\/ui-kit/,
  /^\/lives/,
  /^\/reels/,
  /^\/qr/,
];

export default function QuickStoryFAB() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;
  if (HIDDEN_PATTERNS.some((rx) => rx.test(location.pathname))) return null;

  return <QuickStoryButton variant="floating" testId="global-quick-story-fab" />;
}
