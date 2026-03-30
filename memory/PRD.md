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

### Phase 25 (Current): Upsell + Refactoring
- **Premium Upsell Banner** in Card Analytics: Gold "Desbloquea Analytics Pro" banner with blurred locked features preview, $4.99/mes CTA linking to /premium. Only shows for free users.
- **Frontend Refactoring:** Extracted FeedSidebar.jsx from FeedPage.jsx (~980→~800 lines). Sidebar now includes Analytics and Premium quick links.
- **Premium Page** at /premium: 3 pricing cards, feature grid, payment history, Stripe checkout integration.

## Key API Endpoints

### Payments
- GET /api/payments/packages, POST /api/payments/checkout
- GET /api/payments/subscription, GET /api/payments/status/{session_id}

### Card Analytics
- POST /api/analytics/cards/{id}/view, GET /api/analytics/cards/{id}, GET /api/analytics/overview

### Social
- POST /api/social/polls, POST /api/social/polls/{id}/vote
- GET /api/users/mention-search?q=
- POST /api/stories/ (supports poll_id)

## Prioritized Backlog

### P2: Backend Refactoring
- server.py still ~5740 lines with ~112 endpoints
- Move social endpoints to routers/social.py (follows, blocks, reactions, bookmarks, reposts)
- Move post endpoints to routers/posts.py
- Move feed endpoints to routers/feed.py

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
