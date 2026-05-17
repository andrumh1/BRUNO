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

### Phase 17-28: Foundation
- Social features, card analytics, Stripe, NFC redirect, floating nav bar

### Phase 29-35: Advanced Features (2026-04-05)
- AI Chat, Satellite Bubble System, Persistent Sessions, Story Editor
- Universal Minimization, Card UX Overhaul, PiP, View Modes
- Premium Templates, Multi-Locations, N+1 Fixes, Pagination

### Phase 36: Drag-to-Reorder + Code Quality Batch 2 (2026-04-08)
- DraggableList component integrated into MyProfilePage for card reorder
- PUT /api/cards/reorder with ReorderRequest Pydantic model
- Cleaned 15+ console.log, fixed array index keys in 5 files

### Phase 37: DEAL Integration - Hybrid Architecture (2026-05-17)
- **BRUNO → DEAL (Outbound)**: POST /api/deal/send-order
  - Sends: cliente, producto, precio, partner_id, referral_code, origen: "Bruno", estado: "pending_payment"
  - Creates local order in `deal_orders` collection, forwards to DEAL API
  - Gracefully handles missing DEAL_API_URL (stores locally)
- **DEAL → BRUNO (Inbound Webhook)**: POST /api/deal/webhook
  - Receives: deal_id, order_id, payment_status, amount_paid, partner_id, commission_amount, service_status
  - Updates order status (paid/failed/refunded)
  - Registers partner commission in `deal_commissions` collection
  - Activates product/service in `deal_activations` collection
  - HMAC-SHA256 signature verification via DEAL_WEBHOOK_SECRET
- **Frontend**:
  - ProductDetailPage: "Comprar" / "Solicitar Servicio" button for `deal_enabled` products
  - Order confirmation modal with order details
  - NewProductPage: DEAL toggle section with partner_id + referral_code fields
- **Marketplace Model**: ProductCreate/ProductUpdate extended with `deal_enabled`, `deal_partner_id`, `deal_referral_code`
- **Env Config**: DEAL_API_URL, DEAL_API_KEY, DEAL_WEBHOOK_SECRET (placeholder)
- **MongoDB Collections**: deal_orders, deal_commissions, deal_activations

## Key API Endpoints
- POST /api/deal/send-order — Send order to DEAL
- POST /api/deal/webhook — Receive DEAL payment confirmations
- GET /api/deal/orders — User's DEAL orders
- GET /api/deal/orders/{id} — Specific order detail
- GET /api/deal/commissions — Partner commissions
- PUT /api/cards/reorder — Reorder user cards
- POST /api/auth/login, POST /api/auth/refresh
- GET /api/cards, POST /api/marketplace/products

## Prioritized Backlog

### P1: User Feedback (Remaining)
- Improved push notification presentations for mobile

### P2: Performance & Refactoring
- server.py monolith (~5400 lines) needs router extraction
- CreateCardPage.jsx (>1600 lines) needs component breakdown
- Frontend Security: Move tokens from localStorage to httpOnly cookies
- Missing Hook Dependencies across multiple files

## Environment Variables (DEAL)
```
DEAL_API_URL=         # DEAL API base URL (placeholder)
DEAL_API_KEY=         # API key for DEAL auth (placeholder)
DEAL_WEBHOOK_SECRET=  # HMAC-SHA256 shared secret for webhook verification
```

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet
- Emergent Google Auth, **DEAL App (Hybrid API/Webhook architecture)**
