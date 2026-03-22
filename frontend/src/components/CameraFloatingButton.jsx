import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Camera } from "lucide-react";

/**
 * Floating Camera Button - Desktop only (hidden on mobile since we have MobileBottomNav)
 * Compact, bubble-style design matching the iOS 26.3 aesthetic
 */
const CameraFloatingButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Pages where the camera button should appear (desktop only)
  const showOnPages = ["/", "/feed", "/my-profile", "/my-profile"];
  const shouldShow = showOnPages.some(page => location.pathname === page || location.pathname.startsWith("/profile"));
  
  // Don't show on camera page itself or if not logged in
  if (!shouldShow || location.pathname === "/camera" || !user) {
    return null;
  }
  
  return (
    <button
      onClick={() => navigate("/camera")}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11 h-11 bg-gradient-to-br from-primary to-orange-600 rounded-full shadow-lg shadow-primary/25 items-center justify-center hover:scale-105 hover:shadow-primary/40 transition-all duration-200 active:scale-95 hidden md:flex"
      data-testid="camera-floating-btn"
    >
      <Camera className="w-5 h-5 text-white" strokeWidth={2} />
    </button>
  );
};

export default CameraFloatingButton;
