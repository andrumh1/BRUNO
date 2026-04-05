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

### Phase 17-25: Foundation → Stripe (Previous Sessions)
- Social features, card analytics, Stripe checkout, premium page

### Phase 26: P0 Bug Fixes + Backend Refactoring (2026-03-30)
- Stripe, card view, NFC redirect, social.py router

### Phase 27-28: Blocks 1-2 UI + Navigation (2026-04-05)
- UI fixes, floating bubble nav, scroll-hide, animations

### Phase 29: AI Chat + Messenger Attachments (2026-04-05)
- Bruno AI enhancements, ChatAttachmentMenu drawer, upload/chat-file endpoint

### Phase 30: Satellite Bubble Design (2026-04-05)
- **NavScrollContext**: Shared minimize/expand state with haptic feedback
- **Satellite Layout**: AI (violet) LEFT, Chat (orange) RIGHT, floating ABOVE nav bar (12px gap)
- **Unified Minimized Style**: All 3 pills share identical `bg-background/90 backdrop-blur-2xl border border-border/50 shadow-xl rounded-full` design, each with its own colored icon (Sparkles violet, MessageCircle orange, ChevronUp muted)
- **8px gaps** between all minimized pills: `[✨ AI] 8px [BRUNO] 8px [💬 Chat] [user avatars...]`
- **Minimized open chats**: Active conversations collapse into small avatar circles (w-7) that dock to the right of the Chat pill, with close-on-hover
- **Chat windows hidden on minimize**: Windows disappear when nav minimizes, reappear when expanded
- **Haptic Feedback**: 6ms vibrate on minimize, 12ms on expand
- **BubbleSelect Touch Fix**: onTouchEnd + touch-manipulation + smart positioning

## Key API Endpoints
- POST /api/ai/chat, GET /api/ai/history, DELETE /api/ai/history
- POST /api/upload/chat-file
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

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet, Emergent Google Auth
