import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Plus } from "lucide-react";

/**
 * Floating Camera Button - Instagram style
 * Appears on Feed, Profile, and other main pages
 */
const CameraFloatingButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Pages where the camera button should appear
  const showOnPages = ["/", "/feed", "/my-profile", "/dashboard"];
  const shouldShow = showOnPages.some(page => location.pathname === page || location.pathname.startsWith("/profile"));
  
  // Don't show on camera page itself or if not logged in
  if (!shouldShow || location.pathname === "/camera" || !user) {
    return null;
  }
  
  return (
    <button
      onClick={() => navigate("/camera")}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-14 h-14 bg-gradient-to-br from-primary to-orange-500 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      data-testid="camera-floating-btn"
    >
      <div className="relative">
        <Camera className="w-6 h-6 text-white" />
        <Plus className="absolute -top-1 -right-1 w-3 h-3 text-white bg-white/30 rounded-full" />
      </div>
    </button>
  );
};

export default CameraFloatingButton;
