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

## Phase 50: NFC Scan Push Notifications (2026-05-18)

**Feature: "Tu tarjeta cobro vida"** — el dueno recibe una push enriquecida cada vez que alguien escanea su NFC.

- `routers/push_notifications.py` → nuevo helper `notify_nfc_scan(user_id, card_id, card_title, card_image, nfc_id)`:
  - Title: "Tu tarjeta cobro vida"
  - `image`: banner_url o avatar_url de la card → preview rico en movil
  - Action unica: "Ver analitica" → deep-link a `/c/{card_id}/analytics`
  - Tag `nfc_scan_{nfc_id}` → notificaciones se reemplazan en lugar de apilarse
- `routers/nfc.py` → `_fire_nfc_scan_push` con `asyncio.create_task` (fire-and-forget) cableado en `/nfc/go/{id}` y `/nfc/resolve/{id}`
- `public/sw.js` → v8: handler para action `view_analytics` + matcher para tags `nfc_scan_`

## Phase 51: PIUP Manager — Modulo NFC completo (2026-05-18)

**Backend `routers/piup.py` (350 lineas):**
- 19 productos PIUP en catalogo (Hogar 5, Restaurantes 3, Oficinas 10, Mascotas 1)
- Tabla de tamanos C/U/R x 1..7 (1=1x1cm, 2=3x3cm, 3=5x5cm, 4=7x7cm, R5=3x5, R6=4x7, R7=ID 85x55)
- 9 colores; endpoints: catalog, sizes, my-tags, request-physical, orders, activate-by-qr

**Frontend `PiupManagerPage` con 3 tabs (`/piup`):**
- Mis Tags: badge fisico/digital + botones contextuales Solicitar/Renovar
- Activar PIUP: escaner QR con `jsQR` (1280px env-facing camera), parse URL/plain, fallback manual
- Tienda PIUP: filtros categoria + forma + grid de 19 productos + configurador modal con StylePills

**Real-time:** `activate-by-qr` dispara WS event `piup_activated`. QR + NFC ambos resuelven a `/c/{card_id}` (unificado).

## Phase 54: Branding oficial — Logo PIUP/Bruno (2026-05-20)

**Logo oficial** (perro con VR goggles, naranja `#FF7F00`, fondo cream):
- Descargado desde `customer-assets.emergentagent.com/.../LBPP1.png` y guardado como `/bruno-official.png` (~97 KB)

**Archivos reemplazados** (el contenido del archivo cambia, las refs en codigo NO):
- `/bruno-mascot.png` → nuevo logo
- `/bruno-icon.png` → nuevo logo
- `/bruno-badge.png` → nuevo logo (creado para push notifications)
- `/mascots/bruno-icon.png` → nuevo logo (defensivo)

**Sin tocar** (logo wordmark "BRUNO" para el nav superior izquierdo):
- `/bruno-logo.png` → mantiene su diseño original con el nombre BRUNO escrito
- Refs en `Dashboard.jsx`, `FeedPage.jsx`, `LandingPage.jsx`, `HelpPage.jsx`, `PricingPage.jsx`, `ContactPage.jsx` se mantienen

**Refactor selectivo**:
- `BrunoMascot.jsx`: reemplazo `bruno-mascot.webp` → `bruno-mascot.png?v=8` (5 ocurrencias)
- `BrunoMascot.jsx`: reemplazo `/mascots/bruno-logo.png` → `/mascots/bruno-icon.png?v=8` (2 ocurrencias)

**Index.html**:
- 4 links de favicon agregados: `icon` (32x32, 192x192), `shortcut icon`, `apple-touch-icon` — todos a `/bruno-mascot.png?v=8`

**Manifest.json** (PWA):
- Reescrito con 3 icon entries (192/512 any, 192 maskable) apuntando a `/bruno-mascot.png?v=8`
- `theme_color: "#FF6B35"` conservado (naranja BRUNO)

**Verificacion**:
- Screenshot Login: card con nuevo logo mascot visible
- Screenshot Feed: top-left mantiene wordmark "BRUNO" original sin cambios
- `document.querySelectorAll('link[rel*="icon"]')` devuelve 4 entradas con la nueva URL

## Phase 53: Stripe PIUP + Story Reactions Push + Highlights + Story Rings (2026-05-20)

### Backend
- **Stripe checkout PIUP** (`routers/piup.py`):
  - `POST /api/piup/checkout` — crea orden en `piup_orders` con status `pending_payment`, dispara `StripeCheckout.create_checkout_session()` con metadata `{user_id, order_id, product_id}`, devuelve `checkout_url`
  - `GET /api/piup/checkout/status/{session_id}` — polling de estado tras redirect; actualiza `piup_orders` con `payment_status: paid` cuando Stripe lo confirma
  - Fallback elegante: si `STRIPE_API_KEY` no configurado → 503 + orden guardada con `payment_status: manual`
  - Verificado curl: devuelve URL real de Stripe `cs_test_a1zGWhqmQIGsQPKJVSC68...`
