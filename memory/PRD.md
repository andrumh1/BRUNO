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

### Phase 26: P0 Bug Fixes + Backend Refactoring (2026-03-30)
- Stripe Checkout Redirect fixed
- Card View Full Width for 1920px+ screens
- BeaconsStyleCard Bubble Layout redesigned
- Backend Refactoring: 17 social endpoints moved to routers/social.py
- NFC Instant Redirect (HTTP 302) + 3-Mode Activation Page

### Phase 27: Block 1 Bug Fixes (2026-04-05)
- Changed "Titulo" to "Nombre" in card editor
- Fixed explorer card banner overflow
- Repositioned chat bubble above navigation bar
- Card edit/create navigation fixes

### Phase 28: Block 2 - UX & Navigation (2026-04-05)
- Floating bubble navigation bar with scroll-hide
- Chat scroll-hide on scroll
- Bubble animations system (CSS classes)
- Post avatar story ring

### Phase 29: Block 4 - AI Chat + Messenger-style Attachments (2026-04-05)
- **Bruno AI Chat Enhanced**: Action buttons [ACTION:route/search:...], card previews [CARD:...], file attachments
- **Backend**: New `/api/upload/chat-file` endpoint for chat file uploads (auto-detects image/video/raw)
- **Backend**: AI chat context enrichment with public card search results
- **ChatAttachmentMenu.jsx**: Reusable Messenger-style bottom drawer with 6 options (Camera, Gallery, Video, Document, Card, Sticker)
- **ChatPage.jsx**: Upgraded from absolute popup to full-screen bottom drawer for attachments
- **FloatingChatBubble.jsx**: Complete rewrite with attachment support (images, files, audio recording, camera capture)
- **FloatingBubbles.jsx**: AI chat with attachment upload, action buttons, card previews
- **Bug Fix**: AI chat session continuity null pointer when cards_context is None
- **Bug Fix**: Floating chat popup list items now correctly open chats (removed profile Links that intercepted clicks)

## Key API Endpoints

### Payments
- GET /api/payments/packages, POST /api/payments/checkout
- GET /api/payments/subscription, GET /api/payments/status/{session_id}

### Card Analytics
- POST /api/analytics/cards/{id}/view, GET /api/analytics/cards/{id}, GET /api/analytics/overview

### Social (routers/social.py)
- POST /api/users/{user_id}/follow, POST /api/users/{user_id}/block
- GET /api/users/{user_id}/followers, GET /api/users/{user_id}/following
- POST /api/posts/{post_id}/bookmark, GET /api/posts/saved/list
- POST /api/posts/{post_id}/react, GET /api/posts/{post_id}/reactions
- POST /api/social/polls, POST /api/social/polls/{id}/vote

### AI Chat
- POST /api/ai/chat (with card context, attachments, action buttons)
- GET /api/ai/history, DELETE /api/ai/history

### Uploads
- POST /api/upload/image, /api/upload/audio, /api/upload/file, /api/upload/avatar
- POST /api/upload/chat-file (NEW - auto-detects content type)

## Prioritized Backlog

### P1: User Feedback Items (from 20-point list)
- Point #19: Mobile touch issue in editor dropdowns
- Point #2: Multiple addresses/locations for business cards (map pins)
- Point #15: Instagram/TikTok-style Story Editor (stickers, text overlay)
- Point #6: New premium card templates (Formal, Minimalist, Full Image, Animated)
- Point #13: Reels as first screen on profiles
- Point #17: Advanced profile editor with public/private album folders

### P2: Performance
- Fix N+1 query patterns (use $in for batch queries)
- Add pagination to cards and albums endpoints
- Push notification improvements (#18)

### P2: Frontend Refactoring
- MyProfilePage.jsx (~779 lines) - extract tabs, follower modal
- CreateCardPage.jsx / EditCardPage.jsx (~1078 lines each) - extract shared form components

### P3: Advanced Features
- ML collaborative filtering for "For You" feed
- WebSocket real-time notifications
- Export analytics data

## Test Credentials
- Email: newtest@bruno.com
- Password: Test1234!

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- Stripe (emergentintegrations - sk_test_emergent)
- Daily.co, Cloudinary, Leaflet, Emergent Google Auth
