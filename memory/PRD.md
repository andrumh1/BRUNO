# BRUNO Social Network - PRD

## Original Problem Statement
Build a comprehensive social networking platform called "BRUNO" with digital business cards, social feeds, stories, marketplace, and advanced social features.

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Framer Motion
- **Backend:** FastAPI + MongoDB (modular routers)
- **Auth:** JWT + Google OAuth (Emergent-managed) + AES-GCM encrypted token storage
- **Storage:** Cloudinary, **AI:** OpenAI GPT-5.2 (Emergent LLM Key)
- **Maps:** Leaflet, **Payments:** Stripe, **External Sales:** DEAL (Hybrid API/Webhook)

## Implemented Features

### Core Social Features (Phase 17-35)
- Posts, Feed, Stories, Reels, Live Streams, Chat, Maps
- Card Analytics, Stripe Payments, NFC Integration
- Floating Nav, AI Chat, Satellite Bubble System
- Persistent Sessions (30-day web, 365-day mobile)
- Story Editor, Universal Minimization, PiP, View Modes
- Premium Templates, Multi-Locations, Drag-to-Reorder


### Phase 48: Profile/Settings Repair + Chat Camera Fix (2026-05-17)

**Settings menu — items reparados** (todos navegaban a home antes):
- `/edit-profile` → nuevo `EditProfilePage.jsx`
- `/change-password` → nuevo `ChangePasswordPage.jsx`
- `/settings/blocked` → nuevo `BlockedUsersPage.jsx`
- Ruta `/settings` añadida (faltaba en App.js — por eso todo redirigía)

**`EditProfilePage`** — editor completo:
- 6 campos editables: nombre, bio, ubicación, profesión, empresa, sitio web (con maxLength)
- Avatar con botón cámara naranja flotante → bottom-sheet menu con 4 opciones:
  1. Ver foto de perfil (modal full-screen con backdrop)
  2. Ver historia (navega a /my-profile?tab=stories)
  3. Cambiar con cámara Bruno (abre BrunoQuickCamera modo foto)
  4. Elegir de la galería (file picker tradicional)
- Upload via `/api/upload/image`, persiste en `/api/profile` PUT
- Loading + spinner durante upload, toast Bruno success/error

**`ChangePasswordPage`** — flujo completo:
- 3 campos con eye-toggle (current/new/confirm)
- Validación: min 8 chars, requiere mayúscula o número, confirm debe coincidir
- Strength meter de 4 niveles (rojo→ámbar→amarillo→verde→verde fuerte)
- Backend nuevo endpoint POST `/api/auth/change-password` con verificación de current_password vía bcrypt

**`BlockedUsersPage`** — listado y unblock:
- GET `/api/users/me/blocked` (endpoint ya existía)
- POST `/api/users/{id}/block` (toggle)
- Empty state limpio + toast feedback al desbloquear

**Chat camera fix**:
- `ChatAttachmentMenu` ya no usa `<input type="file" capture="environment">` para Camera/Video
- Ahora invoca `useBrunoCamera().open({ mode, onCapture })` → la misma cámara pro global
- File picker reservado sólo para Galería y Documento

🧪 **Verificación end-to-end:**
- Settings renderiza con los 3 items ✓
- Editar perfil carga datos del usuario y muestra menú de 4 opciones al tocar cámara ✓
- Change password page navega correctamente ✓
- Blocked users empty state visible ✓
- Attach Camera del chat abre BRUNO Camera HD (no file picker) ✓



### Phase 47: Audio Waveform + Typing Dots (2026-05-17)
**BrunoAudioWaveform** (`/components/bruno/BrunoAudioWaveform.jsx`) — WhatsApp-style voice notes:
- 32 barras con alturas deterministas (hash del URL → siempre igual para el mismo audio)
- Color naranja Bruno en propias, blanco en burbujas ajenas
- Barra actual pulsa verticalmente (`scaleY` 1→1.6→1 loop) durante reproducción
- Tap en cualquier barra → seek a esa posición
- Timer dinámico: muestra tiempo total cuando pausado, restante cuando reproduciendo
- Reemplaza al viejo `AudioPlayer` del ChatPage

