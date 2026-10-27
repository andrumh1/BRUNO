import ServiceRedirect from "@/components/bruno/ServicePromoBubble";
import React, { Suspense } from "react";
import axios from "axios";
import { lazyPage } from "@/lib/lazyPage";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "@/contexts/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TourProvider, TourOverlay } from "@/components/WelcomeTour";
import { NavScrollProvider } from "@/contexts/NavScrollContext";
import { Toaster } from "sonner";
import { BrunoCameraProvider } from "@/contexts/BrunoCameraContext";
import RealtimeNotificationProvider from "@/contexts/RealtimeNotificationContext";
import StoryActivityProvider from "@/contexts/StoryActivityContext";
import { I18nProvider } from "@/contexts/I18nContext";
import NativeBootstrap from "@/native/NativeBootstrap";
import { KeyboardViewportManager } from "@/hooks/useVisualViewportHeight";
import CardReminderBanner from "@/components/CardReminderBanner";

// Components
import FloatingBubbles from "@/components/FloatingBubbles";
import FloatingChatBubble from "@/components/FloatingChatBubble";
import CallOrchestrator from "@/components/CallOrchestrator";

// Remount chat + call orchestration whenever the signed-in account changes so no state leaks between accounts.
const AccountScoped = () => {
  const { user } = useAuth();
  return (
    <React.Fragment key={user?.id || "anon"}>
      <FloatingChatBubble />
      <CallOrchestrator />
      <AccentSync />
    </React.Fragment>
  );
};
import PWAInstallPrompt from "@/components/bruno/PWAInstallPrompt";
import PictureInPicture from "@/components/PictureInPicture";
import CameraFloatingButton from "@/components/CameraFloatingButton";
import ProtectedRoute from "@/components/ProtectedRoute";
import MobileBottomNav from "@/components/MobileBottomNav";
import UploadChip from "@/components/bruno/UploadChip";
import FloatingBackButton from "@/components/FloatingBackButton";

