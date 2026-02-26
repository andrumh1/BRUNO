# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a polished PWA with social networking features, e-commerce, and AI assistant.

---

## FASE 1 - Correcciones Críticas (COMPLETADO)

### Completado

#### 1. Sistema de Usuarios Mejorado
- Sesión persistente con opción de mantener sesión
- Endpoints de logout y actualización de perfil
- Cache de usuario en localStorage

#### 2. Tienda PIUP Ampliada (36 productos)
- Tarjetas NFC, Carnets, Hogar, Comercios, Oficinas, Mascotas, Guardian, Habladores, MEOW APP

#### 3. Mapa Estilo Snapchat
- Cálculo de distancias (Haversine)
- Marcadores con avatares

#### 4. Variantes de Tarjetas
- MiniCard, MediumCard, LargeCard, MapMarkerCard

#### 5. Nuevo Tipo de Tarjeta: Servicios
- Para freelancers y emprendedores

#### 6. BRUNO IA Mejorado
- Sistema de recomendaciones inteligentes
- Busca y comparte tarjetas, posts, reels

#### 7. Chat Mejorado
- Notas de voz, archivos, stickers
- Videollamadas y llamadas de voz (Daily.co)
- **NUEVO: Chat en Burbuja Flotante**

#### 8. Feed con Reels
- Tab de Reels estilo TikTok

#### 9. Sistema de Puntos/Gamificación
- Niveles, check-in diario, leaderboard

---

## FASE 2 - Marketplace y Stories (COMPLETADO 2025-02-26)

### 10. Marketplace Completo
- Backend Router con CRUD completo
- 10 categorías, filtros avanzados
- Carrito de compras, favoritos
- **NUEVO: Integración con Tienda PIUP**

### 11. Stories 24 Horas
- Expiración automática
- Crear, ver, navegar, reaccionar

### 12. Stories Estáticas en Cards
- Catálogos permanentes vinculados a tarjetas

### 13. Bruno IA con Recomendaciones
- Búsqueda inteligente de tarjetas/posts
- Compartir vía chat

---

## FASE 3 - Notificaciones, Chat Flotante, Tienda Unificada (COMPLETADO 2025-02-26)

### 14. Sistema de Notificaciones Completo
- **Backend:** `/app/backend/routers/notifications.py`
- **11 tipos de notificaciones:**
  - Llamadas entrantes
  - Mensajes nuevos
  - Nuevos seguidores
  - Likes y comentarios
  - Favoritos en productos (vendedores)
  - Productos agregados al carrito
  - Stories de seguidos
  - Menciones
  - Actualizaciones de pedidos
  - Promociones
- **Push Notifications:** Activables/desactivables por tipo
- **Email Notifications:** Opcionales con toggles individuales
- **Frontend Components:**
  - `NotificationBell.jsx` - Icono campana con badge de no leídos
  - `NotificationSettingsPage.jsx` - Página de configuración

### 15. Tienda PIUP Unificada con Marketplace
- Productos PIUP aparecen como "Productos Oficiales" destacados
- Suscripciones (Free, Pro, Business) en sección especial
- Badge "PIUP" para distinguir productos oficiales
- Badge "POPULAR" en plan Pro
- Separador visual entre PIUP y productos de comunidad

### 16. Chat en Burbuja Flotante
- **Componente:** `/app/frontend/src/components/FloatingChatBubble.jsx`
- **Características:**
  - Burbuja flotante en esquina inferior derecha
  - Lista de conversaciones en popup
  - **Múltiples ventanas de chat** (hasta 3 simultáneas)
  - Minimizar/maximizar ventanas
  - WebSocket para tiempo real
  - Buscar usuarios para nuevo chat
  - Indicador de mensajes no leídos

