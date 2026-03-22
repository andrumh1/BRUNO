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
- Suggested users ("People you may know")
- Post bookmarks/saving
- Multi-emoji reactions
- Reposting functionality
- Polls backend API

### Phase 20: "For You" Feed & Settings
- Personalized algorithmic feed with recommendation engine
- Centralized settings page

### Phase 21: Card System Fixes
- Fixed UI overflow bugs on business cards
- Replaced legacy /dashboard links with /my-profile

### Phase 22 (Current - Mar 2026): Advanced Social Features
- **Polls in Stories:** Full UI for creating polls in story creation modal (Foto/Video + Encuesta tabs). Poll display + voting inside story viewer with animated progress bars.
- **Animated Reactions:** Framer-motion powered reaction popup with spring animations, floating particle effects on like/react, and animated bookmark toggle.
- **@User Mentions:** Clickable @username links in posts and comments (linking to /profile/username). @mention autocomplete dropdown in post creation with real-time user search via /api/users/mention-search. Backend processes mentions and sends push notifications to mentioned users.
- **Push Notifications Fix:** Fixed VAPID key mismatch in NotificationContext.js to use REACT_APP_VAPID_PUBLIC_KEY from environment instead of hardcoded key. VAPID keys now match between frontend and backend.

## Key API Endpoints

### Social Graph
- POST /api/users/{user_id}/block, /unblock
- GET /api/users/followers, /following

### Content Interaction
- POST /api/posts/{post_id}/bookmark, /repost, /react, /like
- POST /api/posts/{post_id}/comments

### Discovery & Feeds
- GET /api/social/suggested, /trending, /explore
- GET /api/posts/saved, /api/hashtags/{tag}
- GET /api/social/feed/for-you
- GET /api/feed/for-you

### Polls
- POST /api/social/polls (create)
- GET /api/social/polls/{poll_id} (view)
- POST /api/social/polls/{poll_id}/vote (vote)

### Mentions
- GET /api/users/mention-search?q= (autocomplete)

### Stories
- POST /api/stories/ (create, supports poll_id)
- GET /api/stories/feed
- POST /api/stories/{id}/view

### Push Notifications
- POST /api/push/subscribe
- DELETE /api/push/unsubscribe
- POST /api/push/test

## DB Schema
- **users:** id, email, name, role, subscription_tier, preferences, blocked_by
- **posts:** id, user_id, content, media, hashtags, mentions, likes_count, comments_count
- **polls:** id, creator_id, question, options[{text, votes}], total_votes, voters[]
- **stories:** id, user_id, media_url, media_type, caption, poll_id, visibility, expires_at
- **reactions:** id, user_id, target_id, target_type, reaction_type
- **bookmarks:** user_id, post_id
- **notifications:** id, user_id, actor_id, type, target_id, message
- **push_subscriptions:** id, user_id, endpoint, keys

## Prioritized Backlog

### P1: Card Analytics Feature
- Backend: Endpoints to track card views (who, when, source URL)
- Frontend: CardAnalyticsPage.jsx with charts and metrics

### P2: Stripe Monetization
- Integrate Stripe for premium features (card analytics)
- Payment flow for subscriptions

### P2: Backend Refactoring
- Migrate endpoints from server.py (5700+ lines) into modular routers
- social.py router exists but is underutilized
- Group by domain: polls, bookmarks, reactions, mentions, feed

### P2: Frontend Component Refactoring
- Break down FeedPage.jsx (980+ lines)
- Break down MyProfilePage.jsx
- Break down CreateCardPage.jsx / EditCardPage.jsx

## Test Credentials
- Email: newtest@bruno.com
- Password: Test1234!

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- Daily.co (Video Calls)
- Cloudinary (Image Storage)
- Stripe (Payments - planned)
- Leaflet (Maps)
- Emergent Google Auth
