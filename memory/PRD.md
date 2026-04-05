# BRUNO Social Network - PRD

## Original Problem Statement
Build a comprehensive social networking platform called "BRUNO" with digital business cards, social feeds, stories, marketplace, and advanced social features.

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Framer Motion
- **Backend:** FastAPI + MongoDB
- **Auth:** JWT + Google OAuth (Emergent-managed)
- **Storage:** Cloudinary (images), **AI:** OpenAI GPT-5.2 (Emergent LLM Key)
- **Maps:** Leaflet, **Payments:** Stripe

## What's Been Implemented

### Phase 17-28: Foundation → Blocks 1-2
- Social features, card analytics, Stripe, NFC redirect, floating nav bar

### Phase 29: AI Chat + Messenger Attachments (2026-04-05)
- Bruno AI action buttons, card previews, ChatAttachmentMenu drawer, upload/chat-file

### Phase 30: Satellite Bubble System (2026-04-05)
- **NavScrollContext**: Shared state + sessionStorage persistence for minimized cards + touch swipe gesture (up=expand, down=minimize)
- **Fixed Positioning from Center**: Each pill independently positioned using `calc(50% ± Npx)` to guarantee zero overlap:
  - Card pills tray: `left:8px` to `right:calc(50%+104px)` — scrollable
  - AI pill: `right:calc(50%+60px)` 
  - BRUNO pill: `left:50% -translate-x-1/2`
  - Chat pill: `left:calc(50%+60px)`
  - User avatar tray: `left:calc(50%+104px)` to `right:8px` — scrollable
- **Card Minimize Feature**: ViewCardPage has minimize button → adds card to context/sessionStorage → pill appears at bottom-left on scroll minimize → click pill reopens card
- **Bug Fix**: Clicking minimized chat avatar now calls `setMinimized(false)` to expand nav + show chat window
- **Haptic Feedback**: Vibration API on minimize/expand state changes
- **Touch Gestures**: Swipe up=expand, swipe down=minimize on all pill elements

## Key API Endpoints
- POST /api/ai/chat, GET /api/ai/history, POST /api/upload/chat-file
- All social, payment, analytics endpoints operational

## Prioritized Backlog

### P1: User Feedback
- Point #2: Multiple addresses/locations for business cards
- Point #15: Instagram/TikTok-style Story Editor
- Point #6: Premium card templates (Formal, Minimalist, Full Image, Animated)
- Point #13: Reels first screen, Point #17: Profile editor with albums

### P2: Performance & Refactoring
- N+1 queries + pagination, server.py (~5200 lines), MyProfilePage.jsx

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet, Emergent Google Auth