---

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/google`

### Notifications (NUEVO)
- `GET /api/notifications/types` - Lista 11 tipos con iconos
- `GET /api/notifications/preferences` - Preferencias push+email
- `PUT /api/notifications/preferences` - Actualizar preferencias
- `GET /api/notifications/unread-count` - Contador no leídos
- `GET /api/notifications/recent` - Notificaciones recientes
- `POST /api/notifications/mark-read/{id}` - Marcar leída
- `POST /api/notifications/mark-all-read` - Marcar todas

### Marketplace
- `GET /api/marketplace/categories`
- `GET /api/marketplace/products`
- `POST /api/marketplace/products`
- `GET /api/marketplace/products/{id}`
- `PUT /api/marketplace/products/{id}`
- `DELETE /api/marketplace/products/{id}`
- `POST /api/marketplace/products/{id}/favorite`
- `GET /api/marketplace/my-products`
- `GET /api/marketplace/cart`
- `POST /api/marketplace/cart/add`
- `DELETE /api/marketplace/cart/{product_id}`
- `DELETE /api/marketplace/cart`

### Stories
- `POST /api/stories/`
- `GET /api/stories/feed`
- `GET /api/stories/user/{user_id}`
- `POST /api/stories/{id}/view`
- `POST /api/stories/{id}/react`
- `DELETE /api/stories/{id}`

### Card Stories
- `POST /api/stories/card`
- `GET /api/stories/card/{card_id}`
- `PUT /api/stories/card/{story_id}`
- `DELETE /api/stories/card/{story_id}`
- `PUT /api/stories/card/{card_id}/reorder`

### AI Recommendations
- `POST /api/ai/recommend`
- `GET /api/ai/share-card/{card_id}?target_user_id=`

### Videollamadas
- `POST /api/calls/start`
- `POST /api/calls/{id}/answer`
- `POST /api/calls/{id}/decline`
- `POST /api/calls/{id}/end`

### Sistema de Puntos
- `GET /api/points/me`
- `POST /api/points/daily-check-in`
- `GET /api/points/leaderboard`
- `GET /api/points/history`

---

## Key Files

### Backend
- `/app/backend/routers/notifications.py` - Sistema de notificaciones (347 líneas)
- `/app/backend/routers/marketplace.py` - Marketplace completo
- `/app/backend/routers/stories.py` - Stories 24h y Card Stories
- `/app/backend/server.py` - Servidor principal (refactoring en progreso)

### Frontend Components
- `/app/frontend/src/components/FloatingChatBubble.jsx` - Chat flotante (603 líneas)
- `/app/frontend/src/components/NotificationBell.jsx` - Campana de notificaciones
- `/app/frontend/src/components/Stories.jsx` - Stories 24h
- `/app/frontend/src/components/CardStories.jsx` - Card Stories

### Frontend Pages
- `/app/frontend/src/pages/NotificationSettingsPage.jsx` - Config notificaciones
- `/app/frontend/src/pages/MarketplacePage.jsx` - Con PIUP integrado
- `/app/frontend/src/pages/ProductDetailPage.jsx`
- `/app/frontend/src/pages/CartPage.jsx`
- `/app/frontend/src/pages/FeedPage.jsx` - Con Stories y NotificationBell

---

## Test Credentials
- **User 1:** `newtest@bruno.com` / `Test1234!`
- **User 2:** `chattest2@bruno.com` / `Test1234!`

---

## Test Reports
- `/app/test_reports/iteration_16.json` - Notificaciones, Chat Flotante, PIUP (100%)
- `/app/test_reports/iteration_15.json` - Marketplace, Stories, AI (100%)

---

## Próximas Tareas (Backlog)

### P0 - Alta Prioridad
- [ ] Continuar refactoring de server.py a routers modulares
- [ ] Integración de pagos Stripe en Marketplace
- [ ] Integración de email real (SendGrid/Resend) para notificaciones
- [ ] Push notifications reales con pywebpush

### P1 - Media Prioridad
- [ ] Mapa UI completo estilo Snapchat con ubicaciones en tiempo real
- [ ] Vistas de Cards miniatura y lista para mapa
- [ ] Templates de Cards editables
- [ ] Feed con ubicaciones y actualizaciones públicas de cards

### P2 - Baja Prioridad
- [ ] Niveles de suscripción diferenciados con features exclusivas
- [ ] Modelo de seguridad avanzado
- [ ] Acciones del BRUNO IA para crear/editar tarjetas via chat

---

## 3rd Party Integrations
- **OpenAI GPT-5.2:** Text Generation (Emergent LLM Key)
- **Daily.co:** Video/Audio Calls (MOCKED)
- **Cloudinary:** Image/File Storage
- **Stripe:** Payments (key available)
- **Emergent Google Auth:** Social Login
- **Web Push:** (MOCKED - stores subscriptions)
- **Email:** (MOCKED - needs SendGrid/Resend)

---

*Last Updated: 2025-02-26 - Notificaciones completas, Chat flotante, Tienda PIUP unificada*
