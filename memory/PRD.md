# BRUNO Social Network - PRD

## Original Problem Statement
Build a comprehensive social networking platform called "BRUNO" with digital business cards, social feeds, stories, marketplace, and advanced social features.

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Framer Motion
- **Backend:** FastAPI + MongoDB (modular routers)
- **Auth:** JWT + Google OAuth (Emergent-managed) + AES-GCM encrypted token storage
- **Storage:** Cloudinary, **AI:** OpenAI GPT-5.2 (Emergent LLM Key)
- **Maps:** Leaflet, **Payments:** Stripe, **External Sales:** DEAL (Hybrid API/Webhook)

## Implemented Features

### Core Social Features (Phase 17-35)
- Posts, Feed, Stories, Reels, Live Streams, Chat, Maps
- Card Analytics, Stripe Payments, NFC Integration
- Floating Nav, AI Chat, Satellite Bubble System
- Persistent Sessions (30-day web, 365-day mobile)
- Story Editor, Universal Minimization, PiP, View Modes
- Premium Templates, Multi-Locations, Drag-to-Reorder


### Phase 41: Onboarding /welcome + P1/P2 UI System rollout (2026-05-17)
**New page `/welcome`** — 4-step interactive onboarding showcasing the Bruno UI:
- Step 1 Intro: mascot animation + Native-Ready chip
- Step 2 Features: 4 feature chips + 2 ExpandableCards (cards & DEAL)
- Step 3 Interact: 4 demo buttons triggering brunoToast variants (follow/publish/like/loading)
- Step 4 Ready: success state + CTAs to "Create card" or "Explore"
- Skip flow with BrunoModal confirmation
- Persisted via localStorage `bruno_welcome_seen`

**P1: Toast migration** — `ActivateNFCPage` and `NFCManagerPage` now use `brunoToast` (drop-in via `as toast` import alias, no call-site changes).

**P2: Dashboard delete confirm** — replaced native `window.confirm` with `<BrunoModal variant="danger">` including loading state, branded design, and follow-up `brunoToast.success/error` for the result. No more raw `alert()`.