// Pages
const LandingPage = lazyPage(() => import("@/pages/LandingPage"));
import LoginPage from "@/pages/LoginPage";
const RegisterPage = lazyPage(() => import("@/pages/RegisterPage"));
import AuthCallback from "@/pages/AuthCallback";
const Dashboard = lazyPage(() => import("@/pages/Dashboard"));
const CardBuilderPage = lazyPage(() => import("@/pages/CardBuilderPage"));
const ServiceOrderPage = lazyPage(() => import("@/pages/service/ServiceOrderPage"));
const ServicePaymentReturnPage = lazyPage(() => import("@/pages/service/ServicePaymentReturnPage"));
const ServiceReviewPage = lazyPage(() => import("@/pages/service/ServiceReviewPage"));
const AdminOrdersPage = lazyPage(() => import("@/pages/service/AdminOrdersPage"));
const AdminOrderDetailPage = lazyPage(() => import("@/pages/service/AdminOrderDetailPage"));
const ViewCardPage = lazyPage(() => import("@/pages/ViewCardPage"));
const QRCodePage = lazyPage(() => import("@/pages/QRCodePage"));
const CardTransferPage = lazyPage(() => import("@/pages/CardTransferPage"));
const TransferReceivePage = lazyPage(() => import("@/pages/TransferReceivePage"));
const ReceivedCardsPage = lazyPage(() => import("@/pages/ReceivedCardsPage"));
const ActivateNFCPage = lazyPage(() => import("@/pages/ActivateNFCPage"));
const NFCWritePage = lazyPage(() => import("@/pages/NFCWritePage"));
const NFCRedirectPage = lazyPage(() => import("@/pages/NFCRedirectPage"));
const NFCManagerPage = lazyPage(() => import("@/pages/NFCManagerPage"));
const PiupManagerPage = lazyPage(() => import("@/pages/PiupManagerPage"));
const ContactPage = lazyPage(() => import("@/pages/ContactPage"));
const HelpPage = lazyPage(() => import("@/pages/HelpPage"));
const PricingPage = lazyPage(() => import("@/pages/PricingPage"));
const ComposePage = lazyPage(() => import("@/pages/ComposePage"));
const PostDetailPage = lazyPage(() => import("@/pages/PostDetailPage"));
const SoundPage = lazyPage(() => import("@/pages/SoundPage"));
const MapPage = lazyPage(() => import("@/pages/MapPage"));
const StorePage = lazyPage(() => import("@/pages/StorePage"));
const ChatPage = lazyPage(() => import("@/pages/ChatPage"));
const UserProfilePage = lazyPage(() => import("@/pages/UserProfilePage"));
const MyProfilePage = lazyPage(() => import("@/pages/MyProfilePage"));
const PointsPage = lazyPage(() => import("@/pages/PointsPage"));
const BrunoWebsite = lazyPage(() => import("@/pages/BrunoWebsite"));
const MarketplacePage = lazyPage(() => import("@/pages/MarketplacePage"));
const ProductDetailPage = lazyPage(() => import("@/pages/ProductDetailPage"));
const CartPage = lazyPage(() => import("@/pages/CartPage"));
const MyProductsPage = lazyPage(() => import("@/pages/MyProductsPage"));
const NewProductPage = lazyPage(() => import("@/pages/NewProductPage"));
const NotificationSettingsPage = lazyPage(() => import("@/pages/NotificationSettingsPage"));
const AnalyticsPage = lazyPage(() => import("@/pages/AnalyticsPage"));
const BrunoCameraPage = lazyPage(() => import("@/pages/BrunoCameraPage"));
const LiveSummaryPage = lazyPage(() => import("@/pages/LiveSummaryPage"));
const PrivacyPolicyPage = lazyPage(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazyPage(() => import("@/pages/TermsOfServicePage"));
const DeleteAccountPage = lazyPage(() => import("@/pages/DeleteAccountPage"));
const CookiePolicyPage = lazyPage(() => import("@/pages/CookiePolicyPage"));
const LegalHubPage = lazyPage(() => import("@/pages/LegalHubPage"));
const MarketplacePiupPage = lazyPage(() => import("@/pages/MarketplacePiupPage"));
const ForgotPasswordPage = lazyPage(() => import("@/pages/PasswordRecoveryPages").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazyPage(() => import("@/pages/PasswordRecoveryPages").then((m) => ({ default: m.ResetPasswordPage })));
const AdminPiupPage = lazyPage(() => import("@/pages/AdminPiupPage"));
const AdminPerformancePage = lazyPage(() => import("@/pages/AdminPerformancePage"));
const CommunityGuidelinesPage = lazyPage(() => import("@/pages/CommunityGuidelinesPage"));
const DataRightsPage = lazyPage(() => import("@/pages/DataRightsPage"));
const LivesListPage = lazyPage(() => import("@/pages/LivesListPage"));
const LiveViewerPage = lazyPage(() => import("@/pages/LiveViewerPage"));
const StartLivePage = lazyPage(() => import("@/pages/StartLivePage"));
import ReelsPage from "@/pages/ReelsPage";
const MonetizationPage = lazyPage(() => import("@/pages/MonetizationPage"));
const AlbumsPage = lazyPage(() => import("@/pages/AlbumsPage"));
const CardAnalyticsPage = lazyPage(() => import("@/pages/CardAnalyticsPage"));
const PremiumPage = lazyPage(() => import("@/pages/PremiumPage"));
const PaymentResultPage = lazyPage(() => import("@/pages/PaymentResultPage"));
const MyEarningsPage = lazyPage(() => import("@/pages/MyEarningsPage"));
const MyPurchasesPage = lazyPage(() => import("@/pages/MyPurchasesPage"));
const AdminReportsPage = lazyPage(() => import("@/pages/AdminReportsPage"));
const AdminUserModerationPage = lazyPage(() => import("@/pages/AdminUserModerationPage"));
const SearchPage = lazyPage(() => import("@/pages/SearchPage"));
const SeriesPage = lazyPage(() => import("@/pages/SeriesPage"));
const CardExamplesPage = lazyPage(() => import("@/pages/CardExamplesPage"));
const CardExampleViewerPage = lazyPage(() => import("@/pages/CardExampleViewerPage"));
const CouponLandingPage = lazyPage(() => import("@/pages/CouponLandingPage"));
const AdminMoneyPage = lazyPage(() => import("@/pages/AdminMoneyPage"));
const HashtagPage = lazyPage(() => import("@/pages/HashtagPage"));
const UsernameRedirect = lazyPage(() => import("@/pages/UsernameRedirect"));
const SavedPostsPage = lazyPage(() => import("@/pages/SavedPostsPage"));
const SettingsPage = lazyPage(() => import("@/pages/SettingsPage"));
const PartnerDashboardPage = lazyPage(() => import("@/pages/PartnerDashboardPage"));
const BrunoUIKitPage = lazyPage(() => import("@/pages/BrunoUIKitPage"));
const WelcomePage = lazyPage(() => import("@/pages/WelcomePage"));
const EditProfilePage = lazyPage(() => import("@/pages/EditProfilePage"));
const ChangePasswordPage = lazyPage(() => import("@/pages/ChangePasswordPage"));
const BlockedUsersPage = lazyPage(() => import("@/pages/BlockedUsersPage"));
const DevicesPage = lazyPage(() => import("@/pages/DevicesPage"));
const NotificationsPage = lazyPage(() => import("@/pages/NotificationsPage"));

// Sincroniza el color de acento guardado en la cuenta (entre dispositivos) al iniciar sesión.
function AccentSync() {
  const { token } = useAuth();
  const { setAccent } = useTheme();
  React.useEffect(() => {
    if (!token) return;
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/settings/preferences`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.data?.accent_color) setAccent(r.data.accent_color); }).catch(() => {});
  }, [token, setAccent]);
  return null;
}

function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment (not query params) for session_id
  // This runs synchronously during render to prevent race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Suspense fallback={<BrunoLoader />}>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/reels" replace />} />
      <Route path="/feed" element={<Navigate to="/reels" replace />} />
      <Route path="/compose" element={<ProtectedRoute><ComposePage /></ProtectedRoute>} />
      <Route path="/post/:postId" element={<PostDetailPage />} />
      <Route path="/sound/:postId" element={<SoundPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/website" element={<BrunoWebsite />} />
      <Route path="/servicios/tarjeta-bruno" element={<ServiceRedirect />} />
      <Route path="/pedido/revisar/:token" element={<ServiceReviewPage />} />
      <Route path="/pedido/:orderId/pago" element={<ServicePaymentReturnPage />} />
      <Route path="/pedido/:orderId" element={<ServiceOrderPage />} />
      <Route path="/admin/pedidos" element={<ProtectedRoute><AdminOrdersPage /></ProtectedRoute>} />
      <Route path="/admin/pedidos/:orderId" element={<ProtectedRoute><AdminOrderDetailPage /></ProtectedRoute>} />
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
      <Route path="/cupon/:couponId" element={<CouponLandingPage />} />
      <Route path="/purchases" element={<ProtectedRoute><MyPurchasesPage /></ProtectedRoute>} />
      <Route path="/t/:token" element={<TransferReceivePage />} />
      <Route path="/wallet" element={<ProtectedRoute><ReceivedCardsPage /></ProtectedRoute>} />
      <Route path="/cards/:cardId/transfer" element={<ProtectedRoute><CardTransferPage /></ProtectedRoute>} />
      <Route path="/n/:nfcId" element={<NFCRedirectPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/marketplace/piup" element={<MarketplacePiupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/marketplace/:productId" element={<ProductDetailPage />} />
      <Route path="/profile/:userId" element={<UserProfilePage />} />
      <Route path="/hashtag/:tag" element={<HashtagPage />} />
      <Route path="/u/:username" element={<UsernameRedirect />} />
      
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
      <Route path="/cards/examples" element={<CardExamplesPage />} />
      <Route path="/cards/examples/:type" element={<CardExampleViewerPage />} />
      <Route path="/cards/new" element={<ProtectedRoute><CardBuilderPage /></ProtectedRoute>} />
      <Route path="/cards/:cardId/edit" element={<ProtectedRoute><CardBuilderPage /></ProtectedRoute>} />
      <Route path="/cards/:cardId/qr" element={<ProtectedRoute><QRCodePage /></ProtectedRoute>} />
      <Route path="/nfc/activate" element={<ProtectedRoute><ActivateNFCPage /></ProtectedRoute>} />
      <Route path="/nfc/manage" element={<ProtectedRoute><NFCManagerPage /></ProtectedRoute>} />
      <Route path="/piup" element={<ProtectedRoute><PiupManagerPage /></ProtectedRoute>} />
      <Route path="/piup/:tab" element={<ProtectedRoute><PiupManagerPage /></ProtectedRoute>} />
      <Route path="/nfc/write" element={<ProtectedRoute><NFCWritePage /></ProtectedRoute>} />
      <Route path="/settings/delete-account" element={<ProtectedRoute><DeleteAccountPage /></ProtectedRoute>} />
      <Route path="/monetization" element={<ProtectedRoute><MonetizationPage /></ProtectedRoute>} />
      <Route path="/albums" element={<ProtectedRoute><AlbumsPage /></ProtectedRoute>} />
      <Route path="/saved" element={<ProtectedRoute><SavedPostsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
      <Route path="/partner-dashboard" element={<ProtectedRoute><PartnerDashboardPage /></ProtectedRoute>} />
      <Route path="/payment/success" element={<ProtectedRoute><PaymentResultPage /></ProtectedRoute>} />
      <Route path="/payment/cancel" element={<ProtectedRoute><PaymentResultPage cancelled /></ProtectedRoute>} />
      <Route path="/earnings" element={<ProtectedRoute><MyEarningsPage /></ProtectedRoute>} />
      <Route path="/admin/money" element={<ProtectedRoute><AdminMoneyPage /></ProtectedRoute>} />
      <Route path="/admin/piup" element={<ProtectedRoute><AdminPiupPage /></ProtectedRoute>} />
      <Route path="/admin/rendimiento" element={<ProtectedRoute><AdminPerformancePage /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute><AdminReportsPage /></ProtectedRoute>} />
      <Route path="/admin/users/:userId/moderation" element={<ProtectedRoute><AdminUserModerationPage /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUserModerationPage /></ProtectedRoute>} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/reels" element={<ReelsPage />} />
      <Route path="/video/:videoId" element={<ReelsPage />} />
      <Route path="/series/:seriesId" element={<SeriesPage />} />
      <Route path="/profile/:userId/reels" element={<ReelsPage />} />
      <Route path="/lives" element={<ReelsPage />} />
      <Route path="/lives/start" element={<ProtectedRoute><StartLivePage /></ProtectedRoute>} />
      <Route path="/lives/:liveId/summary" element={<ProtectedRoute><LiveSummaryPage /></ProtectedRoute>} />
      <Route path="/lives/:liveId" element={<LiveViewerPage />} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/reels" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <I18nProvider>
          <NotificationProvider>
            <BrowserRouter>
              <NavScrollProvider>
              <TourProvider>
                <BrunoCameraProvider>
                <RealtimeNotificationProvider>
                <StoryActivityProvider>
                <AppRouter />
                <NativeBootstrap />
                <FloatingBubbles />
                <AccountScoped />
                <PictureInPicture />
                <CameraFloatingButton />
                <MobileBottomNav />
                <UploadChip />
                <FloatingBackButton />
                <TourOverlay />
                <KeyboardViewportManager />
                <CardReminderBanner />
                <PWAInstallPrompt />
                <Toaster
                  position="top-center"
                  expand
                  visibleToasts={5}
                  toastOptions={{
                    unstyled: true,
                    classNames: { toast: "w-full" },
                  }}
                />
                </StoryActivityProvider>
                </RealtimeNotificationProvider>
                </BrunoCameraProvider>
              </TourProvider>
              </NavScrollProvider>
            </BrowserRouter>
          </NotificationProvider>
          </I18nProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