**TypingDots** (`/components/bruno/TypingDots.jsx`):
- 3 puntos con `y: [0,-3,0]` + `opacity: [0.4,1,0.4]` con delays escalonados (0/180/360ms)
- Reemplaza al texto plano `escribiendo<animate-pulse>...` en la cabecera del chat
- Acepta `label` prop ("escribiendo", o el nombre del usuario)

🧪 Verificado visualmente: waveform Bruno renderiza con barras blancas en burbuja propia (color naranja), play/pause funcional.



### Phase 46: Camera Unification + Circular Video Notes (2026-05-17)

**Camera unified across the app** via `BrunoCameraProvider` (`/contexts/BrunoCameraContext.jsx`):
- Single global BrunoQuickCamera instance mounted at app root
- `useBrunoCamera().open({ onCapture, mode })` from anywhere → opens the same pro camera
- Nav `+` button replaced: now opens BrunoQuickCamera with auto-publish-to-story `onCapture`
- Removed duplicate `QuickStoryFAB`
- Removed `/camera` page nav (still accessible via route)

**BrunoQuickCamera Pro upgrades:**
- 4K → QHD → FHD → HD resolution fallback chain via `getUserMedia` constraints
- Native aspect-ratio container (reads `video.videoWidth/Height`)
- Pinch/slider zoom using `track.applyConstraints({ advanced: [{ zoom }] })` when supported
- Music module (`MusicPicker.jsx`): 8 royalty-free tracks, 9 categories, search, volume slider, trim start/end, applied to recording (played alongside video)
- Resolution badge in header

**Pill input reorg:**
- Camera button moved OUT of pill, sits next to mic (Instagram-style)
- Hides when typing (mic→send swap unchanged)

**Circular Video Messages** (`CircularVideoMessage.jsx`) — Telegram-style video notes:
- 180px circle with progress ring (orange Bruno color)
- Auto-play loop muted when scrolled into view (IntersectionObserver, threshold 0.4)
- Tap → unmute first, second tap → play/pause
- Bottom-right corner badge with mute/play state
- Backend accepts `message_type: "video_note"` without schema changes
- ChatPage's camera capture: video → directly sent as video_note with optional music metadata; photo → staged as pendingMedia



### Phase 44: Story Viewer + Chat Reactions + Profile FAB (2026-05-17)

**BrunoStoryViewer** (`/components/bruno/BrunoStoryViewer.jsx`) — Instagram-style:
- Tap left/right para navegar, **press-and-hold para pausar** (220ms threshold), tap-center vacío
- **Swipe-down to dismiss** con drag-Y de framer-motion (opacity + scale transforms)
- **Quick reactions**: 6 emojis (❤️😂😮😢🔥👏) con burst animation que vuela hacia arriba
- **Reply DM** in-line: enviar respuesta como mensaje al chat con el autor (crea chat si no existe)
- Progress bars Instagram-style, mute toggle (video), prev/next desktop, view-count para stories propias
- Reemplazó al `StoryViewer` legacy en `Stories.jsx` (1 línea cambiada)

**MessageReactionsBubble** (`/components/bruno/MessageReactionsBubble.jsx`):
- Wrap de cada burbuja de chat con long-press / right-click → popover de reacciones
- 6 emojis quick-react + botón "Responder" (separado por divider)
- Outside-click dismiss, animación spring
- Display de reacciones agregadas debajo del bubble (`{emoji}{count}`)
- Integrado en ChatPage con `handleReactMessage` (POST `/chats/{id}/messages/{mid}/react?emoji=`) y `handleSetReply` para activar el reply banner del pill input
- `reply_to` se persiste en `messageData` cuando se envía

**QuickStoryButton inline** en MyProfilePage:
- Variante `icon` añadida al lado de "Editar perfil" para impulsar creación desde el perfil



### Phase 43: Quick Story (Capture → Publish 1-tap) (2026-05-17)
**Goal:** Engagement diario tipo Instagram/TikTok — capturar y publicar story en un solo flujo.

