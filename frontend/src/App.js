import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

// Pages
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import CreateCardPage from "@/pages/CreateCardPage";
import ViewCardPage from "@/pages/ViewCardPage";
import QRCodePage from "@/pages/QRCodePage";
import ActivateNFCPage from "@/pages/ActivateNFCPage";
import NFCWritePage from "@/pages/NFCWritePage";
import ContactPage from "@/pages/ContactPage";
import HelpPage from "@/pages/HelpPage";
import PricingPage from "@/pages/PricingPage";
import FeedPage from "@/pages/FeedPage";
import MapPage from "@/pages/MapPage";
import EditCardPage from "@/pages/EditCardPage";
import StorePage from "@/pages/StorePage";

function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment (not query params) for session_id
  // This runs synchronously during render to prevent race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<FeedPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/store" element={<StorePage />} />
      <Route path="/store/success" element={<StorePage />} />
      <Route path="/store/cancel" element={<StorePage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/cards/new" element={<CreateCardPage />} />
      <Route path="/cards/:cardId/edit" element={<EditCardPage />} />
      <Route path="/cards/:cardId/qr" element={<QRCodePage />} />
      <Route path="/c/:cardId" element={<ViewCardPage />} />
      <Route path="/nfc/activate" element={<ActivateNFCPage />} />
      <Route path="/nfc/write" element={<NFCWritePage />} />
      <Route path="*" element={<FeedPage />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
