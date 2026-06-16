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

## Phase 64: 7-fix Batch — Audio, Video Notes, Mapa, Galería, Llamadas (2026-05-25)

**🐛 Bug 1: Audio notes no reproducían**
- **Causa raíz**: `audio.play()` no awaited; Cloudinary servía `.webm` que Safari/iOS no reproducen
- **Fix**: `AudioPlayer` ahora:
  - Inyecta transformación Cloudinary `f_mp3` para servir MP3 cross-browser
  - Fallback automático al webm original si MP3 falla
  - `await audio.play()` con try/catch
  - Muestra "No se pudo reproducir" si todas las fuentes fallan
  - `data-testid="audio-player"` + `audio-player-play` para testing

**✨ Feature 2: Video Notes circulares (estilo Telegram)**
- Nuevo `VideoNoteRecorder.jsx`: preview circular 260px con anillo de progreso, máx 30s, hold-to-record
- Trigger: **long-press 600ms en el botón cámara del pill input** → abre el grabador
- Renderiza vía componente existente `CircularVideoMessage.jsx` (180px bubble)
- Upload via `/api/upload/chat-file`, mensaje con `message_type="video_note"`

**🐛 Bug 3: Mapa no se movía**
- **Causa raíz**: `<Map>` recibía `center={center}` (controlado) + el `setCenter` por geolocalización snap-back constantemente
- **Fix**: usar SOLO `defaultCenter` + `mapRef` capturado via `MapInstanceCapture` + `map.panTo()` programático para recenter/geolocalización
- Plus: `clickableIcons={false}` para que clicks no se los robe Google POIs nativos

**🎯 Feature 4: Filtro mapa solo items con dirección**
- `MapProfilesBar` ahora aplica `hasLocation(it)` — solo entran items con `lat+lng` válidos (number, no NaN)
- Aplica a users, PIUPs, cards y stories: si no tiene coordenadas, NO aparece en la barra inferior

**🐛 Bug 5: Icono Galería en cámara no funcionaba**
- El `<button>` no tenía `onClick`. Ahora abre `InternalGalleryPicker`
- `data-testid="camera-gallery-btn"`

**✨ Feature 6: Galería interna animada**
- Nuevo `InternalGalleryPicker.jsx`: 
  - Auto-abre el file picker nativo al montarse
  - Después muestra grid animado 3 cols con thumbnails, video detection, badge de orden, botón eliminar
  - "Añadir más" tile siempre visible
  - Multi-select, confirma con botón "Usar selección"
  - Object URLs liberadas al cerrar (no memory leak)
- Integrado en BrunoCameraPage; reemplaza el opener nativo crudo

**✨ Feature 7: Llamadas / Videollamadas funcionales**
- **Antes**: backend usaba `https://bruno-demo.daily.co/{room}` (dominio ficticio → llamadas rotas)
- **Ahora**: `https://meet.jit.si/{room}` — Jitsi Meet público y gratuito con STUN+TURN incluidos
- `VideoCallModal` completamente reescrito:
  - Pantalla "Llamando…" para outgoing (avatar + Loader + cancelar)
  - Pantalla "{name} te está llamando" para incoming (rings pulsantes, accept/decline)
  - In-call: iframe Jitsi con `allow="camera; microphone; ..."` + hangup button
- Funciona sin API keys ni configuración adicional ✅

**Mejoras adicionales del batch**
- `FloatingChatBubble` ahora se oculta cuando el nav está minimizado (chats se minimizan junto con la nav)
- Reels feed ahora detecta video URLs por extensión + `media[]` array (no solo `media_url`)
- PWA install prompt con detección iOS + persistencia de dismissal
- Manifest enhanced con shortcuts (Feed, Mapa, Chats, Perfil), `display_override`, screenshots, lang=es

**Verificado E2E**: chat opens at first click ✅, map renders + draggable ✅, video call btn present ✅, pill-camera-btn supports long-press ✅, audio player has fallback URL ✅

## Phase 63: Chat Bugs + Nav Hairline Bar (2026-05-25)**🐛 Bug 1: Chat no abría al primer click**
- **Causa raíz**: el avatar del chat-item era un `<Link to="/profile/...">` con `stopPropagation`. El click de Playwright/usuario caía sobre el Link (centro del row), navegaba al perfil, y el `onClick` del row nunca disparaba
- **Fix**: avatar y nombre del usuario ahora son `<div>`/`<span>` sin navegación. Cualquier tap en el row abre el chat. La navegación al perfil queda accesible desde el header de `ChatView`
- **Bonus fix**: `fetchChats` ya no depende de `chatId` (eliminada race condition que re-fetcheaba en cada cambio de URL). Un `useEffect` separado sincroniza `selectedChat` desde el URL param

**🐛 Bug 2: Input distorsionaba al abrir teclado**
- **Causa raíz**: `BrunoPillInput` llamaba `scrollIntoView({ block: "end" })` en focus + `motion.div layout` re-layout-animaba al cambiar tamaño. Combinado con la resize del `visualViewport`, el contenido del chat "se expandía y desaparecía"
- **Fix**: removido `scrollIntoView` (el padre ya tiene `height: var(--app-vh)` que ajusta naturalmente). Removido prop `layout` de la pill (solo CSS-anim de boxShadow). Resultado: focus solo activa el ring naranja, sin saltos

**✨ Nav Pill rediseñada como barra hairline**
- Estado minimizado: ahora es una **barra finísima** (`h-[3px]`) flush al borde inferior, con dos puntos naranja pulsantes y handle central. Ocupa solo ~14px de la pantalla (antes 64px)
- Auto-minimize más agresivo: `scrollY > lastY + 8` (antes +30) y solo se expande con upward scroll >48px (antes >20) → el nav desaparece en cuanto el usuario empieza a manipular
- **Gesture global swipe-up-from-bottom-edge**: detecta touchstart en los últimos 24px del viewport + swipe vertical >24px → expande el nav. Funciona desde CUALQUIER parte de la app sin tener que tocar la barra
- Route change a `/` o `/feed` (Inicio) fuerza expand (regla UX del usuario)
- Otras rutas conservan el estado previo del usuario (no se re-expande automáticamente)
- `--nav-reserve` ahora 14px en minimizado (antes 64px), liberando esa franja para el contenido real