**Components added:**
- `QuickStoryButton.jsx` — botón con 3 variantes (floating/inline/icon) que abre BrunoQuickCamera. Tras capturar, monta `CaptionOverlay` con preview + caption (200 chars) + visibility (public/followers/private) + tap único "Publicar Story · 24h".
- `QuickStoryFAB.jsx` — wrapper global que monta el FAB sólo para usuarios autenticados y se oculta en rutas donde estorbaría (login, chat, camera, welcome, public card pages, lives, reels, qr, etc.).
- Integrado en `App.js` como overlay global.

**Pipeline:**
1. Tap FAB → BrunoQuickCamera con filtros TikTok-style
2. Capturar (foto/video) → CaptionOverlay con preview filtrado
3. Tap "Publicar" → POST `/api/upload/image|chat-file` → POST `/api/stories/` con caption + visibility → toast Bruno publish + auto-cierre
4. Story expira en 24h (manejado por backend)

**Tests verificados:**
- FAB visible en /feed, oculto en /chat /welcome
- Camera modal abre desde FAB
- Pipeline backend (upload + create story) probado vía curl → Story creada con `expires_at` +24h ✓



### Phase 42: Pro Camera + Pill Chat Input (2026-05-17)
**Goal:** Modernizar el chat con identidad Bruno y cámara TikTok-style.

**BrunoQuickCamera** (`/components/bruno/BrunoQuickCamera.jsx`):
- Modal full-screen con stream `getUserMedia` + filtros CSS en tiempo real (14 presets: Beauty, Glow, Cálido, Sunset, Vintage, Drama, B&N, Cinema, Neon, Dreamy, Noir, Fade, etc.).
- Foto/Video con switch, shutter blanco animado, recording timer rojo, espejado opcional.
- Captura → preview → enviar (devuelve File al callback `onCapture`).
- Header con logo Bruno + flip cámara delantera/trasera.

**BrunoPillInput** (`/components/bruno/BrunoPillInput.jsx`):
- Input estilo "pill" coherente con la nav Bruno. Glow naranja al focus, glass-blur, auto-resize 1→6 líneas.
- Botón `+` naranja externo para adjuntos, cámara interna que se desliza/oculta al escribir, sticker/emoji, mic↔send que rota con AnimatePresence.
- Banner de respuesta dinámico arriba de la pill (expand/collapse).

**ChatPage integración:**
- Reemplazado el `<form>` legacy por `<BrunoPillInput>` + `<BrunoQuickCamera>` modal.
- Captura desde cámara → sube como adjunto via `handleFileSelect`.
- Toast Bruno tras capturar.

**Tests visuales:** pill renderiza, textarea funcional, botones mic/send swap al escribir, modal cámara abre y cierra, capturas en `/tmp/chat-direct.png`, `/tmp/chat-pill-typing.png`, `/tmp/chat-camera-open.png`.



### Phase 41: Onboarding /welcome + P1/P2 UI System rollout (2026-05-17)
**New page `/welcome`** — 4-step interactive onboarding showcasing the Bruno UI:
- Step 1 Intro: mascot animation + Native-Ready chip
- Step 2 Features: 4 feature chips + 2 ExpandableCards (cards & DEAL)
- Step 3 Interact: 4 demo buttons triggering brunoToast variants (follow/publish/like/loading)
- Step 4 Ready: success state + CTAs to "Create card" or "Explore"
- Skip flow with BrunoModal confirmation
- Persisted via localStorage `bruno_welcome_seen`

**P1: Toast migration** — `ActivateNFCPage` and `NFCManagerPage` now use `brunoToast` (drop-in via `as toast` import alias, no call-site changes).

**P2: Dashboard delete confirm** — replaced native `window.confirm` with `<BrunoModal variant="danger">` including loading state, branded design, and follow-up `brunoToast.success/error` for the result. No more raw `alert()`.

