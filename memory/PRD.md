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
- Trending hashtags, suggested users, bookmarks, multi-emoji reactions, reposts, polls
- "For You" algorithmic feed, centralized settings
- Card overflow fixes, legacy route cleanup

### Phase 22: Advanced Social Features
- Polls in Stories (UI create/vote), Animated reactions (framer-motion)
- @User mentions (clickable links, autocomplete, notifications)
- Push notification VAPID key fix

### Phase 23: Card Analytics + Chat Modernization
- Card Analytics: track views, devices, sources, viewers
- Chat UI modernized, all usernames as clickable profile links

### Phase 24: Stripe + Bug Fixes
- Stripe: 3 packages ($4.99 analytics monthly, $39.99 yearly, $9.99 premium)
- Full checkout flow with Stripe sessions
- Card edit button, image overflow, responsiveness fixes
- FloatingChatBubble profile links

### Phase 25: Upsell + Refactoring
- Premium Upsell Banner in Card Analytics
- Frontend Refactoring: Extracted FeedSidebar.jsx
- Premium Page at /premium: 3 pricing cards, Stripe checkout

### Phase 26 (Current): P0 Bug Fixes + Backend Refactoring (2026-03-30)
- **Stripe Checkout Redirect**: Verified working - redirects to checkout.stripe.com correctly
- **Card View Full Width**: Removed max-w-5xl constraint, cards now span full width on 1920px+ screens
- **BeaconsStyleCard Bubble Layout**: Redesigned with proper bubble distribution (header bubble, contact bubbles, social links, job details, gallery)
- **ViewCardPage Responsive**: Bubble grid layout (1/2/3 columns) for contact, social, gallery sections
- **Backend Refactoring**: Moved 17 social endpoints from server.py to routers/social.py (~557 lines removed)
  - Follow/unfollow, Block/unblock, Followers/Following lists
  - Bookmarks, Reactions (multi-emoji), Reposts
  - Suggested Users, Trending, Hashtags, Explore
  - Polls (create, vote, get)
  - Legacy /profile/{user_id}/follow route maintained
- **server.py reduced from 5740 → 5183 lines**
- **NFC Instant Redirect Fix** (2026-03-30):
  - Created backend direct redirect endpoint `GET /api/nfc/go/{nfcId}` (HTTP 302)
  - NFCWritePage now writes backend redirect URL to NFC tags (bypasses SPA load entirely)
  - NFCRedirectPage uses React Router `navigate()` instead of `window.location.href` + removed 500ms delay
  - Service Worker updated to v5 with improved navigation handling
- **NFC 3-Mode Activation Page** (2026-03-30):
  - Mode 1: Producto BRUNO con ID (for purchased physical products)
  - Mode 2: Producto externo con NFC (select card + write to any NFC tag via Web NFC API)
  - Mode 3: Link externo (generate shareable URL for external NFC tools)
  - Re-encoding feature for existing NFC tags with updated URLs
  - Backend: /api/nfc/my-cards returns redirect_url + card_title
  - Backend: /api/nfc/update-card endpoint for changing linked card

### Phase 27: Block 1 Bug Fixes (2026-04-05)
- Changed "Título" to "Nombre" (ES) / "Name" (EN) in card editor
- Fixed explorer card banner overflow (isolate + overflow-hidden + rounded-t-lg + ring instead of border)
- Repositioned chat bubble above navigation bar (bottom-20 z-[9990])
- Removed camera floating button (was hidden behind nav)
- Card edit now navigates to /c/{cardId} instead of /my-profile
- Card create now navigates to /c/{newCardId} instead of /my-profile

### Phase 28: Block 2 - UX & Navigation (2026-04-05)
- **Floating bubble navigation bar**: Pill-shaped floating nav with backdrop blur, auto-minimizes on scroll down, expands on scroll up, manual minimize/expand buttons
- **Chat scroll-hide**: FloatingChatBubble hides on scroll down, shows on scroll up, hidden on /camera page
- **Bubble animations system**: CSS animation classes (bubble-stagger, bubble-press, bubble-card, bubble-from-left/right, bubble-float) for smooth app transitions
- **Post avatar story ring**: Gradient ring (orange-pink-purple) on post avatars indicating story capability, separate click handler for avatar vs profile name
- **Explorer card overflow fixed permanently**: Changed from `border border-white/40` to `ring-1 ring-white/40` preventing transparent border image bleedthrough
- **Fixed global overflow CSS**: Scoped `overflow: visible !important` to form containers only instead of all cards

## Key API Endpoints

### Payments
- GET /api/payments/packages, POST /api/payments/checkout
- GET /api/payments/subscription, GET /api/payments/status/{session_id}

### Card Analytics
- POST /api/analytics/cards/{id}/view, GET /api/analytics/cards/{id}, GET /api/analytics/overview

### Social (routers/social.py)
- POST /api/users/{user_id}/follow, POST /api/users/{user_id}/block
- GET /api/users/{user_id}/followers, GET /api/users/{user_id}/following
- GET /api/users/me/blocked
- POST /api/posts/{post_id}/bookmark, GET /api/posts/saved/list
- POST /api/posts/{post_id}/react, GET /api/posts/{post_id}/reactions
- POST /api/posts/{post_id}/repost
- GET /api/social/suggested, GET /api/social/trending
- GET /api/social/hashtag/{tag}, GET /api/social/explore
- POST /api/social/polls, POST /api/social/polls/{id}/vote, GET /api/social/polls/{id}

## Prioritized Backlog

### P1: Web/Native Sync
- Ensure app works in WebViews (no web-only APIs)

### P2: Performance
- Fix N+1 query patterns (use $in for batch queries in followers/following/blocked)
- Add pagination to cards and albums endpoints

### P2: Frontend Refactoring
- MyProfilePage.jsx (~779 lines) - extract tabs, follower modal
- CreateCardPage.jsx / EditCardPage.jsx (~1078 lines each) - extract shared form components

### P3: Advanced Features
- ML collaborative filtering for "For You" feed
- WebSocket real-time notifications
- Export analytics data as CSV/PDF
- Email campaigns for engagement

## Test Credentials
- Email: newtest@bruno.com
- Password: Test1234!

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- Stripe (emergentintegrations - sk_test_emergent)
- Daily.co, Cloudinary, Leaflet, Emergent Google Auth
