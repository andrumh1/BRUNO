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