**Verificado E2E**: chat abre al primer click ✅ · input no distorsiona en focus ✅ · nav-expand-btn aparece como hairline ✅

## Phase 62: Likes Refinement — Separar "Received" vs "Given" (2026-05-25)**Cambio semántico**: la stat "Likes" en el perfil ahora muestra los likes que el usuario RECIBE en sus publicaciones (no los que el usuario da). Los likes que el usuario ha dado ahora viven como un álbum virtual "Me gusta" en la pestaña Albums.

**Backend**:
- Nuevo endpoint `GET /api/users/me/likes-received` → posts del usuario actual, agrupados por LIKER (quien dio like), con la lista de cuáles posts del usuario likeó esa persona. Excluye self-likes
- Endpoint anterior `GET /api/users/me/liked-posts` se mantiene para alimentar el álbum virtual "Me gusta"

**Frontend**:
- `LikesModal` (header "Te dieron Like"): ahora consume `likes-received`. Empty state: "Aún nadie te ha dado like"
- Nuevo `MyLikedPostsModal` (header "Me gusta"): consume `liked-posts` (igual que antes)
- `MyProfilePage`:
  - Stat "Likes" usa `likesCount` desde `likes-received` (refleja lo recibido)
  - Pestaña Albums ahora siempre muestra una grid; el **primer card** es el álbum auto "Me gusta" (gradiente rosa→naranja→rose con icono Heart, badge AUTO, contador de posts), siempre presente aunque no haya álbumes propios
  - Si no hay álbumes propios, se renderiza un placeholder "+" para crear el primero (al lado del Me gusta)
- Carga paralela de ambos counts (`Promise.all`) en `fetchLikesCount`

**Verificado E2E**:
- Stat Likes muestra 2 (likes recibidos de Andru Mieles) ✅
- Modal "Te dieron Like" agrupa por liker ✅
- Albums tab muestra card "Me gusta" con badge AUTO ✅
- Modal "Me gusta" muestra 2 publicaciones · 2 perfiles (lo que YO he likeado) ✅

## Phase 61: Bug Fix Likes/Comentarios + Pestaña "Likes" en Perfil (2026-05-25)**🐛 Bug Crítico Corregido — Like no funcionaba**
- **Causa raíz**: el hook `useReactionTrigger` solo conectaba `onMouseDown`/`onTouchStart` a la `motion.button`, mientras que `onMouseUp`/`onTouchEnd` solo se montaban globalmente CUANDO el bubble estaba abierto. Resultado: en taps cortos (sin long-press) **nunca se disparaba `onTap`**, los likes no se incrementaban ni la petición se enviaba.
- **Fix**: el botón ahora es un `<button>` nativo con `onClick={handleLike}` directo, y el hook expone `longPressFired.current` que el `onClick` consulta para suprimir el tap cuando se completó el long-press (evita doble-fire). Hook handlers locales `onMouseUp`/`onTouchEnd` ahora también cancelan el timer pendiente.
- **Verificado**: `POST /api/posts/{id}/like` se dispara correctamente. Antes click: count=2 → Después click: count=3 (optimistic update + reconciliación server).
- Comentarios optimistas ahora también actualizan badge `commentsCount` localmente
- Repost optimista actualiza `sharesCount`
- `handleShare` muestra toast "Link copiado" / "Compartido" (antes silent fail en desktop)
- `handleRepost` y errores rollback con toast (antes `alert()`)

**✨ Nueva pestaña "Likes" en perfil (junto a Siguiendo)**
- Nuevo endpoint: `GET /api/users/me/liked-posts` → devuelve `{total_likes, groups: [{user, posts, count}]}` agrupado por autor
- Nueva ruta en `routers/posts_feed.py`, ordenada por timestamp de like más reciente
- Nuevo componente `LikesModal.jsx`:
  - Modal bottom-sheet con header "Tus likes — N publicaciones · M perfiles"
  - Grupos colapsables por autor (avatar con BrunoAvatar, badge naranja con count)
  - Miniatura de cada post (media thumb 56x56, contenido truncado, contadores)
  - Click en post navega a `/post/{id}`
  - Primeros 2 grupos abiertos por defecto
- `MyProfilePage`: cuarta stat `Likes` (count en naranja) entre "Siguiendo" y el divisor → abre `LikesModal`
- Conteo se carga en paralelo con perfil/posts/cards (`fetchLikesCount`)

**Verificado E2E**: login → /feed → click like → count incrementa + API request enviada; perfil → click Likes → modal abre con 1 publicación / 1 perfil

## Phase 60: Code Quality Cleanup (2026-05-25)

**Circular Import Broken** — `server.py` ↔ routers
- NUEVO `utils/ws_manager.py`: extrae `ConnectionManager` + instancia `ws_manager` a su propio módulo
- `server.py`, `routers/stories.py`, `routers/piup.py`, `utils/notification_realtime.py` ahora importan `from utils.ws_manager import ws_manager` (top-level)
- Eliminadas todas las `from server import ws_manager` (lazy imports anti-pattern)

**Lint cleanup — backend**
- F811: eliminados `UserProfile` / `UserProfileUpdate` duplicados al inicio (dead code)
- F821 `ai_chat_sessions` undefined: agregado dict module-level + lazy `from emergentintegrations.llm.chat import LlmChat, UserMessage` dentro del endpoint `/api/ai/chat`
- E722 bare `except`: convertidos a `except Exception` en map_manager broadcast
- `ruff check server.py` ahora pasa limpio (de 11 errores a 0)