**Toaster mounted** in `App.js` (was missing — toasts didn't render before this phase).



### Phase 39: Mobile-Native API Surface (2026-05-17)
**Goal:** Backend ready for React Native / Flutter consumption.

**Push Notifications (FCM/APNs/Expo)**
- POST /api/mobile/devices/register — store device tokens with platform metadata (idempotent by user+token)
- GET /api/mobile/devices — list active devices (token redacted)
- DELETE /api/mobile/devices/{id} — soft-unregister, flips push flag when no devices remain
- Collection: mobile_devices

**Biometric Auth (FaceID / Fingerprint)**
- Public-key challenge/response on top of JWT. Supports ed25519, ecdsa-p256, rsa-2048.
- POST /api/mobile/biometric/enroll — register device public key (authenticated)
- POST /api/mobile/biometric/challenge — request one-time challenge (public, 120s TTL)
- POST /api/mobile/biometric/verify — sign challenge → returns access + refresh token pair
- POST /api/mobile/auth/refresh — refresh-token rotation (old token revoked)
- POST /api/mobile/auth/logout — revoke refresh token
- GET / DELETE /api/mobile/biometric/credentials — list/revoke
- Collections: biometric_credentials, biometric_challenges, refresh_tokens

**Offline Sync**
- GET /api/mobile/sync/manifest — per-collection last_modified + count
- GET /api/mobile/sync/cards|store|deal-orders — delta sync with `since` + cursor pagination
- GET /api/mobile/sync/profile — user snapshot
- GET /api/mobile/sync/bootstrap — one-shot hydration for first install
- POST /api/mobile/sync/push — apply offline changes (create/update/delete) with last-write-wins
- GET /api/mobile/config — public app config (VAPID key, feature flags, endpoint catalog)

**DEAL Push Notifications Wiring (Phase 38 P0 → completed)**
- Webhook /api/deal/webhook now fires `_notify_partner_commission` and `_notify_buyer_payment`
- Partners get instant push on commission earned; buyers get paid/failed/refunded notifications

**Tests:** /app/backend/tests/test_mobile_native.py — 21/21 passing (push registration, biometric flow with Ed25519 signatures, replay protection, refresh rotation, delta sync, offline push).


### Phase 37: DEAL Integration (2026-05-17)
- Outbound: POST /api/deal/send-order (cliente, producto, precio, partner_id, referral_code, origen: Bruno)
- Inbound: POST /api/deal/webhook (HMAC-SHA256 verified, updates status, registers commission, activates service)
- Frontend: Comprar/Solicitar Servicio buttons, DEAL toggle on product creation

### Phase 38: Partner Dashboard + Full Refactoring (2026-05-17)

**New Feature: DEAL Partner Dashboard**
- Page at /partner-dashboard with summary stats (total earned, orders, volume, conversion rate)
- Monthly revenue chart, top products, recent commissions, recent orders
- Backend: GET /api/deal/partner/dashboard aggregates from deal_orders + deal_commissions

**P1: Enhanced Push Notifications for Mobile**
- NotificationPayload extended: image, actions (max 2), vibrate patterns, renotify, silent, requireInteraction
- Service Worker v6: handles rich notifications with action buttons (reply, dismiss, accept call)
- Context-aware defaults: messages get renotify=true, calls get requireInteraction=true

**P2: server.py Refactoring (5417 → 4311 lines, -20%)**
- Extracted 1215 lines to routers/posts_feed.py (posts, feed, chats, users, notifications, settings)
- Models duplicated in router to avoid circular imports
- All endpoints verified working post-extraction

**P2: CreateCardPage.jsx Breakdown (1666 → 1294 lines, -22%)**
- Extracted CurriculumFields.jsx (226 lines): experience, education, skills, languages, documents, references

**P2: Frontend Security - Encrypted Token Storage**
- Created secureStorage.js: AES-GCM encryption via Web Crypto API
- AuthContext.js rewritten: tokens encrypted before localStorage, auto-migrates old plaintext tokens
- Fallback to in-memory storage if Web Crypto unavailable

**P2: Hook Dependencies Fixed**
- ViewCardPage.jsx: fetchCard wrapped in useCallback
- StorePage.jsx: fetchProducts + fetchUserData wrapped in useCallback
- FeedPage.jsx: verified correct useCallback pattern

**P2: Array Index Keys Fixed (83/86)**
- Fixed across EditCardPage, ViewCardPage, FeedPage, StorePage, HelpPage, PricingPage, NFCManagerPage, SocialLinkSelector, MarketplacePage, and 15+ other files
- Remaining 3 are skeleton loading indicators (acceptable use)

**P2: Backend Complexity Refactored**
- analytics.py: get_card_analytics split into _compute_view_metrics helper
- deal_integration.py: webhook split into _update_order_status, _register_commission, _activate_product
- moderation.py: Fixed mutable default argument
- lives.py: Fixed 4 bare excepts → Exception
- notifications.py: Removed unused variable

**Console Statements Cleaned: 151 → 0**
- All console.log/error/warn/info removed from production code across 46 files

**Testing: 100% pass rate (iterations 52-55)**

## Key API Endpoints
- POST /api/deal/send-order, POST /api/deal/webhook
- GET /api/deal/partner/dashboard, GET /api/deal/orders, GET /api/deal/commissions
- GET /api/posts, GET /api/feed/for-you (now in posts_feed.py)
- GET /api/chats, POST /api/chats/{id}/messages (now in posts_feed.py)
- PUT /api/cards/reorder, POST /api/auth/login, POST /api/auth/refresh

## Environment Variables
```
DEAL_API_URL=         # DEAL API base URL (placeholder)
DEAL_API_KEY=         # API key for DEAL auth (placeholder)
DEAL_WEBHOOK_SECRET=  # HMAC-SHA256 shared secret
```

## Remaining Backlog
- server.py still 4311 lines — extract NFC (9 endpoints), uploads (7), subscriptions (5) to further reduce
- Type hints coverage (20.2% → target 60%)
- ProfileSpecificFields.jsx (>1000 lines) needs breakdown

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet
- Emergent Google Auth, DEAL App (Hybrid API/Webhook)
