# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a polished PWA with social networking features, e-commerce, and AI assistant.

---

## Los 9 Puntos Originales - Estado

| # | Punto | Estado | Detalles |
|---|-------|--------|----------|
| 1 | **Mapa** estilo Snapchat | ✅ COMPLETADO | UI con usuarios en tiempo real vía WebSocket |
| 2 | **Cards** múltiples vistas | ✅ COMPLETADO | MiniCard, MediumCard, LargeCard, MapMarkerCard |
| 3 | **Feed** fotos/videos/ubicaciones | ✅ COMPLETADO | Posts con media, Stories 24h, Reels |
| 4 | **Chat** todos los medios, llamadas | ✅ COMPLETADO | Burbuja flotante, videollamadas, stickers |
| 5 | **Tienda** NFC + MEOW APP | ✅ COMPLETADO | 36 productos PIUP, unificado con Marketplace |
| 6 | **BRUNO IA** asistente integrado | ✅ COMPLETADO | Recomendaciones, búsqueda inteligente |
| 7 | **Usuarios** sesión, seguridad, tour | ✅ COMPLETADO | Auth completo, badges verificación, tour |
| 8 | **Website** BRUNO.com | ✅ COMPLETADO | Landing page marketing |
| 9 | **Perfil** posts, reels, cards | ✅ COMPLETADO | Tabs, puntos, estadísticas |

---

## Implementaciones Completadas

### Fase 1 - Core (Completado)
- Sistema de autenticación JWT + Google OAuth
- Tarjetas digitales con 8 tipos
- Tienda PIUP con 36 productos
- Chat en tiempo real con WebSocket
- Feed social con posts y media

### Fase 2 - Marketplace y Stories (Completado)
- Marketplace completo con carrito
- Stories 24h estilo Instagram
- Card Stories (catálogos permanentes)
- Bruno IA con recomendaciones

### Fase 3 - Notificaciones y Chat Flotante (Completado)
- 11 tipos de notificaciones (push + email)
- Chat en burbuja flotante (múltiples chats)
- Tienda PIUP unificada con Marketplace
- Integración Resend para emails

### Fase 4 - Badges, Mapa y Refactoring (Completado 2025-02-26)

#### Badges de Verificación
- **Componente:** `/app/frontend/src/components/VerifiedBadge.jsx`
- **Tiers:** Free, Pro (⭐), Business (👑)
- **Componentes:** VerifiedIcon, VerifiedBadge, InlineVerifiedBadge, AvatarWithBadge, TierSelector
- **Integración:** Posts, Perfil, Chat, Mapa

#### Store Router Modular
- **Archivo:** `/app/backend/routers/store.py` (429 líneas)
- **Productos:** 36 items PIUP
- **Suscripciones:** GET/POST subscription management
- **Pedidos:** CRUD con cálculo de envío/impuestos
- **Stripe:** Integración preparada

#### Mapa con Usuarios en Tiempo Real
- **Archivo:** `/app/frontend/src/pages/MapPage.jsx` (701 líneas)
- **WebSocket:** `/ws/map/{token}` para ubicaciones
- **Funcionalidades:**
  - Tarjetas cercanas con distancia
  - Usuarios en línea con badges
  - Búsqueda y filtros
  - Controles de zoom
  - "Cómo llegar" integrado

#### Email con Resend
- **Archivo:** `/app/backend/routers/notifications.py`
- **Template:** HTML profesional con branding BRUNO
- **Preferencias:** Opcionales por tipo de notificación

---

## API Endpoints Completos

### Auth
- `POST /api/auth/register`, `/login`, `/logout`
- `GET /api/auth/me`, `PUT /api/auth/me`
- `POST /api/auth/google`

### Store (NUEVO)
- `GET /api/store/products` - 36 productos PIUP
- `GET /api/store/products/{id}`
- `GET /api/store/subscription` - Tier actual
- `POST /api/store/subscribe/{tier}` - Actualizar tier
- `POST /api/store/orders` - Crear pedido
- `GET /api/store/orders` - Mis pedidos
- `POST /api/store/checkout/{order_id}` - Stripe checkout

### Notifications
- `GET /api/notifications/types` - 11 tipos
- `GET/PUT /api/notifications/preferences` - Push + Email
- `GET /api/notifications/unread-count`
- `GET /api/notifications/recent`
- `POST /api/notifications/mark-read/{id}`
- `POST /api/notifications/mark-all-read`

### Marketplace
- `GET /api/marketplace/categories`
- CRUD `/api/marketplace/products`
- `/api/marketplace/cart/*`
- `/api/marketplace/my-products`

### Stories
- `POST /api/stories/` - Stories 24h
- `GET /api/stories/feed`
- `POST /api/stories/card` - Card Stories

### AI
- `POST /api/ai/recommend` - Búsqueda inteligente
- `GET /api/ai/share-card/{id}`

### WebSockets
- `/ws/chat/{token}` - Chat en tiempo real
- `/ws/map/{token}` - Ubicaciones en tiempo real

---

## Archivos Clave

### Backend Routers
- `/app/backend/routers/store.py` - 429 líneas
- `/app/backend/routers/notifications.py` - 438 líneas
- `/app/backend/routers/marketplace.py` - 416 líneas
- `/app/backend/routers/stories.py`
- `/app/backend/routers/points.py`

### Frontend Components
- `/app/frontend/src/components/VerifiedBadge.jsx` - 263 líneas
- `/app/frontend/src/components/FloatingChatBubble.jsx` - 603 líneas
- `/app/frontend/src/components/NotificationBell.jsx`
- `/app/frontend/src/components/Stories.jsx`

### Frontend Pages
- `/app/frontend/src/pages/MapPage.jsx` - 701 líneas
- `/app/frontend/src/pages/MarketplacePage.jsx`
- `/app/frontend/src/pages/FeedPage.jsx`
- `/app/frontend/src/pages/MyProfilePage.jsx`

---

## Test Credentials
- **User 1:** `newtest@bruno.com` / `Test1234!`
- **User 2:** `chattest2@bruno.com` / `Test1234!`

## Test Reports
- `/app/test_reports/iteration_17.json` - Badges, Store, Mapa (100%)
- `/app/test_reports/iteration_16.json` - Notificaciones, Chat (100%)
- `/app/test_reports/iteration_15.json` - Marketplace, Stories (100%)

---

## Próximas Tareas (Backlog)

### P0 - Alta Prioridad
- [ ] Agregar RESEND_API_KEY para emails reales
- [ ] Implementar pagos reales con Stripe
- [ ] Push notifications reales con pywebpush

### P1 - Media Prioridad
- [ ] Posts con ubicación geográfica
- [ ] Templates de Cards editables desde UI
- [ ] Completar refactoring de server.py

### P2 - Baja Prioridad
- [ ] Features exclusivas por tier (Pro/Business)
- [ ] Acciones del BRUNO IA para crear/editar tarjetas
- [ ] Integración de realidad aumentada

---

## 3rd Party Integrations
- **OpenAI GPT-5.2:** Text Generation (Emergent LLM Key) ✅
- **Daily.co:** Video/Audio Calls (MOCKED)
- **Cloudinary:** Image/File Storage ✅
- **Stripe:** Payments (prepared, key available)
- **Emergent Google Auth:** Social Login ✅
- **Resend:** Email (MOCKED - needs API key)
- **Web Push:** (MOCKED - needs pywebpush)

---

*Last Updated: 2025-02-26 - Los 9 puntos COMPLETADOS. Badges, Store refactored, Mapa con usuarios en tiempo real.*
