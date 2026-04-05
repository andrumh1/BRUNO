# BRUNO Social Network - PRD

## Original Problem Statement
Build a comprehensive social networking platform called "BRUNO" with digital business cards, social feeds, stories, marketplace, and advanced social features.

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Framer Motion
- **Backend:** FastAPI + MongoDB
- **Auth:** JWT + Google OAuth (Emergent-managed)
- **Storage:** Cloudinary (images)
- **AI:** OpenAI GPT-5.2 (Emergent LLM Key)
- **Maps:** Leaflet, **Payments:** Stripe

## What's Been Implemented

### Phase 17-28: Foundation → Blocks 1-2 (Previous Sessions)
- Social features, card analytics, Stripe, NFC redirect, floating nav bar

### Phase 29: AI Chat + Messenger Attachments (2026-04-05)
- Bruno AI action buttons, card previews, ChatAttachmentMenu drawer, upload/chat-file

### Phase 30: Satellite Bubble Design (2026-04-05)
- **NavScrollContext**: Shared minimize/expand state + haptic feedback (6ms/12ms vibrate)
- **Expanded state**: AI (violet circle, left) + Chat (orange circle, right) floating 12px ABOVE nav bar
- **Minimized state**: All pills share identical `bg-background/90 backdrop-blur-2xl border shadow-xl rounded-full` style
- **Fixed positioning from center** — prevents overlap:
  - AI pill: `right: calc(50% + 60px)` (to the LEFT of BRUNO)
  - BRUNO pill: `left: 50%, -translate-x-1/2` (center)
  - Chat pill: `left: calc(50% + 60px)` (to the RIGHT of BRUNO)
  - Avatar tray: `left: calc(50% + 104px)` (starts after Chat pill)
- **8px gap** between AI↔BRUNO and BRUNO↔Chat, 4px gap Chat↔avatars
- **Scrollable avatar tray**: Open chats collapse to w-7 avatar circles in horizontal scrollable container (`overflow-x-auto scrollbar-hide`), sorted by last activity
- **No overlap guaranteed**: Each element has independent fixed positioning from page center
- **BubbleSelect touch fix**: onTouchEnd, touch-manipulation, smart dropdown positioning

## Prioritized Backlog

### P1: User Feedback (20-point list)
- Point #2: Multiple addresses/locations for business cards
- Point #15: Instagram/TikTok-style Story Editor
- Point #6: Premium card templates
- Point #13: Reels first screen, Point #17: Profile editor with albums

### P2: Performance & Refactoring
- N+1 queries + pagination, server.py extract routers, MyProfilePage.jsx

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet, Emergent Google Auth