**Toaster mounted** in `App.js` (was missing — toasts didn't render before this phase).



### Phase 39: Mobile-Native API Surface (2026-05-17)
**Goal:** Backend ready for React Native / Flutter consumption.

**Push Notifications (FCM/APNs/Expo)**
- POST /api/mobile/devices/register — store device tokens with platform metadata (idempotent by user+token)
- GET /api/mobile/devices — list active devices (token redacted)
- DELETE /api/mobile/devices/{id} — soft-unregister, flips push flag when no devices remain
- Collection: mobile_devices

**Biometric Auth (FaceID / Fingerprint)**
- Public-key challenge/response on top of JWT. Supports ed25519, ecdsa-p256, rsa-2048.
- POST /api/mobile/biometric/enroll — register device public key (authenticated)
- POST /api/mobile/biometric/challenge — request one-time challenge (public, 120s TTL)
- POST /api/mobile/biometric/verify — sign challenge → returns access + refresh token pair
- POST /api/mobile/auth/refresh — refresh-token rotation (old token revoked)
- POST /api/mobile/auth/logout — revoke refresh token
- GET / DELETE /api/mobile/biometric/credentials — list/revoke
- Collections: biometric_credentials, biometric_challenges, refresh_tokens

**Offline Sync**
- GET /api/mobile/sync/manifest — per-collection last_modified + count
- GET /api/mobile/sync/cards|store|deal-orders — delta sync with `since` + cursor pagination
- GET /api/mobile/sync/profile — user snapshot
- GET /api/mobile/sync/bootstrap — one-shot hydration for first install
- POST /api/mobile/sync/push — apply offline changes (create/update/delete) with last-write-wins
- GET /api/mobile/config — public app config (VAPID key, feature flags, endpoint catalog)

**DEAL Push Notifications Wiring (Phase 38 P0 → completed)**
- Webhook /api/deal/webhook now fires `_notify_partner_commission` and `_notify_buyer_payment`
- Partners get instant push on commission earned; buyers get paid/failed/refunded notifications

**Tests:** /app/backend/tests/test_mobile_native.py — 21/21 passing (push registration, biometric flow with Ed25519 signatures, replay protection, refresh rotation, delta sync, offline push).


### Phase 37: DEAL Integration (2026-05-17)
- Outbound: POST /api/deal/send-order (cliente, producto, precio, partner_id, referral_code, origen: Bruno)
- Inbound: POST /api/deal/webhook (HMAC-SHA256 verified, updates status, registers commission, activates service)
- Frontend: Comprar/Solicitar Servicio buttons, DEAL toggle on product creation

### Phase 38: Partner Dashboard + Full Refactoring (2026-05-17)

**New Feature: DEAL Partner Dashboard**
- Page at /partner-dashboard with summary stats (total earned, orders, volume, conversion rate)
- Monthly revenue chart, top products, recent commissions, recent orders
- Backend: GET /api/deal/partner/dashboard aggregates from deal_orders + deal_commissions

**P1: Enhanced Push Notifications for Mobile**
- NotificationPayload extended: image, actions (max 2), vibrate patterns, renotify, silent, requireInteraction
- Service Worker v6: handles rich notifications with action buttons (reply, dismiss, accept call)
- Context-aware defaults: messages get renotify=true, calls get requireInteraction=true

**P2: server.py Refactoring (5417 → 4311 lines, -20%)**
- Extracted 1215 lines to routers/posts_feed.py (posts, feed, chats, users, notifications, settings)
- Models duplicated in router to avoid circular imports
- All endpoints verified working post-extraction

**P2: CreateCardPage.jsx Breakdown (1666 → 1294 lines, -22%)**
- Extracted CurriculumFields.jsx (226 lines): experience, education, skills, languages, documents, references

**P2: Frontend Security - Encrypted Token Storage**
- Created secureStorage.js: AES-GCM encryption via Web Crypto API
- AuthContext.js rewritten: tokens encrypted before localStorage, auto-migrates old plaintext tokens
- Fallback to in-memory storage if Web Crypto unavailable

**P2: Hook Dependencies Fixed**
- ViewCardPage.jsx: fetchCard wrapped in useCallback
- StorePage.jsx: fetchProducts + fetchUserData wrapped in useCallback
- FeedPage.jsx: verified correct useCallback pattern

**P2: Array Index Keys Fixed (83/86)**
- Fixed across EditCardPage, ViewCardPage, FeedPage, StorePage, HelpPage, PricingPage, NFCManagerPage, SocialLinkSelector, MarketplacePage, and 15+ other files
- Remaining 3 are skeleton loading indicators (acceptable use)

**P2: Backend Complexity Refactored**
- analytics.py: get_card_analytics split into _compute_view_metrics helper
- deal_integration.py: webhook split into _update_order_status, _register_commission, _activate_product
- moderation.py: Fixed mutable default argument
- lives.py: Fixed 4 bare excepts → Exception
- notifications.py: Removed unused variable

**Console Statements Cleaned: 151 → 0**
- All console.log/error/warn/info removed from production code across 46 files

**Testing: 100% pass rate (iterations 52-55)**

## Key API Endpoints
- POST /api/deal/send-order, POST /api/deal/webhook
- GET /api/deal/partner/dashboard, GET /api/deal/orders, GET /api/deal/commissions
- GET /api/posts, GET /api/feed/for-you (now in posts_feed.py)
- GET /api/chats, POST /api/chats/{id}/messages (now in posts_feed.py)
- PUT /api/cards/reorder, POST /api/auth/login, POST /api/auth/refresh

## Environment Variables
```
DEAL_API_URL=         # DEAL API base URL (placeholder)
DEAL_API_KEY=         # API key for DEAL auth (placeholder)
DEAL_WEBHOOK_SECRET=  # HMAC-SHA256 shared secret
```

## Remaining Backlog
- server.py now 3695 lines — further extraction possible: AI/Stripe/cards/auth
- Type hints coverage (20.2% → target 60%)
- ProfileSpecificFields.jsx (>1000 lines) needs breakdown
- FeedPage.jsx (882 lines) needs breakdown

## Phase 49: Tri-Track Refactor & Push Polish (2026-05-18)

**P2 Backend — `server.py` 4334 → 3695 lines (-639, ~14%)**
- Extracted uploads to `routers/uploads.py` (218 lines): /upload/{image,audio,file,chat-file,avatar,banner} + DELETE
- Extracted NFC to `routers/nfc.py` (461 lines): activate, resolve, go (302 redirect), my-cards, update-card, configure-product, lock, resolve-product, product-schemas
- New routers use `utils/database`, `utils/security`, `models/user` (consistent with prior refactors)
- All endpoints verified via curl (200/422/302 as expected)

**P2 Frontend — `EditCardPage.jsx` 1080 → 799 lines (-281, ~26%)**
- Replaced inline curriculum block (290 lines) with existing `<CurriculumFields/>` component
- Added `references` to fallback custom_fields default
- Removed unused lucide-react icon imports (Plus, Trash2, Briefcase, GraduationCap, Award, Languages, FileText)

**P1 Mobile Push Notifications — richer presentations**
- `routers/push_notifications.py` helpers now accept context IDs + avatars for deep-linking:
  - `notify_new_message(chat_id, sender_avatar)` → tag per chat for grouping
  - `notify_new_follower(follower_id, follower_avatar)` → deep-links to follower's profile
  - `notify_new_like(post_id, image_url)` → rich preview when liked content has media
  - `notify_new_comment(post_id, commenter_avatar)` → reply action deep-links to post
  - NEW `notify_story_reaction(story_id, emoji, reactor_avatar)` — story engagement push
  - NEW `notify_incoming_call(call_id, caller_avatar, video)` — requireInteraction + persistent
- Fixed `requireInteraction: True` hard-coded for ALL notifications → now only true for calls
- Service worker bumped to v7 with action handlers for `view_story`, `follower`, `comment_`, and contextual deep-link routing per `data.kind`

## Remaining Backlog (post-49)
- server.py further reduction: extract AI routes (/ai/*), card routes, Stripe payments
- FeedPage.jsx (882) + MyProfilePage.jsx (953) breakdown
- Wire `notify_story_reaction` from BrunoStoryViewer reaction handler
- Wire `notify_incoming_call` from /calls/start endpoint

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet
- Emergent Google Auth, DEAL App (Hybrid API/Webhook)
