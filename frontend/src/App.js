import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TourProvider, TourOverlay } from "@/components/WelcomeTour";

// Components
import FloatingBubbles from "@/components/FloatingBubbles";
import FloatingChatBubble from "@/components/FloatingChatBubble";

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
import NFCRedirectPage from "@/pages/NFCRedirectPage";
import ContactPage from "@/pages/ContactPage";
import HelpPage from "@/pages/HelpPage";
import PricingPage from "@/pages/PricingPage";
import FeedPage from "@/pages/FeedPage";
import MapPage from "@/pages/MapPage";
import EditCardPage from "@/pages/EditCardPage";
import StorePage from "@/pages/StorePage";
import ChatPage from "@/pages/ChatPage";
import UserProfilePage from "@/pages/UserProfilePage";
import MyProfilePage from "@/pages/MyProfilePage";
import PointsPage from "@/pages/PointsPage";
import BrunoWebsite from "@/pages/BrunoWebsite";
import MarketplacePage from "@/pages/MarketplacePage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CartPage from "@/pages/CartPage";
import MyProductsPage from "@/pages/MyProductsPage";
import NewProductPage from "@/pages/NewProductPage";
import NotificationSettingsPage from "@/pages/NotificationSettingsPage";

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
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/website" element={<BrunoWebsite />} />
      <Route path="/bruno" element={<BrunoWebsite />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/store" element={<StorePage />} />
      <Route path="/store/success" element={<StorePage />} />
      <Route path="/store/cancel" element={<StorePage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:chatId" element={<ChatPage />} />
      <Route path="/profile/:userId" element={<UserProfilePage />} />
      <Route path="/my-profile" element={<MyProfilePage />} />
      <Route path="/points" element={<PointsPage />} />
      <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/marketplace/new" element={<NewProductPage />} />
      <Route path="/marketplace/my-products" element={<MyProductsPage />} />
      <Route path="/marketplace/cart" element={<CartPage />} />
      <Route path="/marketplace/:productId" element={<ProductDetailPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/cards/new" element={<CreateCardPage />} />
      <Route path="/cards/:cardId/edit" element={<EditCardPage />} />
      <Route path="/cards/:cardId/qr" element={<QRCodePage />} />
      <Route path="/c/:cardId" element={<ViewCardPage />} />
      <Route path="/n/:nfcId" element={<NFCRedirectPage />} />
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
          <NotificationProvider>
            <BrowserRouter>
              <TourProvider>
                <AppRouter />
                <FloatingBubbles />
                <TourOverlay />
              </TourProvider>
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
