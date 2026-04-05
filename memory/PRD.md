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
  - Card pills tray: `right:calc(50%+96px)` — scrollable, adjacent left of AI pill
  - AI pill: `right:calc(50%+60px)` 
  - BRUNO pill: `left:50% -translate-x-1/2`
  - Chat pill: `left:calc(50%+60px)`
  - User avatar tray: `left:calc(50%+104px)` to `right:8px` — scrollable
- **Card Minimize Feature**: ViewCardPage has minimize button → adds card to context/sessionStorage → pill appears adjacent to AI pill on scroll minimize → click pill reopens card
- **Card Type Badges**: Colored dot (Personal=blue, Business=green, Freelance=orange, Curriculum=purple) on each minimized card pill
- **Bug Fix**: Clicking minimized chat avatar now calls `setMinimized(false)` to expand nav + show chat window
- **Haptic Feedback**: Vibration API on minimize/expand state changes
- **Touch Gestures**: Swipe up=expand, swipe down=minimize on all pill elements

### Phase 31: Persistent Sessions & Polish (2026-04-05)
- JWT token expiry extended to 30 days (was 7 days)
- /api/auth/refresh endpoint for explicit token renewal
- /api/auth/me auto-returns `refreshed_token` when token expires within 7 days
- Frontend AuthContext silently updates stored token when receiving refreshed_token
- All login paths (email, Google OAuth) store token in localStorage by default for cross-session persistence

### Phase 32: Mobile Infinite Sessions + Premium Templates + Multi-Locations + N+1 Fixes (2026-04-05)
- **Mobile Indefinite Sessions**: Login sends `platform` param (mobile/web). Mobile gets 365-day JWT, web gets 30-day. JWT contains `plt` claim.
- **Long-Press Tooltip**: 400ms long-press on minimized card pill shows tooltip with card name + type label (Personal/Negocio/Freelance etc.)
- **Multiple Locations**: Card model has `locations: List[dict]` array. CreateCardPage has "Agregar otra ubicacion" button. ViewCardPage renders all locations as clickable items linking to Google Maps.
- **4 Premium Templates**: premium_formal (serif + golden accents), premium_glass (glassmorphism), premium_fullimg (full background image with dark overlay), premium_animated (animated gradient + particles). All templates show PRO badge in TemplateSelector.
- **N+1 Query Optimization**: Posts feed and For-You feed now batch-fetch users, profiles, likes, bookmarks using `$in` operator instead of individual queries per post. NFC cards endpoint also batch-fetches card titles.
- **Pagination**: GET /cards and GET /public/cards now accept `skip` and `limit` params (default limit=50).

### Phase 33: Story Editor + Reels Default + Albums Integration (2026-04-05)
- **Instagram/TikTok-style Story Editor** (`StoryEditor.jsx`): Full-screen editor with:
  - Draggable text overlays (customizable font, size 12-64, color, bold, italic, alignment)
  - SVG stickers (fire, heart, star, crown, rocket, sparkles) — draggable
  - 10 gradient background presets
  - Poll integration (question + 2-4 options)
  - Media upload (photo/video)
  - Publish flow with caption + visibility (public/followers/private)
- **Reels First Screen**: Profile page default tab changed from "Posts" to "Reels"
- **Albums Tab in Profile**: Album grid cards with public/private badges (Globe/Shield), photo count, and "Gestionar" button linking to /albums page

### Phase 34: Universal Minimization System (2026-04-05)
- **Multitask Minimization**: Users can now minimize cards, profiles, posts, reels, and live streams into the same tray
- **NavScrollContext**: Rewritten with universal `minimizedItems` array (backward compat aliases for cards)
- **Type-specific badges**: card=by card_type color, profile=#8B5CF6, post=#3B82F6, reel=#EF4444, live=#EF4444+pulse animation
- **Type-specific routing**: Clicking minimized item navigates to correct page (card→/c/id, profile→/profile/id, post→/feed, reel→/reels?id=id, live→/lives/id)
- **12 item max limit**: Oldest items auto-removed when limit reached
- **Minimize buttons added to**: PostCard (dropdown menu), UserProfilePage (header), ReelsPage (action sidebar)
- **Session persistence**: Items stored in sessionStorage ('bruno_min_items') with automatic migration from old key

## Key API Endpoints
- POST /api/ai/chat, GET /api/ai/history, POST /api/upload/chat-file
- POST /api/auth/login (accepts optional `platform` field), POST /api/auth/refresh
- GET /api/cards?skip=0&limit=50, GET /api/public/cards?skip=0&limit=50
- POST /api/stories, GET /api/stories/feed, GET /api/albums, POST /api/albums
- All social, payment, analytics endpoints operational

## Prioritized Backlog

### P1: User Feedback (Remaining)
- Point #18: Improved push notification presentations for mobile

### P2: Performance & Refactoring
- server.py monolith (~5300 lines) needs router extraction (auth, cards, AI chat)
- MyProfilePage.jsx (~800 lines) needs component breakdown

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet, Emergent Google Auth