- **Push de reaccion a historia** (`routers/stories.py`):
  - `POST /stories/{id}/react` ahora dispara `notify_story_reaction(user_id, reactor_name, emoji, story_id, avatar)` como fire-and-forget si no es el propio dueno
- **Saved Stories / Highlights** (`routers/stories.py`):
  - `POST /stories/{id}/save` — guarda en coleccion `story_highlights` con collection name (idempotente con upsert)
  - `DELETE /stories/{id}/save` — quita del highlights
  - `GET /stories/highlights/{user_id}` — publica colecciones agrupadas con cover/count/items
  - `PATCH /stories/highlights/{id}` — renombrar coleccion / cambiar cover
  - `DELETE /stories/highlights/{id}` — eliminar item individual
  - `GET /stories/active-users?user_ids=...` — devuelve mapa user_id→count de historias no expiradas (para anillo)

### Frontend
- **`<StoryRing>`** (`components/bruno/StoryRing.jsx`) — wrapper para avatares con anillo conic-gradient (naranja→rosa→purpura) cuando hay historia activa, gris cuando ya vista. Tap dispara `onOpen`.
- **`useActiveStories`** (`hooks/useActiveStories.js`) — hook que consulta `/active-users` para una lista de IDs y expone `openStories(uid)` que carga + abre BrunoStoryViewer.
- **`<HighlightsSection>`** (`components/bruno/HighlightsSection.jsx`) — seccion Instagram-style en perfil:
  - Scroll horizontal de coleccion covers con gradiente conico purpura→rosa→naranja
  - Botón "+ Nueva" (owner) que solicita nombre de coleccion y guarda la story mas reciente
  - Disclosure "Gestionar destacadas" con boton eliminar por item
  - Click en coleccion → abre BrunoStoryViewer con items de la coleccion (incluso despues de 24h)
- **`MyProfilePage`** integrado:
  - Avatar envuelto en `<StoryRing hasActive={...} size={96}>` que abre BrunoStoryViewer real
  - `<HighlightsSection isOwner>` entre PointsWidget y tabs
  - BrunoStoryViewer montado al final del componente
- **`PiupProductConfigurator`** — `submit` ahora intenta `/piup/checkout` primero (redirige a Stripe), fallback elegante a `/piup/request-physical` si Stripe devuelve 503

### Verificacion
- curl: Stripe checkout 200 con URL real, active-users {user_id: 1}, save → "Demos" coleccion, get highlights total_items: 1
- screenshot: anillo gradient visible, "Historias destacadas — 1 guardadas", coleccion "Demos · 1 story" + boton "+ Nueva"

## Phase 52: Correcciones criticas - Cámara/Video, Foto Perfil, Stories (2026-05-20)

**Bug 1: Subir videos al Feed fallaba silenciosamente**
- `CreatePost.jsx`: ahora detecta `file.type.startsWith("video/")` y enruta videos a `/upload/chat-file` (Cloudinary `resource_type=video`). Antes se enviaba todo a `/upload/image` con transformaciones que solo aplican a imágenes.
- Botones "Imagen" y "Video" ahora resetean correctamente el atributo `accept` del input.
- `routers/uploads.py` → `/upload/image` ahora detecta `content_type` y:
  - Si video: usa `resource_type="video"` sin transformaciones
  - Si imagen: aplica transformaciones (1200x1200 limit, quality auto:good)
- Verificado vía curl: video mp4 sube con resource_type=video, format=mp4, duration=1.0s

**Bug 2: Foto de perfil no persistía al salir sin Guardar**
- `EditProfilePage.uploadAvatar`: ahora llama `PUT /api/profile` inmediatamente después del upload con `{...profile, avatar_url: url}` para fijar el cambio en DB sin requerir click en "Guardar"
- Si el auto-save falla, fallback al comportamiento anterior con toast informativo
- Verificado: upload → PUT /profile → GET /profile devuelve nuevo avatar_url persistido

**Bug 3: "Ver historia" no abria nada**
- `EditProfilePage`: el botón `avatar-menu-stories` navegaba a `/my-profile?tab=stories` (ruta sin handler). Ahora:
  - Llama `GET /api/stories/user/{user.id}` directamente
  - Si hay stories, abre `<BrunoStoryViewer>` inline con el data correcto
  - Si no hay stories, toast informativo "No tienes historias activas"
- Loading state con `Loader2` reemplazando el icono Sparkles mientras carga
- Verificado vía screenshot: menu abre → click "Ver historia" → viewer aparece con video, header del usuario, barra de progreso, reacciones y botón Responder funcionando

