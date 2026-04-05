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

### Phase 22-25: Social + Analytics + Stripe
- Polls, animated reactions, @mentions, push notifications
- Card Analytics, modernized Chat UI, Stripe checkout, Premium page

### Phase 26: P0 Bug Fixes + Backend Refactoring (2026-03-30)
- Stripe fix, Card View Full Width, BeaconsStyleCard redesign
- Backend: 17 social endpoints → routers/social.py
- NFC Instant Redirect (HTTP 302) + 3-Mode Activation

### Phase 27-28: Blocks 1-2 (2026-04-05)
- UI fixes, floating bubble nav bar, scroll-hide, bubble animations, story rings

### Phase 29: AI Chat + Messenger Attachments (2026-04-05)
- Bruno AI: action buttons, card previews, file attachments
- Backend: `/api/upload/chat-file`, ChatAttachmentMenu drawer
- FloatingChatBubble: full attachment support

### Phase 30: Satellite Bubble Design + Touch Fixes (2026-04-05)
- **NavScrollContext**: Shared context for synchronized minimize/expand
- **Satellite Layout**: AI (violet, LEFT) + Chat (orange, RIGHT) floating ABOVE nav bar
- **Separated**: 12px gap between bubbles and nav bar, bubbles are 40px vs nav 56px
- **Minimized State**: `[AI 32px] [BRUNO pill] [Chat 32px]` flanking the pill
- **Haptic Feedback**: Vibration API (6ms minimize, 12ms expand) on state change
- **BubbleSelect Touch Fix**: onTouchEnd + touch-manipulation + smart positioning
- **iOS Zoom Prevention**: select elements min-height 44px, font-size 16px

## Key API Endpoints
- POST /api/ai/chat, GET /api/ai/history, DELETE /api/ai/history
- POST /api/upload/chat-file (auto-detects content type)
- GET/POST /api/payments/*, /api/analytics/*, /api/social/*

## Prioritized Backlog

### P1: User Feedback (20-point list)
- Point #2: Multiple addresses/locations for business cards
- Point #15: Instagram/TikTok-style Story Editor
- Point #6: Premium card templates (Formal, Minimalist, Full Image, Animated)
- Point #13: Reels as first screen on profiles
- Point #17: Advanced profile editor with albums

### P2: Performance & Refactoring
- N+1 query patterns + pagination
- server.py (~5200 lines) - extract more routers
- MyProfilePage.jsx (~779 lines)
- Push notification improvements (#18)

### P3: Advanced
- ML collaborative filtering, WebSocket notifications, analytics export

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- Stripe (emergentintegrations)
- Daily.co, Cloudinary, Leaflet, Emergent Google Auth
