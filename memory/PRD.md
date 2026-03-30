# BRUNO Social Network - PRD

## Original Problem Statement
Build a comprehensive social networking platform called "BRUNO" with digital business cards, social feeds, stories, marketplace, and advanced social features.

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Framer Motion
- **Backend:** FastAPI + MongoDB
- **Auth:** JWT + Google OAuth (Emergent-managed)
- **Storage:** Cloudinary (images)
- **AI:** OpenAI GPT-5.2 (Emergent LLM Key)
- **Maps:** Leaflet
- **Payments:** Stripe (emergentintegrations)

## What's Been Implemented

### Phase 17-21: Foundation (Previous Sessions)
- TikTok camera, Safari cache fix, responsive nav, follow/block system
- Trending hashtags, suggested users, bookmarks, multi-emoji reactions, reposts, polls backend
- "For You" algorithmic feed, centralized settings
- Card overflow fixes, legacy route cleanup

### Phase 22 (Mar 2026): Advanced Social Features
- Polls in Stories (UI for create/vote), Animated reactions (framer-motion)
- @User mentions (clickable links, autocomplete, backend notifications)
- Push notification VAPID key fix

### Phase 23 (Mar 2026): Card Analytics + Chat Modernization
- Card Analytics premium feature (track views, devices, sources, viewers)
- Chat modernized UI (glass effects, modern bubbles, search filter)
- All usernames as clickable profile hyperlinks throughout the app

### Phase 24 (Mar 2026): Stripe + Bug Fixes
- **Stripe Monetization:**
  - 3 packages: Analytics Monthly ($4.99), Analytics Yearly ($39.99), Bruno Premium ($9.99)
  - Full checkout flow: /api/payments/checkout → Stripe checkout → /payment/success
  - Subscription management, payment history, webhook handler
  - Premium page at /premium with pricing cards
- **Bug Fixes:**
  - Card edit button navigation fixed (was /edit-card/ → now /cards/{id}/edit)
  - Card responsiveness: fully responsive for mobile/tablet/desktop/TV (sm:/md: breakpoints)
  - Image overflow: All rounded containers now have overflow-hidden (avatars, banners)
  - FloatingChatBubble: Names/avatars now are <Link> elements to user profiles

## Key API Endpoints

### Payments (Stripe)
- GET /api/payments/packages (public)
- POST /api/payments/checkout (auth - creates Stripe session)
- GET /api/payments/subscription (auth - subscription status)
- GET /api/payments/status/{session_id} (auth - poll payment)
- POST /api/payments/webhook/stripe (Stripe webhook)

### Card Analytics
- POST /api/analytics/cards/{card_id}/view
- GET /api/analytics/cards/{card_id}?days=30
- GET /api/analytics/overview

### Social/Content
- POST /api/social/polls, GET /api/social/polls/{id}, POST /api/social/polls/{id}/vote
- GET /api/users/mention-search?q=
- POST /api/stories/ (supports poll_id)

## DB Schema Additions
- **payment_transactions:** id, user_id, session_id, package_id, amount, currency, payment_status, paid_at
- **card_analytics:** id, card_id, viewer_id, device, source_url, created_at
- **users (updated):** subscription_tier, subscription_expires

## Prioritized Backlog

### P2: Backend Refactoring
- Migrate endpoints from server.py (5700+ lines) into modular routers

### P2: Frontend Component Refactoring
- Break down FeedPage.jsx (980+ lines), MyProfilePage.jsx

### P3: Advanced ML Feed
- Improve "For You" algorithm with collaborative filtering
- WebSocket real-time notifications

## Test Credentials
- Email: newtest@bruno.com
- Password: Test1234!

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- Stripe (emergentintegrations - sk_test_emergent)
- Daily.co, Cloudinary, Leaflet, Emergent Google Auth
