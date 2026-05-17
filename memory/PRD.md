# BRUNO Social Network - PRD

## Original Problem Statement
Build a comprehensive social networking platform called "BRUNO" with digital business cards, social feeds, stories, marketplace, and advanced social features.

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Framer Motion
- **Backend:** FastAPI + MongoDB
- **Auth:** JWT + Google OAuth (Emergent-managed)
- **Storage:** Cloudinary (images), **AI:** OpenAI GPT-5.2 (Emergent LLM Key)
- **Maps:** Leaflet, **Payments:** Stripe, **External Sales:** DEAL (Hybrid API/Webhook)

## What's Been Implemented

### Phase 17-35: Foundation + Advanced Features
- Social features, card analytics, Stripe, NFC, floating nav, AI Chat
- Satellite Bubble System, Persistent Sessions, Story Editor
- Universal Minimization, Card UX Overhaul, PiP, View Modes
- Premium Templates, Multi-Locations, N+1 Fixes, Pagination

### Phase 36: Drag-to-Reorder (2026-04-08)
- DraggableList component + PUT /api/cards/reorder endpoint

### Phase 37: DEAL Integration (2026-05-17)
- BRUNO → DEAL: POST /api/deal/send-order
- DEAL → BRUNO: POST /api/deal/webhook (HMAC-SHA256 verified)
- Frontend: "Comprar"/"Solicitar Servicio" buttons, DEAL toggle on product creation
- MongoDB: deal_orders, deal_commissions, deal_activations collections

### Phase 38: Code Quality Batch 2 (2026-05-17)
**Critical Fixes:**
- Removed hardcoded secrets from 3 test files → os.getenv()
- Fixed mutable default argument in moderation.py (report_ids: List = [] → Optional[List] = None)
- Fixed 4 bare excepts → Exception in lives.py
- Removed unused variable in notifications.py

**Frontend Cleanup (151 console statements removed):**
- Cleaned ALL console.log/error/warn/info across 46 files
- Zero console statements remaining in production code

**Hook Dependencies Fixed:**
- ViewCardPage.jsx: useCallback for fetchCard
- StorePage.jsx: useCallback for fetchProducts, fetchUserData
- FeedPage.jsx: Already had correct useCallback pattern

**Array Index Keys Fixed (High Priority Files):**
- EditCardPage.jsx: Stable _key on dynamic form items (experience, education, skills, languages, documents)
- EditCardPage.jsx: Social links use `${link.type}-${link.url}` key
- ViewCardPage.jsx: Gallery photos use photo URL as key, social links use platform-url
- FeedPage.jsx: Social links and trending hashtags use stable keys
- StorePage.jsx: Colors use color value, features use feature text
- HelpPage.jsx, PricingPage.jsx, NFCManagerPage.jsx: Stable keys

**Backend Refactoring:**
- deal_integration.py: Refactored webhook from 78-line function into 3 focused helpers:
  - _update_order_status() - Handles payment status mapping
  - _register_commission() - Creates partner commission records
  - _activate_product() - Activates product/service after payment
- Used PAYMENT_STATUS_MAP dict instead of if/elif chain
- Python linting: All routers pass ruff checks

**Testing:** 100% pass rate — Backend 19/19, Frontend 100% (iteration 54)

## Key API Endpoints
- POST /api/deal/send-order, POST /api/deal/webhook
- GET /api/deal/orders, GET /api/deal/commissions
- PUT /api/cards/reorder, POST /api/auth/login, POST /api/auth/refresh

## Prioritized Backlog

### P1
- Improved push notification presentations for mobile

### P2: Performance & Refactoring
- server.py monolith (~5400 lines) needs router extraction
- CreateCardPage.jsx (>1600 lines) needs component breakdown
- Frontend Security: Move tokens from localStorage to httpOnly cookies
- Remaining hook dependencies (145+ hooks — high priority ones fixed)
- Remaining array index keys (~70+ instances in lower-priority files)
- Backend complexity: analytics.py, card_analytics.py functions >100 lines

## Environment Variables (DEAL)
```
DEAL_API_URL=         # Placeholder
DEAL_API_KEY=         # Placeholder
DEAL_WEBHOOK_SECRET=  # HMAC-SHA256 shared secret
```

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet
- Emergent Google Auth, DEAL App (Hybrid API/Webhook architecture)