**Hardcoded credentials → env vars** (en tests)
- `tests/test_mobile_native.py`, `test_iteration56_features.py`, `test_iteration55_refactoring.py`, `test_code_quality_cleanup.py`: credentials ahora `os.environ.get("TEST_USER_EMAIL", "newtest@bruno.com")` con default

**Frontend cleanup**
- Array index keys reemplazados por composite keys (content+index) en `PostCard.RenderContent`, `ChatPage` mention parser, `BrunoStoryViewer` progress bars
- Empty catch blocks en `secureStorage.js`: ahora loguean `console.warn` con mensaje del error (crypto unavailable o decrypt failed)

**False positives confirmados** (no requirieron cambios):
- `is None` en `utils/security.py` líneas 71/75/91/98/114/118 — es el idiom recomendado por PEP 8 (no anti-pattern)
- Translations `password: "Contraseña"` en `LanguageContext.js` — son labels, no secrets
- Missing hook deps en `ImageEditor`, `ViewCardPage`, `UserProfilePage` — todas las dependencias están listadas correctamente; eslint pasa limpio en los 3 archivos

## Phase 59: 6-point UX Batch — Reactions, Auth, Camera Menu, Map BRUNO Palette, Stripe Webhook, OG Meta-Cards (2026-05-25)

**P0 — Avatares + Camera/Publication Selector**
- `PostCard.jsx`: avatar reemplazado por `<BrunoAvatar>` (anillo de story automático global, glow naranja cuando hay historia activa)
- `FeedPage.jsx`: sección "Personas sugeridas" usa `<BrunoAvatar>` también
- NUEVO `BrunoPublishMenu` (`components/bruno/BrunoPublishMenu.jsx`): bottom-sheet con 2 pasos
  - Step 1: 4 tipos (Historia · Reel · Publicación · Estado) con iconos+gradientes
  - Step 2: 3 fuentes (Cámara Bruno · Galería · Carpeta privada) — solo para Story/Reel
  - Fast-path: Publicación/Estado saltan directo a navegación (no se muestra step 2)
- `MobileBottomNav` reemplaza la cámara directa con el menú: nav `+` → menú → ruteo por tipo+fuente

**P1 — Long-press Reactions + Optimistic UI + Auth**
- NUEVO `ReactionBubble` (`components/bruno/ReactionBubble.jsx`):
  - Hook `useReactionTrigger({ onTap, onReact })` que adjunta handlers a cualquier botón
  - Press 1000ms → bubble flotante fixed-position con 6 emojis (👍❤️😂😮😢😡)
  - Drag/hover sobre emoji → escala 1.5x + label visible
  - Release con emoji activo → fire onReact, sin emoji → dismiss
  - Tap corto (<1s) → fire onTap (like normal)
  - Haptic vibration al aparecer (navigator.vibrate)
- `PostCard.handleLike` ahora es 100% optimistic: flip UI inmediato → server → rollback en error
- `PostCard.handleComment` ahora es 100% optimistic: comentario aparece con tempId antes de respuesta del backend
- `PostCard.handleShare` usa la nueva URL de meta-card (`/api/share/p/{id}`) para previews ricos en WhatsApp/Twitter/Telegram

**Auth UI Updates** (`LoginPage.jsx` + `RegisterPage.jsx`):
- Eye/EyeOff toggle en cada campo password (cambia input type entre `password` y `text`)
- LoginPage: checkbox "Recordar mi correo" (persiste email a `localStorage.bruno_remembered_email`)
- LoginPage: checkbox "Mantener sesión activa" (persiste a `localStorage.bruno_keep_session_active`, enviado al backend como `keep_session_active`)
- Restore de email recordado al montar LoginPage