**Backend (`routers/piup.py`, 350 lineas):**
- Catalogo completo de **19 productos PIUP** seedeados in-memory con campos: id, name, category, schema_id (link a NFC schema), styles (codigos C/U/R + 1..7), base_price
- Tabla de tamanos: 1=1x1cm, 2=3x3cm, 3=5x5cm, 4=7x7cm, 5=R3x5cm, 6=R4x7cm, 7=R ID (85x55mm)
- 9 colores disponibles (negro, blanco, naranja, dorado, plateado, azul, verde, rojo, holografico)
- 4 categorias: Hogar (5), Restaurantes y comercios (3), Oficinas (10), Mascotas (1)
- **Endpoints:**
  - `GET /api/piup/catalog` — productos con filtros opcionales `?category=` y `?style=`
  - `GET /api/piup/sizes` — tabla de tamanos + formas + colores
  - `GET /api/piup/my-tags` — JOIN cards + nfc_cards con summary (physical/digital_only)
  - `POST /api/piup/request-physical` — crea orden en `piup_orders` con validacion de estilo permitido
  - `GET /api/piup/orders` — historial de pedidos
  - `POST /api/piup/activate-by-qr` — vincula NFC ↔ card, dispara WS event `piup_activated`

**Frontend (`pages/PiupManagerPage.jsx` + `components/piup/*.jsx`):**
- `PiupManagerPage` (ruta `/piup`) — header con conteos (fisicos/digitales) y 3 tabs animados con `motion.div` layoutId
- **MisTagsTab**: grid de tarjetas con badge "PIUP fisico" o "Solo digital", botones "Solicitar PIUP" / "Renovar" / "Ver", CTA a Activar
- **ActivarPiupTab**: escaner QR con `jsQR` + camera environment (1280px), parse de URL/plain payload, fallback manual; flujo 3 pasos (Escanear → Elegir tarjeta → Confirmar); ring + scanline animados
- **TiendaPiupTab**: filtros por categoria + forma (C/U/R), grid de 19 productos
- **PiupProductCard** + **PiupProductConfigurator**: configurador modal con StylePills (forma+tamano), color picker (9), card link select, qty stepper, total dinamico

**Real-time (Phase 3):**
- `activate-by-qr` dispara `asyncio.create_task(_broadcast_activation())` → `ws_manager.send_personal_message({"type":"piup_activated",...})`
- `PiupManagerPage` se suscribe via `useRealtimeNotifications().subscribe()` y refresca `my-tags` automaticamente
- QR del producto fisico + NFC chip ambos resuelven a la misma URL `/c/{card_id}` (unificacion); endpoint NFC `/api/nfc/go/{nfc_id}` redirige al mismo destino que el QR generado por `/api/cards/{card_id}/qr`

**Dependencias:**
- `jsqr@1.4.0` agregado para escaner QR client-side

**Verificacion:**
- Backend curl: catalog (19 productos), my-tags (summary correcto 1 fisico/2 digital), request-physical valida estilo + crea orden, activate-by-qr retorna redirect_url + nfc_endpoint
- Frontend screenshots: 3 tabs funcionando, configurador modal abre al hacer click en producto

## Remaining Backlog (post-51)
- server.py: extraer AI routes, Cards, Stripe (~1500 lineas)
- FeedPage.jsx (882) + MyProfilePage.jsx (953) breakdown
- Cablear `notify_story_reaction` en BrunoStoryViewer + `notify_incoming_call` en `/calls/start`
- ProfileSpecificFields.jsx (>1000 lineas) breakdown
- Integrar pago Stripe en flujo "Solicitar PIUP" (actualmente crea orden pendiente sin checkout)
- Generar QR del PIUP fisico apuntando a `/api/nfc/go/{nfc_id}` (consistencia QR ↔ NFC en print-on-demand)

**Feature: "Tu tarjeta cobro vida"** — el dueño recibe una push enriquecida cada vez que alguien escanea su NFC.

**Implementación:**
- `routers/push_notifications.py` → nuevo helper `notify_nfc_scan(user_id, card_id, card_title, card_image, nfc_id)`:
  - Title: "Tu tarjeta cobro vida"
  - Body: `«{card_title}»`
  - `image`: banner_url o avatar_url de la card → preview rico en móvil
  - Action única: "Ver analitica" → deep-link a `/c/{card_id}/analytics`
  - Tag `nfc_scan_{nfc_id}` → notificaciones se reemplazan en lugar de apilarse (anti-spam)
- `routers/nfc.py` → helper interno `_fire_nfc_scan_push` con `asyncio.create_task` (fire-and-forget) cableado en:
  - `GET /nfc/go/{nfc_id}` (302 redirect — entry primario)
  - `GET /nfc/resolve/{nfc_id}` (JSON)
  - Nunca bloquea el redirect del usuario que escanea; errores se loguean como warning
- `public/sw.js` → v8: handler para action `view_analytics` + matcher para tags `nfc_scan_`
- Subscripciones expiradas (410 Gone) se limpian automáticamente vía la lógica existente de `send_push_notification`

**Verificación end-to-end:**
- Activar NFC: 200 ✓
- `/nfc/resolve/{id}`: 200 con card data ✓
- `/nfc/go/{id}`: 302 → redirect a `/c/{card_id}` ✓
- Logs muestran que el push se dispara correctamente (410 Gone solo porque la sub de testing esta vencida — el código limpia automáticamente)


## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet
- Emergent Google Auth, DEAL App (Hybrid API/Webhook)
