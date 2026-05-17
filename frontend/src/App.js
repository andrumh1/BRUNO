import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TourProvider, TourOverlay } from "@/components/WelcomeTour";
import { NavScrollProvider } from "@/contexts/NavScrollContext";
import { Toaster } from "sonner";
import { BrunoCameraProvider } from "@/contexts/BrunoCameraContext";

// Components
import FloatingBubbles from "@/components/FloatingBubbles";
import FloatingChatBubble from "@/components/FloatingChatBubble";
import PictureInPicture from "@/components/PictureInPicture";
import CameraFloatingButton from "@/components/CameraFloatingButton";
import ProtectedRoute from "@/components/ProtectedRoute";
import MobileBottomNav from "@/components/MobileBottomNav";

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
import NFCManagerPage from "@/pages/NFCManagerPage";
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
import AnalyticsPage from "@/pages/AnalyticsPage";
import BrunoCameraPage from "@/pages/BrunoCameraPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import DeleteAccountPage from "@/pages/DeleteAccountPage";
import CookiePolicyPage from "@/pages/CookiePolicyPage";
import LegalHubPage from "@/pages/LegalHubPage";
import CommunityGuidelinesPage from "@/pages/CommunityGuidelinesPage";
import DataRightsPage from "@/pages/DataRightsPage";
import LivesListPage from "@/pages/LivesListPage";
import LiveViewerPage from "@/pages/LiveViewerPage";
import StartLivePage from "@/pages/StartLivePage";
import ReelsPage from "@/pages/ReelsPage";
import MonetizationPage from "@/pages/MonetizationPage";
import AlbumsPage from "@/pages/AlbumsPage";
import CardAnalyticsPage from "@/pages/CardAnalyticsPage";
import PremiumPage from "@/pages/PremiumPage";
import HashtagPage from "@/pages/HashtagPage";
import SavedPostsPage from "@/pages/SavedPostsPage";
import SettingsPage from "@/pages/SettingsPage";
import PartnerDashboardPage from "@/pages/PartnerDashboardPage";
import BrunoUIKitPage from "@/pages/BrunoUIKitPage";
import WelcomePage from "@/pages/WelcomePage";
import EditProfilePage from "@/pages/EditProfilePage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import BlockedUsersPage from "@/pages/BlockedUsersPage";
import DevicesPage from "@/pages/DevicesPage";
import NotificationsPage from "@/pages/NotificationsPage";

function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment (not query params) for session_id
  // This runs synchronously during render to prevent race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<FeedPage />} />
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/website" element={<BrunoWebsite />} />
      <Route path="/bruno" element={<BrunoWebsite />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/cookies" element={<CookiePolicyPage />} />
      <Route path="/legal" element={<LegalHubPage />} />
      <Route path="/legal/community" element={<CommunityGuidelinesPage />} />
      <Route path="/legal/data-rights" element={<DataRightsPage />} />
      <Route path="/ui-kit" element={<BrunoUIKitPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/c/:cardId" element={<ViewCardPage />} />
      <Route path="/n/:nfcId" element={<NFCRedirectPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/marketplace/:productId" element={<ProductDetailPage />} />
      <Route path="/profile/:userId" element={<UserProfilePage />} />
      <Route path="/hashtag/:tag" element={<HashtagPage />} />
      
      {/* Protected routes */}
      <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
      <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
      <Route path="/store/success" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
      <Route path="/store/cancel" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/my-profile" element={<ProtectedRoute><MyProfilePage /></ProtectedRoute>} />
      <Route path="/points" element={<ProtectedRoute><PointsPage /></ProtectedRoute>} />
      <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/settings/blocked" element={<ProtectedRoute><BlockedUsersPage /></ProtectedRoute>} />
      <Route path="/settings/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
      <Route path="/edit-profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/settings/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><CardAnalyticsPage /></ProtectedRoute>} />
      <Route path="/analytics/:cardId" element={<ProtectedRoute><CardAnalyticsPage /></ProtectedRoute>} />
      <Route path="/camera" element={<ProtectedRoute><BrunoCameraPage /></ProtectedRoute>} />
      <Route path="/marketplace/new" element={<ProtectedRoute><NewProductPage /></ProtectedRoute>} />
      <Route path="/marketplace/my-products" element={<ProtectedRoute><MyProductsPage /></ProtectedRoute>} />
      <Route path="/marketplace/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/my-profile" replace /></ProtectedRoute>} />
      <Route path="/cards/new" element={<ProtectedRoute><CreateCardPage /></ProtectedRoute>} />
      <Route path="/cards/:cardId/edit" element={<ProtectedRoute><EditCardPage /></ProtectedRoute>} />
      <Route path="/cards/:cardId/qr" element={<ProtectedRoute><QRCodePage /></ProtectedRoute>} />
      <Route path="/nfc/activate" element={<ProtectedRoute><ActivateNFCPage /></ProtectedRoute>} />
      <Route path="/nfc/manage" element={<ProtectedRoute><NFCManagerPage /></ProtectedRoute>} />
      <Route path="/nfc/write" element={<ProtectedRoute><NFCWritePage /></ProtectedRoute>} />
      <Route path="/settings/delete-account" element={<ProtectedRoute><DeleteAccountPage /></ProtectedRoute>} />
      <Route path="/monetization" element={<ProtectedRoute><MonetizationPage /></ProtectedRoute>} />
      <Route path="/albums" element={<ProtectedRoute><AlbumsPage /></ProtectedRoute>} />
      <Route path="/saved" element={<ProtectedRoute><SavedPostsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
      <Route path="/partner-dashboard" element={<ProtectedRoute><PartnerDashboardPage /></ProtectedRoute>} />
      <Route path="/payment/success" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
      <Route path="/payment/cancel" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
      <Route path="/reels" element={<ReelsPage />} />
      <Route path="/lives" element={<ReelsPage />} />
      <Route path="/lives/start" element={<ProtectedRoute><StartLivePage /></ProtectedRoute>} />
      <Route path="/lives/:liveId" element={<LiveViewerPage />} />
      
      {/* Fallback */}
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
              <NavScrollProvider>
              <TourProvider>
                <BrunoCameraProvider>
                <AppRouter />
                <FloatingBubbles />
                <FloatingChatBubble />
                <PictureInPicture />
                <CameraFloatingButton />
                <MobileBottomNav />
                <TourOverlay />
                <Toaster
                  position="top-center"
                  expand
                  visibleToasts={5}
                  toastOptions={{
                    unstyled: true,
                    classNames: { toast: "w-full" },
                  }}
                />
                </BrunoCameraProvider>
              </TourProvider>
              </NavScrollProvider>
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