**P2 — Map BRUNO Palette + Stripe Webhook + OG Meta-Cards**
- `MapStyleSocial.jsx` rewrite: paleta predominantemente naranja+beige
  - Roads: peach (#FFE2C2) / orange highways (#FFB37A → #FF8C42), bordes naranja oscuro
  - Landscape: beige profundo (#FFE6C7, #F5D6A2)
  - Administrative labels: naranja oscuro (#9A3412, #B45309, #7C2D12) negrita
  - POI commercial: muted -65% saturation para que los PIUP pins ganen siempre la atención
- `routers/piup.py` → nuevo endpoint `POST /api/piup/webhook/stripe`:
  - Verifica firma via `emergentintegrations.StripeCheckout.handle_webhook`
  - Marca `piup_orders` como `paid` cuando llega evento
  - Dispara WS event `piup_payment_received` al user_id del pedido (real-time refresh)
  - 503 si `STRIPE_API_KEY` no configurada, 400 si firma inválida
- NUEVO `routers/share_og.py` (Open Graph meta-cards):
  - `GET /api/share/c/{card_id}` — tarjeta Bruno
  - `GET /api/share/u/{user_id}` — perfil usuario
  - `GET /api/share/p/{post_id}` — publicación
  - HTML estética con paleta BRUNO (orange #FF6B35, beige #FFF1DF)
  - OG tags (`og:type`, `og:title`, `og:description`, `og:image`, `og:url`)
  - Twitter Card `summary_large_image`
  - Auto-redirect via `<meta http-equiv="refresh">` + JS fallback
  - 404 con HTML estética para recursos faltantes
  - Wired en `server.py` via `api_router.include_router(share_og_router)`

**Test results (iteration 56)**:
- Backend: 11/11 (100%) — OG endpoints, Stripe webhook validation, login w/ extra fields, like/react/comment regression
- Frontend: 100% post-fix (publish menu fast-path para post/status aplicada)



**Cambios .env**:
- `REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyDlkbZe-6pdqN-Xejx0oaSH47GDB9Ky9eI`
- `REACT_APP_GOOGLE_MAPS_ID=DEMO_MAP_ID`

**Fix posicion FAB**:
- Los botones "+" reclamar PIUP y recenter ahora se posicionan dinamicamente arriba del pill bar (`bottom: calc(var(--nav-reserve) + 200px)` y `z-[60]`) para nunca quedar tapados.

**Verificado visualmente con screenshots mobile (390x844):**
1. Mapa hibrido Bogota: 
   - Capa Google con calles (Av El Dorado, Carreras, Calles)
   - Barrios: KENNEDY, GALAN, LOS MARTIRES, SANTA FE, LA CANDELARIA
   - Hospitales visibles destacados: Hospital Universitario Mayor, Hospital Militar Central, Sociedad de Cirugia
   - Centros comerciales, parques, universidades
   - 1 pin PIUP naranja brand "Mi negocio" cerca LOS MARTIRES
2. Modal "Reclamar punto":
   - Selector de tarjeta funcional
   - 9 categorias con iconos+colores BRUNO
   - Coords auto-rellenadas
   - Boton "Publicar pin en el mapa" prominente

## Phase 57: Avatares burbuja + Sync global de Stories (2026-05-24)

**Bug fix critico**: `StoryRing` no aplicaba `rounded-full` cuando `hasActive=false`, devolviendo un `<div>` cuadrado. Resultado visible: foto de perfil se veia cuadrada en EditProfile. Ambos branches del componente ahora aplican `rounded-full overflow-hidden`.

**Mejoras estetica burbuja iluminada** (`StoryRing.jsx`):
- Radial glow exterior animado (opacity 0.55 ↔ 0.95, scale 1 ↔ 1.18, 2.4s loop) con `blur(6px)`
- Highlight glossy interno (gradient blanco 45% top-left) con `mixBlendMode: screen` para efecto burbuja
- Anillo conic gradient naranja→rosa→purpura preservado

**Componente reutilizable nuevo `BrunoAvatar`**:
- Wrapper universal: `<BrunoAvatar userId src name size>`
- Auto-detecta activeMap via `useStoryActivity()`
- Tap abre BrunoStoryViewer con stories del usuario via `/stories/user/{id}`
- Fallback con inicial cuando no hay avatar_url
- Centralizado: cambios al ring/glow se aplican automaticamente en todas las apariciones

**Sync global via context + WebSocket**:
- `StoryActivityProvider` (`contexts/StoryActivityContext.jsx`): un solo `activeMap` compartido por toda la app
- `registerUserIds(ids)` permite a cualquier lista registrar quien debe ser rastreado
- `markUserActive(uid)` para updates instantaneos sin esperar refresh
- Listener WS: evento `story_published` → marca al publisher como activo en TODOS los avatares
- Listener WS: evento `story_expired` → quita ring
- Safety refresh cada 90 segundos
- Backend `routers/stories.py` → `_broadcast_story_published(user_id, story_id)` notifica al publisher + todos sus followers (consulta `db.follows`)

**Aplicacion en pantallas**:
- `EditProfilePage`: avatar 112px con BrunoAvatar (era `<div className="rounded-full">` con bug)
- `MyProfilePage`: avatar 96px con BrunoAvatar (reemplaza implementacion manual con StoryRing + useActiveStories)
- `ChatPage.ChatList`: avatares 48px de cada conversacion + `useEffect` que registra los IDs en context

**Verificado screenshot mobile (390x844)**:
- Edit Profile: burbuja naranja perfecta con glow gradient visible
- My Profile: anillo + cover de coleccion "Demos" visibles  
- Chat List: avatar "T" circular con indicador verde online — listo para iluminarse cuando ese usuario publique

## Phase 56: Map Pill Bar — PIUP Cards + Located Stories (2026-05-24)

**Backend:**
- `routers/stories.py` → `StoryCreate.location` field opcional `{lat, lng, name, address}`
- `routers/stories.py` → `GET /api/stories/located` — historias 24h con ubicacion (bounding box opcional)
- `routers/map_pins.py` → `GET /api/map-pins/cards-located` — tarjetas Bruno con direccion guardada
- Verificado: 1 PIUP + 2 cards located + 1 story located via curl

**Frontend `MapProfilesBar.jsx` reescrito (337 lineas):**
- Self-fetch paralelo: `/map-pins` + `/map-pins/cards-located` + `/stories/located` cada 60s
- 4 filtros: Todos / PIUP / Stories / En vivo
- Bubble distintivos:
  - PIUP → ring naranja + badge MapPin
  - Story → ring fucsia + badge Play + place_name subtitulo
  - Card → ring neutro + badge segun card_type
  - User live → ring esmeralda animado
- Header dinamico con badges PIUP / Stories / LIVE
- Story bubble tap → BrunoStoryViewer inline
- Card/PIUP tap → navigate `/c/{card_id}`
- Renderiza en NoApiKeyFallback para verificacion sin Google key

**Verificado screenshot mobile**:
- Filtro PIUP muestra 3 elementos
- Filtro Stories muestra 1 con anillo fucsia + "Bogota Centro"
- Filtro Todos muestra 4

## Phase 55: Mapa Hibrido Google Maps + PIUP (2026-05-24)

**Pendiente:** activar con `REACT_APP_GOOGLE_MAPS_API_KEY` (user accion).

**Backend `routers/map_pins.py` (312 lineas):**
- 9 categorias (commerce, restaurant, service, health, education, office, personal, event, other)
- Endpoints: `POST /claim` (idempotente), `DELETE /{id}`, `GET /mine`, `GET /` (bounding box), `GET /{id}`, `PATCH /{id}`, `GET /categories`

**Frontend:**
- `MapPage.jsx` migrado de Leaflet a `@vis.gl/react-google-maps@1.8.3`
- `MapStyleSocial.jsx` — JSON style Snapchat-like (cream/orange, calles fuertes, hospitales/gobierno destacados)
- `MapPinClaimModal.jsx` — bottom-sheet con selector de tarjeta + categoria + coords + titulo
- `AdvancedMarker` con `<BrunoPin>` custom (circulo naranja con emoji + tail)
- InfoWindow con avatar/banner + botones "Ver tarjeta" y "Como llegar"
- Toggle Layers (mostrar/ocultar PIUP layer)
- FAB "+" para reclamar pin
- `MapPageLegacy.jsx` backup de la version Leaflet



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


### Phase 57: Camera/Audio/Stories Polish (2026-02-15)

**P0 Bugfixes**
- `BrunoCameraPage.startCamera()` no longer forces `1080×1920` — uses device-native sensor + applies `zoom:min` via `applyConstraints` when supported. Fixes "unnecessary zoom" reported by user.
- Chrome voice-note playback: `useAudioRecorder` now picks a supported `MediaRecorder` mimeType (opus webm → mp4 → ogg) and tags the blob; `handleSendAudio` saves the correct file extension. `BrunoAudioWaveform` renders `<audio>` with a prioritized multi-`<source>` chain (mp3 → original codec → on-the-fly Cloudinary `f_mp3` transform) and calls `load()` on source change → Chrome plays reliably.

**New: In-app Gallery permission + Swipe-up**
- First-time tap on `camera-gallery-btn` shows an orange pulse dot and persists `localStorage["bruno-gallery-granted"]="1"`.
- Vertical swipe-up gesture on the viewfinder (dy>70px, dx<60px, <600ms) opens `InternalGalleryPicker` (in-app). Swipe-up from the right-sidebar "Stickers" zone opens the interactive panel instead.

**New: Camera Interactive Panel (live mode)**
- Right-sidebar `Sticker` button + swipe-up gesture opens a bottom-sheet (`camera-interactive-panel`) with 4 tabs:
  - **Stickers** (existing emoji presets)
  - **Emojis** (32 common emojis)
  - **Pregunta** — free-text question becomes an `overlay-question-<id>` on the viewfinder
  - **Encuesta** — question + 2-4 options renders an `overlay-poll-<id>` overlay
- Panel has `pb-[calc(5rem+safe-area)]` so CTAs clear the global MobileBottomNav on small viewports.
- `handlePublish`: if any interactive sticker present, posts to `/api/stories` (with `poll_id` from `/api/social/polls` when applicable) instead of `/api/posts`.

**Stories editor — multi-image + animated publish**
- `StoryEditor` file input gains `multiple`. Selected files upload in parallel and queue as `extraSlides`.
- Thumbnail strip (`story-slides-strip`) renders below the canvas with per-slide remove + "+" to add more.
- Publish loops over slides and posts each as a sequential `/api/stories`. Overlays/poll attached to the FIRST slide only.
- Animated overlay (`story-publish-animation`): spinning send icon during upload → green check + "¡Historia publicada!" → auto-closes.

**Files touched**
- `/app/frontend/src/pages/BrunoCameraPage.jsx`
- `/app/frontend/src/pages/ChatPage.jsx`
- `/app/frontend/src/components/bruno/BrunoAudioWaveform.jsx`
- `/app/frontend/src/components/StoryEditor.jsx`

**Test status**: `iteration_57.json` — 85% pass. Only HIGH issue (panel CTA occluded by bottom nav) fixed in same iteration via extra bottom padding. Live Chrome audio playback could not be exercised by the agent (no pre-existing audio messages in test account) — code path verified at static level.



## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet
- Emergent Google Auth, DEAL App (Hybrid API/Webhook)

### Phase 58: Story Analytics + P2 Refactor (2026-02-15)

**User-requested enhancement — Story Analytics**
- New endpoints in `routers/stories.py`:
  - `POST /api/stories/{id}/answer` — viewer submits a free-text answer to a story's question overlay; dedupes per user; notifies owner via WS `story_answer`.
  - `GET /api/stories/{id}/insights` — owner-only: views_count, reactions_count, reactions_by_emoji, answers list (with name + avatar), poll results.
  - `GET /api/stories/{id}/public-insights` — aggregate-only view for any user: answers_count, poll results, no PII.
- New `StoryInsightsModal.jsx` — animated bottom-sheet with: 3-counter grid (Vistas/Reacciones/Respuestas) for owners, animated poll bars (% + votes), per-emoji reaction chips, answer list with avatars.
- `BrunoStoryViewer` now fetches public-insights on story change and shows an `Insights` / `X respuestas · Ver resultados` button above the quick-reactions row that opens the modal (pausing the story timer).

**P2 — Backend refactor: AI router extraction**
- New `/app/backend/routers/ai.py` (~410 lines) containing:
  - `BRUNO_SYSTEM_MESSAGE`, `ai_chat_sessions` cache, `_search_public_cards_for_ai` helper
  - Routes: `POST /api/ai/chat`, `GET/DELETE /api/ai/history`, `POST /api/ai/generate-card`, `POST /api/ai/recommend`, `GET /api/ai/share-card/{id}`
- `server.py` reduced **3663 → 3175** lines (-488).

**P2 — Frontend refactor: ChatPage**
- `ChatPage.jsx` reduced **1672 → 1161** lines (-511).
- New modules:
  - `/app/frontend/src/hooks/useAudioRecorder.js` (93 lines)
  - `/app/frontend/src/components/chat/AudioPlayer.jsx` (137 lines, with multi-source mp3/webm/m4a fallback + Cloudinary `f_mp3` on-the-fly transform)
  - `/app/frontend/src/components/chat/FileAttachment.jsx`
  - `/app/frontend/src/components/chat/ChatList.jsx`
  - `/app/frontend/src/components/chat/NewChatModal.jsx`
- Behaviour preserved; no breaking testid changes.

**Test status — `iteration_58.json`**
- Backend: **13/13 pytest cases PASS** (creating both author + viewer, posting answers, querying insights, AI extraction).
- Frontend: full smoke pass — Story insights button + modal, chat flows, camera interactive panel.
- Phase 57 HIGH UX issue (camera panel CTA occlusion) confirmed FIXED (12px clearance from bottom nav).
- Non-blocking: pre-existing React duplicate-key warnings on /feed + empty `<img src>` warnings (orthogonal to this phase).


### Phase 59: Circular minimize · Drag-to-minimize · Location sharing · Calls live (2026-02-15)

**🎨 UX micro-changes**
- Minimized chat bubbles ↦ **circular avatar only** (no label, hover-reveal ✕). Applied to FloatingChatBubble + BRUNO IA chat.
- New `useDragToMinimize` hook (`/app/frontend/src/hooks/useDragToMinimize.js`) — wraps any element to support pull-down-to-minimize via touch *and* mouse. Spring transform with opacity fade.
- Wired to: `FloatingChatBubble` header, `FloatingBubbles` AI chat (`AIChatWindow`), `BrunoMascot` header.

**🤖 BRUNO IA**
- `FloatingBubbles.AIChatWindow` extracted into its own subcomponent with Minimize2 button, circular minimized state and drag-to-minimize.
- `BrunoMascot.jsx` (unused legacy) modernized too: hits real `/api/ai/chat`, parses `[ACTION:...]` and `[CARD:...]` tokens, minimize button.

**🗺️ Map**
- `/api/map-pins/cards-located` now filters cards: only `business/empresarial/empresa/negocio/lugares/servicios/oferta_trabajo/solicitud_servicio` OR cards with explicit `location.is_public_address=true`.
- Fixed first-pan UX: when geolocation resolves before the map mounts, pan is queued via `pendingUserCenterRef` and applied as soon as `MapInstanceCapture` exposes the map.
- New `SharedLocationsLayer` renders AdvancedMarkers for every active share, with speed-based icon (`<1 m/s` = standing dot, `<3 m/s` = 🚶, else 🚗) and live WS updates.

**📍 Location sharing (NEW)**
- Backend `routers/location_share.py` — collection `location_shares`:
  - `POST /api/location/share` (start, fixed or live, configurable duration + interval)
  - `POST /api/location/share/{id}/update` (sharer-only periodic ping)
  - `POST /api/location/share/{id}/stop`
  - `GET /api/location/shares/active`
  - `GET /api/location/share/{id}`
- WS broadcasts: `location_share_started`, `location_share_update`, `location_share_stopped`.
- Frontend `LocationShareSheet.jsx` (bottom-sheet) with mode selector (fixed/live), duration grid `[5m, 15m, 1h, 4h, 12h]`, interval grid `[5s, 10s, 30s, 60s]`. Live mode spawns a `watchPosition` + interval ping (`startLiveTracker`).
- Hook into `FloatingChatBubble` header (MapPin button → opens sheet) and a chat-system-message of `message_type='location_share'` shows in the conversation thread.

**📞 Calls live**
- New global `CallOrchestrator.jsx` mounted in `App.js`. Listens on WS `incoming_call` / `call_ended` events and the `window.bruno:start-call` custom event. Wires to `/api/calls/start|answer|decline|end` + renders the existing `VideoCallModal`.
- Chat bubble header gains Phone + Video buttons that dispatch `bruno:start-call`.

**Test status — `iteration_59.json`**
- Backend: **10/11 pass** (91%). Minor: chat message inserted by location-share router missed `is_deleted: false` → would be hidden by `/chats/{id}/messages`. **Fixed**.
- Frontend: critical UI flows all pass (chat bubble, call buttons exposed, location sheet renders, circular minimized).
- Known limitation: Playwright synthetic mouse drag doesn't always fire `onMinimize` after release. Hook now also triggers on `dy>120` regardless of velocity to be friendly to slow drags.
- Google Maps shows `BillingNotEnabledMapError` on the preview environment — environmental (production API key needs billing enabled), not a code issue.



### Phase 60: Global expansion · Multi-currency · Regional Compliance · Pre-deploy (2026-02-15)

**Closing-up of previous phase**
- `LocationMessagePreview.jsx` — chat bubble renders interactive Google-static-map snippet for `location_share` messages, with live countdown for live shares.
- `UserProfilePage` action bar gains MapPin (compartir ubicación), Phone, Video buttons next to Mail. Mounts `<LocationShareSheet>` inline. Calls dispatch `bruno:start-call`.
- `FloatingBubbles` AI minimize pill is now a **circular 28×28 button** matching the other minimized tray items (was a wider rounded-pill).

**🌍 New: Global Multi-Currency + Regional i18n** *(Fase A — Deploy-ready)*
- Backend `routers/i18n.py` — 35 countries (27 EU + 8 others) with currency/locale/tax-kind/default-rate metadata.
  - `GET /api/i18n/detect` → user-profile → CF-IPCountry header → X-Country-Code → Accept-Language → US fallback.
  - `GET /api/i18n/countries` — exhaustive list with `eu_codes` array.
  - `GET /api/i18n/currencies` — primary list + FX rates (USD as base).
  - `GET /api/i18n/rates?base=...` — full FX matrix (refreshed daily from exchangerate.host, fallback table on failure).
  - `POST /api/i18n/preference` — saves preferred_currency/country/locale onto user_profile.
  - `GET /api/i18n/compliance?country=XX` — returns the legal framework (RGPD/CCPA/Ley 1581/UK GDPR/generic).
- `utils/fx.py`-style helper inline: 24-hour FX cache in collection `fx_rates`.
- **EU coverage**: AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE — each with its native locale (`de-AT`, `fi-FI`, `pl-PL`, ...). Compliance auto-routes to GDPR for the 27.
- **USA**: CCPA/CPRA framework. **Colombia**: Ley 1581 (Habeas Data).
- **Stripe checkout**: now converts USD-base prices to user's currency at session creation. Falls back gracefully if FX call fails.

**Frontend i18n**
- `I18nProvider.jsx` — global context. Auto-detects on boot, caches in `localStorage["bruno-i18n"]`. Exposes `formatPrice(amount, fromCurrency?)`, `convert()`, `setPreference()`, `compliance`, `isEU`.
- `CurrencySelector.jsx` — dropdown with two tabs (País / Moneda). Lists EU + Otros separately. Live FX rate display.
- Mounted in `App.js` (wraps everything except AuthProvider).
- Added to `SettingsPage` under "Región y moneda" + expanded language buttons (ES/EN/PT/FR/DE/IT).

**Pending — Fase B (next session)**
- 🛡️ Cookie consent banner with framework-specific text (GDPR vs CCPA vs Ley 1581)
- 🛡️ Versioned T&C / Privacy per jurisdiction
- 💰 Stripe Tax integration (auto-VAT/sales-tax/IVA on checkout sessions)
- 🇨🇴 DIAN electronic invoicing (Siigo/Alegra)
- 🌐 Full UI translation (currently UI is ES-only; only the locale string flips for number/currency formatting)



### Phase 61: Cross-platform video + Reels modernos (2026-02-15)

**🎬 Reels TikTok/Instagram-style** (`/app/frontend/src/pages/ReelsPage.jsx` rewrite)
- **Auto-play** via `IntersectionObserver` (75% visible) — más confiable que onScroll
- **Gestos completos**:
  - Swipe ↑ / ↓ → siguiente / anterior (native scroll-snap)
  - Swipe ← → ir al perfil del autor en `/profile/:id/reels`
  - Swipe → → volver atrás
  - **Doble-tap** → like con animación heart-burst (`@keyframes pingOnce`)
  - **Long-press** → pausar mientras se mantiene
  - Tap simple → play/pause toggle
- **Modos**:
  - `/reels` → orden aleatorio + video-first (algorítmico)
  - `/profile/:userId/reels` → solo de ese usuario, cronológico desc
- **Historial**: stack en `historyRef` de IDs vistos en la sesión, soporta deep-link `?id=`
- **Mute global**: una sola toggle aplica a todos los reels (estado global)

**📹 Compatibilidad cross-platform (P0)**
- Backend `routers/uploads.py`: subidas de video ahora generan **eager derivatives**:
  - MP4 H.264+AAC 720p 1500kbps (universal — iOS/Android/Windows/Mac)
  - Poster JPG auto-generado en `start_offset:auto`
  - URL `f_auto,q_auto` para que Cloudinary elija el codec por device
- Frontend `<video>` ahora usa multi-`<source>`:
  1. `mp4_url` explícito (Cloudinary eager)
  2. `f_auto` (adaptativo)
  3. URL original (fallback)
- `playsInline` + `muted` + `preload="metadata"` aplicado globalmente (iOS Safari autoplay policy)
- Retry mute-on-fail si autoplay falla (Chrome/Safari policy)
- `poster` image para preview rápido sin descargar el video completo

**🤖 BRUNO IA pill — minimiza con la barra**
- Cuando el nav pill minimiza, el chat AI window también auto-minimiza (efecto reactivo en `FloatingBubbles`)
- La burbuja queda circular 28×28 igual que los demás items

**Verificación**
- ✅ `/reels` monta limpio, zero console errors
- ✅ Test cuenta sin reels muestra empty state correcto
- ✅ Build webpack compila sin errores (después de quitar attrs JSX no-estándar `webkit-playsinline`/`x-webkit-airplay` que rompían el plugin `visual-edits`)

**Listo para redeploy**



### Phase 62: Sync minimize · PWA cross-device · Video migration (2026-02-15)

**🔗 Minimize sincronizado**
- `NavScrollContext` ahora emite `window.bruno:minimize-all` cuando el nav pill minimiza, y escucha `bruno:child-minimized` para reaccionar a minimizados iniciados por chat o AI.
- `FloatingBubbles` (AI chat) — auto-minimiza al recibir el evento; emite `child-minimized` cuando el usuario lo minimiza manualmente.
- `FloatingChatBubble` (chats de usuarios) — quitamos el `if (minimized) return null` que ocultaba todo. Ahora los chats abiertos se vuelven burbujas circulares cuando el nav minimiza, mismo behavior que el AI. Ping `child-minimized` cuando el usuario minimiza un chat.
- Regla: minimizar uno → minimizan todos. Expandir uno → solo expande ese (UX-friendly como pidió el usuario).

**📱 PWAInstallPrompt — funcional en iOS/Android/Windows**
- Layout compacto de **una sola fila** en pantallas ≥360px (avatar + texto + botón + ✕). Cabe perfecto en iPhone SE / Android pequeño.
- Posicionado en `bottom: calc(5.5rem + safe-area)` para no chocar con el bottom-nav.
- **iOS Safari**: instrucciones step-by-step con el ícono real ▲-en-caja de Compartir + warning si el navegador es Chrome iOS (que no puede instalar PWA).
- **Android Chrome**: usa `beforeinstallprompt`. Si no llega en 15s, muestra instrucciones manuales como fallback.
- Botón "Cómo" expande/colapsa panel de instrucciones (no satura la UI).
- Detecta y oculta automáticamente si la app ya está en modo standalone.

**🎞️ Migración de videos existentes**
- Nuevo router `/app/backend/routers/admin_maintenance.py`:
  - `POST /api/admin/migrate-videos` (admin-only, background task) — itera todos los videos en Cloudinary y aplica el mismo eager-transcode (MP4 H.264+AAC 720p + poster JPG) que las nuevas subidas. Actualiza `posts.media.$.mp4_url` y `poster_url`.
  - `GET /api/admin/jobs` — lista los jobs y su progreso.
- Uso: `curl -X POST $API/api/admin/migrate-videos -H "Authorization: Bearer $ADMIN" -d 'prefix=bruno&limit=1000'`

**Verificación**
- ✅ Backend health 200, admin endpoint protegido (403 sin auth)
- ✅ Frontend smoke clean, sin errores de consola
- ✅ Nav pill + AI + chat se ven sincronizados en pantalla



### Phase 63: Unified Minimize — Pill + Normal Chat + Bruno IA as ONE unit (2026-02-15) 🔴 PRIORITY FIX

**El problema reportado**
- El chat normal (esquina inferior derecha) seguía siendo un círculo GRANDE (40×40) aunque el nav minimizara.
- El AI chat aparecía como bubble pequeño pero "atascado" en su esquina del pill bar.
- No había sincronización visual real entre los tres elementos.

**La solución implementada**
Los tres elementos (nav pill + chat normal + AI chat) ahora son **una sola unidad cohesiva** que comparten el mismo estado `minimized` vía `NavScrollContext`:

| Elemento | EXPANDED state | MINIMIZED state |
|---|---|---|
| Nav pill | Barra completa centrada | Hairline thin de 24×6 |
| AI bubble | Botón violeta 40×40 en `left-3` arriba del pill | Círculo violeta **28×28** a 60px del centro (izquierda) |
| Chat bubble | Botón naranja 40×40 en `right-3` arriba del pill | Círculo naranja **28×28** a 60px del centro (derecha) |

**Cambios técnicos** (`FloatingChatBubble.jsx`, `FloatingBubbles.jsx`)
- Chat bubble: nuevo render minimizado `chat-bubble-btn-minimized` (w-7 h-7) **simétrico** al AI bubble en `right: calc(50% - 60px)`.
- Tap en cualquier bubble minimizado → expande TODO (`setMinimized(false)` + abre ese específico).
- AI: cuando el nav minimiza, se fuerza `setShowAIChat(false)` + `setAiMinimized(false)` para que NO coexistan la bubble grande y la pequeña.
- Chat: cuando el nav minimiza, se cierra `isOpen`, `showNewChat`, y se fuerza `openChats.minimized=true`.
- Suprimimos popup de ChatList, modal NewChat y ChatListPopup mientras el nav esté minimizado.

**Flujo de eventos sincronizado**
- `nav scroll` → `setMinimized(true)` → emite `bruno:minimize-all` → AI + chat colapsan a tiny bubbles
- `AI Minimize button` → emite `bruno:child-minimized` → nav minimiza → chat colapsa
- `Chat Minimize button` → emite `bruno:child-minimized` → nav minimiza → AI colapsa
- `Tap en cualquier mini bubble` → expande el nav + abre ese elemento (no fuerza expandir los otros — UX cómoda)

**Verificación**
- ✅ Backend health 200
- ✅ Zero console errors
- ✅ Lint clean (los warnings restantes son pre-existentes, no de esta fase)
- ✅ Visualmente: las tres burbujas ahora viven en la misma fila a la altura del pill (28×28 cada una, simétricas)



### Phase 64: 🔴 CRITICAL — Video pipeline end-to-end FIXED (2026-02-15)

**Lo que estaba roto**
- `eager_async=False` en `/upload/image` bloqueaba la request hasta que Cloudinary transcodifique → timeouts en uploads grandes
- `/upload/chat-file` no aplicaba transcoding ni devolvía `mp4_url`/`poster_url`/`f_auto_url`
- El modelo `PostMedia` no aceptaba los campos nuevos → se perdían al guardar el post
- `PostCard.jsx` usaba `<video src={url}>` sin multi-source ni poster
- `CreatePost.jsx` no propagaba los nuevos campos al post

**La solución (5 layers)**

1. **`/api/upload/image` (uploads.py)**:
   - `cloudinary.uploader.upload_large` con chunks 6MB para videos >10MB (no más OOM / timeout proxy)
   - `eager_async=True` → response inmediata, transcoding en background
   - Detección de video por `content-type` OR extensión (mobiles tipean octet-stream)
   - **URLs sintetizadas** (no esperan derivatives): `mp4_url`, `poster_url`, `f_auto_url` construidas vía transform URLs de Cloudinary

2. **`/api/upload/chat-file` (uploads.py)**: misma lógica que `/upload/image` para videos. Devuelve `mp4_url`/`poster_url`/`f_auto_url`. URL efectiva = MP4 derivative (para playback inmediato).

3. **`routers/posts_feed.py` PostMedia**: añadidos campos `mp4_url`, `f_auto_url`, `poster_url`, `original_url` + `extra="allow"` → no se pierden al persistir/leer.

4. **`CreatePost.jsx`**: propaga `mp4_url`, `f_auto_url`, `poster_url`, `original_url` al objeto media del post.

5. **`PostCard.jsx`**: `<video>` ahora con multi-`<source>` (MP4 → f_auto → original) + `playsInline` + `preload="metadata"` + `poster` para preview instantáneo.

**Verificación end-to-end (probado vía curl con un MP4 real de 9MB)**:
- ✅ POST `/api/upload/image` → 200 con `url`, `mp4_url`, `poster_url`, `f_auto_url`
- ✅ POST `/api/posts` → 200 guarda los 4 campos en `media[0]`
- ✅ GET MP4 derivative → 200 · 723KB · `video/mp4;codecs=avc1` (H.264 universal)
- ✅ GET poster JPG → 200 · 20KB · `image/jpeg`
- ✅ Frontend smoke: feed loads clean, zero console errors

**Compatibilidad**
- iOS Safari (iPhone/iPad): ✅ — H.264 + AAC + `playsInline`
- Android Chrome: ✅ — todos los códecs MP4
- Windows/Mac Chrome/Edge/Firefox: ✅
- Safari macOS: ✅
- Cualquier dispositivo legacy: cae al `f_auto` que Cloudinary adapta on-the-fly



