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
- **Payments:** Stripe (planned)

## What's Been Implemented

### Phase 17: TikTok Camera & Cache Fix
- TikTok-style camera UI for creating content
- Service worker (sw.js v4) for Safari cache-busting

### Phase 18: Responsive Nav & Social System
- Fully responsive navigation bar (mobile/tablet/desktop)
- Follow/unfollow/block functionality

### Phase 19: Modern Social Features
- Trending hashtags with dedicated page
- Suggested users, post bookmarks, multi-emoji reactions, reposts, polls backend

### Phase 20: "For You" Feed & Settings
- Personalized algorithmic feed with recommendation engine
- Centralized settings page

### Phase 21: Card System Fixes
- Fixed UI overflow bugs on business cards
- Replaced legacy /dashboard links with /my-profile

### Phase 22 (Mar 2026): Advanced Social Features
- **Polls in Stories:** Full UI for creating polls in stories (Foto/Video + Encuesta tabs). Poll display + voting inside story viewer.
- **Animated Reactions:** Framer-motion reaction popup with spring animations and floating particles.
- **@User Mentions:** Clickable @username links everywhere. Autocomplete dropdown in post creation. Backend mention notifications.
- **Push Notifications Fix:** VAPID key from env instead of hardcoded.

### Phase 23 (Mar 2026): Card Analytics + Chat Modernization
- **Card Analytics (Premium Feature):**
  - Backend router: `/api/analytics/cards/{id}/view` (track), `/api/analytics/cards/{id}` (detail), `/api/analytics/overview`
  - Frontend: CardAnalyticsPage with overview stats, daily views bar chart, device breakdown, traffic sources, recent viewers
  - Automatic view tracking on ViewCardPage load
- **Chat Modernization:**
  - ALL user names/avatars in chat are clickable `<Link>` hyperlinks to user profiles
  - Modern UI: rounded search, clean message bubbles, backdrop blur header, tilted send icon empty state
  - Chat search filter to filter conversations by name
  - @mentions in chat messages are clickable links
- **Global Hyperlinks:** All usernames across the app (feed sidebar, posts, comments, chat) are now clickable profile links

## Key API Endpoints

### Card Analytics
- POST /api/analytics/cards/{card_id}/view (public, tracks device/source)
- GET /api/analytics/cards/{card_id}?days=30 (owner only, detailed metrics)
- GET /api/analytics/overview (all user cards summary)

### Social Graph
- POST /api/users/{user_id}/block, /unblock
- GET /api/users/followers, /following

### Content Interaction
- POST /api/posts/{post_id}/bookmark, /repost, /react, /like
- GET /api/users/mention-search?q= (autocomplete)

### Polls
- POST /api/social/polls, GET /api/social/polls/{id}, POST /api/social/polls/{id}/vote

### Stories
- POST /api/stories/ (supports poll_id)
- GET /api/stories/feed

## Prioritized Backlog

### P2: Stripe Monetization
- Integrate Stripe for premium features (card analytics)
- Payment flow for subscriptions

### P2: Backend Refactoring
- Migrate endpoints from server.py (5700+ lines) into modular routers
- social.py router exists but underutilized

### P2: Frontend Component Refactoring
- Break down FeedPage.jsx (980+ lines)
- Break down MyProfilePage.jsx, CreateCardPage.jsx

## DB Schema
- **card_analytics:** id, card_id, card_owner_id, viewer_id, source_url, user_agent, device, created_at
- **polls:** id, creator_id, question, options[{text, votes}], total_votes, voters[]
- **stories:** id, user_id, media_url, media_type, caption, poll_id, visibility, expires_at
- **reactions:** id, user_id, target_id, reaction_type
- **notifications:** id, user_id, actor_id, type, target_id, message

## Test Credentials
- Email: newtest@bruno.com
- Password: Test1234!
- Test Card ID: d16c2745-e082-4b22-84f8-749beb5e33fd

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- Daily.co (Video Calls)
- Cloudinary (Image Storage)
- Stripe (Payments - planned)
- Leaflet (Maps)
- Emergent Google Auth
