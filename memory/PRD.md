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

### Phase 17-28: Foundation
- Social features, card analytics, Stripe, NFC redirect, floating nav bar

### Phase 29: AI Chat + Messenger Attachments (2026-04-05)
- Bruno AI action buttons, card previews, ChatAttachmentMenu drawer, upload/chat-file

### Phase 30: Satellite Bubble System (2026-04-05)
- NavScrollContext with shared state + sessionStorage persistence
- Fixed Positioning from Center for each pill independently
- Card Type Badges, Haptic Feedback, Touch Gestures

### Phase 31: Persistent Sessions (2026-04-05)
- JWT 30-day expiry, /api/auth/refresh endpoint, auto-refresh in AuthContext

### Phase 32: Mobile Infinite Sessions + Premium Templates + Multi-Locations + N+1 Fixes (2026-04-05)
- Mobile 365-day JWT, Long-Press Tooltip, Multiple Locations per card
- 4 Premium Templates (formal, glass, fullimg, animated)
- N+1 Query Optimization + Pagination for cards

### Phase 33: Story Editor + Reels Default + Albums Integration (2026-04-05)
- Instagram/TikTok-style Story Editor with draggable text, stickers, gradients, polls
- Reels as default profile tab, Albums grid in profile

### Phase 34: Universal Minimization System (2026-04-05)
- Profiles, posts, reels, live streams minimizable into floating tray
- Type-specific badges and routing, 12 item max, session persistence

### Phase 35: Card UX Overhaul + PiP + View Modes (2026-04-05)
- Click-to-Open, Long-Press Preview, 3 View Modes (Compact/Grid/List)
- Picture-in-Picture floating video player

### Phase 36: Drag-to-Reorder + Code Quality Batch 2 (2026-04-08)
- **Drag-to-Reorder Cards**: `DraggableList.jsx` component integrated into `MyProfilePage.jsx`
  - "Ordenar" button activates reorder mode → switches to list view with drag handles
  - Backend `PUT /api/cards/reorder` accepts `{card_ids: [...]}` and sets `sort_order`
  - `GET /api/cards` returns cards sorted by `sort_order` first
  - `ReorderRequest` Pydantic model for proper FastAPI body parsing
  - Route placed before `/cards/{card_id}` to avoid path parameter conflict
- **Code Quality Batch 2**:
  - Removed all `console.log` debug statements (15 files cleaned)
  - Fixed array index as key anti-pattern in ViewCardPage, StorePage, HelpPage, PricingPage, NFCManagerPage
  - Testing: 100% pass rate (iteration 52) — 9/9 backend, all frontend features verified

## Key API Endpoints
- POST /api/ai/chat, GET /api/ai/history, POST /api/upload/chat-file
- POST /api/auth/login, POST /api/auth/refresh
- GET /api/cards?skip=0&limit=50, PUT /api/cards/reorder
- POST /api/stories, GET /api/stories/feed, GET /api/albums
- All social, payment, analytics endpoints operational

## Prioritized Backlog

### P1: User Feedback (Remaining)
- Improved push notification presentations for mobile

### P2: Performance & Refactoring
- server.py monolith (~5400 lines) needs router extraction
- CreateCardPage.jsx (>1600 lines) needs component breakdown
- MyProfilePage.jsx (~900 lines) needs component breakdown
- Frontend Security: Move tokens from localStorage to httpOnly cookies
- Missing Hook Dependencies across multiple files
- Backend complexity refactoring (analytics, compliance, auth, lives, marketplace)

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet, Emergent Google Auth
