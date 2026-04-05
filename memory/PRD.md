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

### Phase 17-21: Foundation
- TikTok camera, Safari cache fix, responsive nav, follow/block system
- Trending hashtags, suggested users, bookmarks, multi-emoji reactions, reposts, polls
- "For You" algorithmic feed, centralized settings

### Phase 22: Advanced Social Features
- Polls in Stories, animated reactions, @User mentions, push notifications

### Phase 23: Card Analytics + Chat Modernization
- Card Analytics (views, devices, sources), Chat UI modernized

### Phase 24: Stripe + Bug Fixes
- Stripe: 3 packages, full checkout flow, card fixes

### Phase 25: Upsell + Refactoring
- Premium Upsell Banner, FeedSidebar.jsx extraction, Premium Page

### Phase 26: P0 Bug Fixes + Backend Refactoring (2026-03-30)
- Stripe Checkout fix, Card View Full Width, BeaconsStyleCard redesign
- Backend: 17 social endpoints → routers/social.py
- NFC Instant Redirect (HTTP 302) + 3-Mode Activation

### Phase 27-28: Blocks 1-2 (2026-04-05)
- UI fixes, floating bubble nav bar, scroll-hide, bubble animations, story rings

### Phase 29: Block 4 - AI Chat + Messenger Attachments (2026-04-05)
- Bruno AI: action buttons, card previews, file attachments
- Backend: `/api/upload/chat-file` endpoint
- ChatAttachmentMenu: Messenger-style bottom drawer (6 options)
- ChatPage upgraded to bottom drawer attachments
- FloatingChatBubble: full attachment support (images, files, audio recording)

### Phase 30: Satellite Bubble Design + Touch Fixes (2026-04-05)
- **NavScrollContext**: Shared context for synchronized minimize/expand across nav bar and chat bubbles
- **Satellite Bubble Layout**: AI bubble (violet) docks to LEFT of nav bar, Chat bubble (orange) docks to RIGHT
- **Synchronized Minimization**: All 3 elements (AI bubble, nav bar, Chat bubble) minimize/expand together on scroll
- **Circular Design**: Bubbles are perfectly circular with glow effects and ring indicators when active
- **Dynamic Notification Badges**: AI bubble shows "IA" badge, Chat bubble shows unread message count
- **Camera-only Hide**: Bubbles only hidden on /camera page, visible everywhere else
- **BubbleSelect Touch Fix**: Changed from onTouchStart to onTouchEnd for option selection (prevents premature selection during scroll)
- **Touch-Manipulation CSS**: Added global touch-manipulation and -webkit-tap-highlight-color styles for all interactive elements
- **iOS Zoom Prevention**: Native `<select>` elements now have min-height 44px and font-size 16px
- **Smart Dropdown Positioning**: BubbleSelect now detects available space and drops up when near bottom of viewport

## Key API Endpoints

### Payments
- GET /api/payments/packages, POST /api/payments/checkout
- GET /api/payments/subscription

### Card Analytics
- POST /api/analytics/cards/{id}/view, GET /api/analytics/cards/{id}

### Social (routers/social.py)
- POST /api/users/{user_id}/follow, POST /api/users/{user_id}/block
- POST /api/posts/{post_id}/bookmark, POST /api/posts/{post_id}/react
- POST /api/social/polls, POST /api/social/polls/{id}/vote

### AI Chat
- POST /api/ai/chat, GET /api/ai/history, DELETE /api/ai/history

### Uploads
- POST /api/upload/image, /api/upload/audio, /api/upload/file, /api/upload/avatar
- POST /api/upload/chat-file

## Prioritized Backlog

### P1: User Feedback Items (from 20-point list)
- Point #2: Multiple addresses/locations for business cards (map pins)
- Point #15: Instagram/TikTok-style Story Editor (stickers, text overlay)
- Point #6: New premium card templates (Formal, Minimalist, Full Image, Animated)
- Point #13: Reels as first screen on profiles
- Point #17: Advanced profile editor with public/private album folders

### P2: Performance
- Fix N+1 query patterns (use $in for batch queries)
- Add pagination to cards and albums endpoints
- Push notification improvements (#18)

### P2: Refactoring
- server.py still ~5200 lines (extract auth, cards, AI chat routers)
- MyProfilePage.jsx (~779 lines)

### P3: Advanced Features
- ML collaborative filtering for "For You" feed
- WebSocket real-time notifications
- Export analytics data

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- Stripe (emergentintegrations - sk_test_emergent)
- Daily.co, Cloudinary, Leaflet, Emergent Google Auth
