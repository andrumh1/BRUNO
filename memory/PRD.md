# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a polished PWA with social networking features, e-commerce, and AI assistant.

---

## Los 9 Puntos Originales - TODOS COMPLETADOS ✅

| # | Punto | Estado |
|---|-------|--------|
| 1 | **Mapa** estilo Snapchat | ✅ COMPLETADO |
| 2 | **Cards** múltiples vistas | ✅ COMPLETADO |
| 3 | **Feed** fotos/videos/ubicaciones | ✅ COMPLETADO |
| 4 | **Chat** todos los medios, llamadas | ✅ COMPLETADO |
| 5 | **Tienda** NFC + MEOW APP | ✅ COMPLETADO |
| 6 | **BRUNO IA** asistente integrado | ✅ COMPLETADO |
| 7 | **Usuarios** sesión, seguridad, tour | ✅ COMPLETADO |
| 8 | **Website** BRUNO.com | ✅ COMPLETADO |
| 9 | **Perfil** posts, reels, cards | ✅ COMPLETADO |

---

## Implementaciones Completadas

### Fase 1-3: Core Features (Completado anteriormente)
- Auth, Cards, Chat, Feed, Marketplace, Stories, Notificaciones, Chat Flotante

### Fase 4: Badges, Mapa, Store Router (Completado 2025-02-26)
- Badges de verificación Pro/Business
- Store Router modular
- Mapa con usuarios en tiempo real

### Fase 5: Analytics, Cámara, Mascota BRUNO (Completado 2025-02-26)

#### 1. Analíticas Avanzadas (Pro/Business)
- **Backend:** `/app/backend/routers/analytics.py` (400 líneas)
- **Endpoints:**
  - `POST /api/analytics/track/card/{id}` - Tracking de vistas (público)
  - `POST /api/analytics/track/card/{id}/duration` - Duración de visita
  - `POST /api/analytics/track/post/{id}` - Tracking de posts
  - `GET /api/analytics/overview` - Dashboard general (Pro/Business)
  - `GET /api/analytics/cards/{id}` - Analytics por tarjeta (Pro/Business)
  - `GET /api/analytics/recent-visitors/{id}` - Visitantes (Business)
  - `GET /api/analytics/export/{id}` - Exportar CSV (Business)
- **Métricas:**
  - Vistas totales, únicas, hoy, semana, mes
  - Top ubicaciones geográficas
  - Fuentes de tráfico (referrers)
  - Tiempo promedio de visita
  - Visitantes recurrentes
  - Gráfico de vistas por día (30 días)
- **Frontend:** `/app/frontend/src/pages/AnalyticsPage.jsx`

#### 2. Cámara BRUNO con Editor
- **Archivo:** `/app/frontend/src/pages/BrunoCameraPage.jsx` (631 líneas)
- **Características:**
  - Captura de foto y video
  - Cambio de cámara frontal/trasera
  - **10 Filtros:** Original, BRUNO, Atardecer, Fresco, Cálido, Vintage, B&N, Vívido, Desvanecido, Drama
  - **Stickers:** Mascota BRUNO + 9 emojis populares
  - **Editor de texto:** 5 estilos (Normal, Negrita, Cursiva, Mono, Serif) + 10 colores
  - **Ajustes:** Brillo y contraste con sliders
  - **Publicación:** Directa al feed con caption
- **Botón Flotante:** `/app/frontend/src/components/CameraFloatingButton.jsx`
  - Estilo Instagram (centro inferior)
  - Visible en Feed, Perfil, Dashboard para usuarios logueados

#### 3. Mascota BRUNO IA
- **Imagen:** `/app/frontend/public/bruno-mascot.webp` (134KB)
- **Componentes:** `/app/frontend/src/components/BrunoMascot.jsx` (369 líneas)
  - `BrunoAvatar` - Avatar con moods (default, thinking, happy, helpful, greeting, success, loading)
  - `BrunoLoading` - Pantalla de carga con mascota
  - `BrunoEmptyState` - Estado vacío con mascota
  - `BrunoGreeting` - Saludo personalizado
  - `BrunoTip` - Tips/consejos con mascota
  - `BrunoQuickActions` - Acciones rápidas
  - `BrunoFloatingButton` - Botón flotante mejorado
- **Integración:** Header de cámara, chat IA, loading screens

#### 4. Navegación Mejorada
- **Mapa en Feed:** Ícono de mapa añadido al header de FeedPage
- **Rutas nuevas:** `/camera`, `/analytics`, `/analytics/:cardId`

### Fase 6: Cumplimiento y Navegación Móvil (Completado 2025-02-26)

#### 1. Navegación Móvil Estilo Instagram/Facebook
- **Archivo:** `/app/frontend/src/components/MobileBottomNav.jsx`
- **Características:**
  - Barra inferior fija visible solo en móvil (<768px)
  - 5 íconos: Inicio, Reels, Crear (destacado), Mapa, Perfil
  - Avatar del usuario en el ícono de Perfil
  - Safe area padding para iOS
- **CSS:** `hidden md:hidden` para ocultar en desktop

#### 2. Política de Privacidad (PÚBLICO - Requerido App Store)
- **Archivo:** `/app/frontend/src/pages/PrivacyPolicyPage.jsx`
- **Ruta:** `/privacy` (sin login requerido)
- **Secciones:** Introducción, Datos Recopilados, Uso de Datos, Compartir, Derechos del Usuario, Retención, Seguridad, GDPR/CCPA

#### 3. Términos de Servicio (PÚBLICO - Requerido App Store)
- **Archivo:** `/app/frontend/src/pages/TermsOfServicePage.jsx`
- **Ruta:** `/terms` (sin login requerido)
- **Secciones:** Aceptación, Descripción del Servicio, Cuentas, Contenido Prohibido, Moderación, Propiedad Intelectual

#### 4. Sistema de Eliminación de Cuenta (Requerido por Apple)
- **Frontend:** `/app/frontend/src/pages/DeleteAccountPage.jsx`
- **Ruta:** `/settings/delete-account` (protegida)
- **Características:**
  - Advertencia de acción irreversible
  - Lista de datos que se eliminarán
  - Opción de descargar datos antes de eliminar
  - Confirmación en 2 pasos con texto "ELIMINAR MI CUENTA"
  - Verificación de contraseña

#### 5. Sistema de Reportar Contenido
- **Frontend:** `/app/frontend/src/components/ReportContentModal.jsx`
- **Tipos de contenido:** post, user, comment, product, message
- **Razones:** spam, harassment, hate_speech, violence, sexual_content, misinformation, impersonation, intellectual_property, illegal_activity, other

#### 6. API de Cumplimiento (Backend)
- **Archivo:** `/app/backend/routers/compliance.py`
- **Endpoints:**
  - `POST /api/reports` - Crear reporte de contenido
  - `GET /api/reports/my` - Ver reportes del usuario
  - `GET /api/profile/export` - Exportar datos del usuario (GDPR)
  - `DELETE /api/profile/delete-account` - Eliminar cuenta permanentemente
  - `GET /api/admin/reports` - Reportes pendientes (Admin)
  - `PUT /api/admin/reports/{id}` - Actualizar estado de reporte (Admin)

#### 7. Mapa con Leaflet Real
- **Archivo:** `/app/frontend/src/pages/MapPage.jsx` (refactorizado)
- **Cambios:**
  - Reemplazó gradientes CSS por mapa interactivo real
  - Usa OpenStreetMap tiles (gratuito, sin API key)
  - Marcadores personalizados para tarjetas y usuarios
  - Cálculo de distancia con fórmula Haversine
  - Navegación a Google Maps/Apple Maps

---

## API Endpoints Completos

### Auth
- `/api/auth/register`, `/login`, `/logout`, `/me`, `/google`

### Analytics (NUEVO)
- `POST /api/analytics/track/card/{id}` - Público
- `POST /api/analytics/track/card/{id}/duration` - Público
- `POST /api/analytics/track/post/{id}` - Público
- `GET /api/analytics/overview` - Pro/Business
- `GET /api/analytics/cards/{id}` - Pro/Business
- `GET /api/analytics/recent-visitors/{id}` - Business
- `GET /api/analytics/export/{id}` - Business

### Store
- `GET /api/store/products` - 36 productos PIUP
- `GET /api/store/subscription` - Estado suscripción
- `POST /api/store/subscribe/{tier}` - Suscribirse
- `POST /api/store/orders` - Crear pedido

### Notifications
- `GET /api/notifications/types` - 11 tipos
- `GET/PUT /api/notifications/preferences` - Push + Email
- `GET /api/notifications/unread-count`

### Marketplace
- CRUD `/api/marketplace/products`
- `/api/marketplace/cart/*`

### Stories
- `POST /api/stories/` - Stories 24h
- `GET /api/stories/feed`
- `POST /api/stories/card` - Card Stories

### WebSockets
- `/ws/chat/{token}` - Chat en tiempo real
- `/ws/map/{token}` - Ubicaciones en tiempo real

---

## Archivos Clave

### Backend Routers
- `/app/backend/routers/analytics.py` - 400 líneas
- `/app/backend/routers/store.py` - 429 líneas
- `/app/backend/routers/notifications.py` - 438 líneas
- `/app/backend/routers/marketplace.py` - 416 líneas

### Frontend Pages
- `/app/frontend/src/pages/BrunoCameraPage.jsx` - 631 líneas
- `/app/frontend/src/pages/AnalyticsPage.jsx` - 358 líneas
- `/app/frontend/src/pages/MapPage.jsx` - 701 líneas

### Frontend Components
- `/app/frontend/src/components/BrunoMascot.jsx` - 369 líneas
- `/app/frontend/src/components/VerifiedBadge.jsx` - 263 líneas
- `/app/frontend/src/components/FloatingChatBubble.jsx` - 603 líneas
- `/app/frontend/src/components/CameraFloatingButton.jsx` - 39 líneas

### Assets
- `/app/frontend/public/bruno-mascot.webp` - Mascota oficial

---

## Test Reports
- `/app/test_reports/iteration_18.json` - Analytics, Cámara, Mascota (100%)
- `/app/test_reports/iteration_17.json` - Badges, Store, Mapa (100%)
- `/app/test_reports/iteration_16.json` - Notificaciones, Chat (100%)

---

## Próximas Tareas (Backlog)

### P0 - Alta Prioridad
- [ ] Agregar RESEND_API_KEY para emails reales
- [ ] Push notifications reales con pywebpush
- [ ] Integrar pagos Stripe completos

### P1 - Media Prioridad
- [ ] Encuestas en Stories (estilo Instagram)
- [ ] Reacciones animadas en posts
- [ ] Duetos (responder videos)
- [ ] Posts con ubicación geográfica

### P2 - Baja Prioridad
- [ ] Features exclusivas por tier detalladas
- [ ] Modo privado temporal
- [ ] "Cerca de ti" mejorado
- [ ] AR para productos

---

## Fase 2 Pendiente - Monetización Interna

### Publicaciones Patrocinadas
- [ ] Sistema de publicaciones patrocinadas
- [ ] Tarjetas destacadas en el mapa (premium)
- [ ] Negocios promocionados en el feed
- [ ] Sistema de monetización automática para creadores

### Fase 3 Pendiente - Moderación
- [ ] Panel de moderación de contenido
- [ ] Filtro automático básico de contenido

---

### Fase 7: Sistema de Lives TikTok-style (Completado 2025-02-27)

#### 1. Sistema de Lives Completo
- **Backend:** `/app/backend/routers/lives.py`
- **Endpoints:**
  - `POST /api/lives` - Crear un nuevo live
  - `GET /api/lives` - Listar lives activos
  - `GET /api/lives/categories` - Obtener categorías
  - `GET /api/lives/following` - Lives de usuarios seguidos
  - `GET /api/lives/{id}` - Detalles del live
  - `POST /api/lives/{id}/join` - Unirse a un live
  - `POST /api/lives/{id}/leave` - Abandonar un live
  - `POST /api/lives/{id}/comment` - Publicar comentario
  - `POST /api/lives/{id}/gift` - Enviar regalo
  - `POST /api/lives/{id}/end` - Terminar live
- **Categorías:** 10 categorías (General, Música, Gaming, etc.)
- **Sistema de Regalos:** Rosa (1pt), Corazón (5pt), Estrella (10pt), Diamante (50pt), Cohete (100pt), Corona (500pt)

#### 2. Frontend de Lives
- **LivesListPage:** `/app/frontend/src/pages/LivesListPage.jsx`
- **LiveViewerPage:** `/app/frontend/src/pages/LiveViewerPage.jsx`
- **StartLivePage:** `/app/frontend/src/pages/StartLivePage.jsx`

#### 3. Corrección de Cache para Safari/iOS
- **Meta Tags:** Cache-Control, Pragma, Expires en `index.html`
- **Service Worker v2:** skipWaiting, cache cleanup, network-first

### Fase 8: Monetización y Moderación (Completado 2025-03-10)

#### 1. Sistema de Monetización
- **Backend:** `/app/backend/routers/monetization.py`
- **Tipos de Promoción:**
  - Publicación Patrocinada (50 pts/día)
  - Destacado en Mapa (100 pts/día)
  - Negocio Destacado (75 pts/día)
  - Impulso de Búsqueda (30 pts/día)
- **Monetización de Creadores:** 70% de regalos
- **Frontend:** `/app/frontend/src/pages/MonetizationPage.jsx`

#### 2. Sistema de Moderación
- **Backend:** `/app/backend/routers/moderation.py`
- **Filtro Automático:** Violencia, odio, spam, contenido adulto
- **Panel de Admin:** Cola de moderación, estadísticas, historial
- **Acciones:** Advertir, eliminar, suspender, banear

#### 3. Navegación Móvil iOS 26.3
- **Estilo:** Burbujas con efectos de luz dinámicos
- **7 Botones:** Inicio, Explorar, Crear, Lives, Mapa, Chat, Perfil
- **Header Simplificado:** Solo Panel, Web, Tienda PIUP

---

## 3rd Party Integrations
- **OpenAI GPT-5.2:** Text Generation (Emergent LLM Key) ✅
- **Daily.co:** Video/Audio Calls (MOCKED)
- **Cloudinary:** Image/File Storage ✅
- **Stripe:** Payments (prepared)
- **Emergent Google Auth:** Social Login ✅
- **Resend:** Email (prepared - needs API key)
- **Leaflet/OpenStreetMap:** Interactive Maps ✅

---

*Last Updated: 2025-03-10 - Fase 8: Monetización (Patrocinados, Promociones), Moderación (Filtro auto, Panel admin), Nav iOS 26.3*

---

## Fase 9: UI/UX Compacta y Tarjetas Laborales (Completado 2025-03-10)

### 1. Unificación de Burbujas Flotantes
- **Problema:** Había duplicación de burbujas de chat
- **Solución:** Eliminada la burbuja de chat de `FloatingBubbles.jsx`, solo mantiene BRUNO IA
- **Chat flotante:** `FloatingChatBubble.jsx` maneja todas las funciones de chat
- **Resultado:** 2 burbujas únicas (BRUNO IA violeta izquierda + Chat naranja derecha)

### 2. Diseño Compacto WhatsApp-Style
- **Burbujas:** Reducidas de 14x14 a 11x11
- **Chat Windows:** Más compactas (w-72 h-80)
- **Fuentes:** Reducidas globalmente (body 14px, móvil 13px)
- **Mensajes:** Estilo WhatsApp con bordes redondeados, gradientes
- **Archivos modificados:**
  - `/app/frontend/src/components/FloatingChatBubble.jsx`
  - `/app/frontend/src/components/FloatingBubbles.jsx`
  - `/app/frontend/src/index.css`

### 3. BubbleSelect Arreglado
- **Bug:** No se podían seleccionar opciones en móvil
- **Causa:** onClick/onTouchEnd interceptados por overlay
- **Solución:** Cambiado a onMouseDown/onTouchStart
- **Z-index:** Overlay 9998, Options 10000
- **Archivo:** `/app/frontend/src/components/BubbleSelect.jsx`

### 4. Nuevos Tipos de Tarjetas Laborales
- **Tipos añadidos:**
  - `oferta_trabajo` - Para publicar ofertas de empleo
  - `busqueda_personal` - Para reclutar personal
  - `solicitud_servicio` - Para solicitar servicios
- **Campos específicos:**
  - Rango Salarial (mín, máx, moneda)
  - Tipo de Contrato (tiempo completo, medio tiempo, freelance, temporal, pasantía)
  - Modalidad (remoto, híbrido, presencial)
  - Experiencia Requerida (sin experiencia, 1-2 años, 3-5 años, 5+, 10+)
  - Número de Vacantes
  - Urgencia (urgente, normal, flexible)
  - Fecha Límite de Aplicación
  - Requisitos (lista dinámica)
  - Beneficios (lista dinámica, solo para ofertas)
- **Archivos modificados:**
  - `/app/frontend/src/pages/CreateCardPage.jsx`
  - `/app/frontend/src/components/BeaconsStyleCard.jsx` (NUEVO)

### 5. Componente BeaconsStyleCard
- **Diseño:** Inspirado en Beacons.ai/Linktree
- **Características:**
  - Background con banner o gradiente
  - Avatar redondeado con borde blanco
  - Badge de tipo de tarjeta
  - Badge de urgencia para tarjetas laborales
  - Rango salarial con formato
  - Tags de contrato/modalidad/experiencia
  - Lista de requisitos resumida
  - Botón de acción estilo burbuja

### 6. Headers Simplificados
- **Dashboard:** Solo logo, Tienda PIUP, logout
- **Feed:** Website (solo desktop), Tienda, Notificaciones, Panel

---

## Fase 10: BRUNO IA Mejorada y Álbumes Internos (Completado 2025-03-10)

### 1. BRUNO IA - Comunicación Directa
- **Antes:** Respuestas largas con "¡Hola!", "¡Por supuesto!", emojis excesivos
- **Ahora:** Directo al punto, amistoso pero eficiente
- **Formato:** Máximo 2-3 líneas para preguntas simples
- **Capacidades activas:** Búsqueda de tarjetas, guía de navegación, resolución de problemas
- **Ejemplos integrados:** Muestra formato correcto vs incorrecto en el prompt
- **Archivo:** `/app/backend/server.py` - `BRUNO_SYSTEM_MESSAGE`

### 2. Sistema de Álbumes Internos
- **Funcionalidad:** Galería privada tipo "Guardados" de Instagram
- **CRUD completo:**
  - `POST /api/albums` - Crear álbum
  - `GET /api/albums` - Listar álbumes
  - `GET /api/albums/{id}` - Obtener álbum
  - `PUT /api/albums/{id}` - Actualizar álbum
  - `DELETE /api/albums/{id}` - Eliminar álbum
- **Media:**
  - `POST /api/albums/{id}/media` - Añadir foto/video
  - `GET /api/albums/{id}/media` - Listar media
  - `DELETE /api/albums/{id}/media/{media_id}` - Eliminar media
  - `POST /api/albums/upload` - Upload a Cloudinary
- **Archivos:**
  - `/app/backend/routers/albums.py` (NUEVO)
  - `/app/frontend/src/pages/AlbumsPage.jsx` (NUEVO)
  - `/app/frontend/src/pages/MyProfilePage.jsx` - Tab añadido
- **Colecciones DB:** `albums`, `album_media`

---

## Próximas Tareas (Backlog)

### P0 - Urgentes
- [ ] Bug Safari/iPhone: Usuarios nuevos ven versión antigua (cache issue)

### P1 - Importantes
- [ ] Algoritmos de recomendación estilo TikTok/Facebook
- [ ] Configuración de datos de usuario (editar/actualizar más campos)
- [ ] Más opciones en Settings (privacidad, notificaciones avanzadas)

### P2 - Deseables
- [ ] Finalizar monetización con pasarela de pago real (Stripe)
- [ ] Más legales y condiciones
- [ ] Refactoring de server.py (mover profile, AI a routers)
- [ ] Soporte completo de archivos en chat

---

## Fase 11: Cámara Potenciada y BRUNO IA Acciones (Completado 2025-03-10)

### 1. Cámara con Filtros TikTok/Snapchat
- **Biblioteca:** face-api.js para detección facial en tiempo real
- **Modelos en:** `/app/frontend/public/models/`
- **Filtros de Color (16):**
  - Original, Beauty, Glow, Soft, Vivid, Warm, Cool, Sunset
  - Vintage, Drama, B&N, Cinema, Neon, Dreamy, Pop Art, Midnight
- **Filtros de Belleza (5 niveles):**
  - Natural, Suave, Medio, Alto, Máximo
  - Suaviza piel con blur y ajuste de brillo
- **Filtros AR Animalitos (12):**
  - Gatito, Perrito, Conejito (con orejas, nariz, bigotes)
  - Corona dorada con joyas
  - Corazones, Estrellas, Brillos (partículas animadas)
  - Arcoíris, Rayos de Sol, Luna, Lluvia (efectos especiales)
- **Stickers (16):** Emojis populares (corazón, fuego, estrella, etc.)
- **Texto:** 6 estilos (Normal, Bold, Neón, Elegante, Retro, Tech) + 10 colores
- **Archivo:** `/app/frontend/src/pages/BrunoCameraPage.jsx` (completamente reescrito)

### 2. BRUNO IA Crea Tarjetas Automáticamente
- **Endpoint:** `POST /api/ai/generate-card`
- **Input:** Descripción en lenguaje natural (ej: "Soy plomero en CDMX")
- **Output:** 
  - `card_type` detectado automáticamente
  - `suggested_fields` con título, subtítulo, descripción, servicios, color
  - Para trabajos: salario, contrato, modalidad, requisitos
- **Integración Frontend:**
  - BRUNO IA detecta intención de crear tarjeta
  - Genera datos con IA
  - Redirige a /cards/new?from_ai=true
  - Muestra banner "Tarjeta generada con BRUNO IA"
  - Pre-llena el formulario con datos sugeridos
- **Archivos modificados:**
  - `/app/backend/server.py` - Endpoint /api/ai/generate-card
  - `/app/frontend/src/components/FloatingBubbles.jsx` - Detección de intención
  - `/app/frontend/src/pages/CreateCardPage.jsx` - Recibe datos de IA

---


## Fase 12: Notificaciones Push Completas (Completado 2025-03-10)

### 1. Sistema de Push Notifications
- **Backend:** `/app/backend/routers/push_notifications.py`
- **Endpoints:**
  - `GET /api/push/vapid-public-key` - Clave VAPID pública
  - `POST /api/push/subscribe` - Suscribir dispositivo
  - `DELETE /api/push/unsubscribe` - Desuscribir dispositivo
  - `GET /api/push/subscriptions` - Listar suscripciones del usuario
  - `POST /api/push/test` - Enviar notificación de prueba
- **VAPID Keys:** Configuradas en `/app/backend/.env`
- **Library:** pywebpush para envío de notificaciones

### 2. Triggers de Notificaciones Push
Integrados en `/app/backend/server.py`:
- **Mensajes:** Líneas 3522-3566 - `notify_new_message()`
- **Likes:** Líneas 2936-2952 - `notify_new_like()`
- **Comentarios:** Líneas 2984-3003 - `notify_new_comment()`
- **Follows:** Líneas 3169-3192 - `notify_new_follower()`
- **Llamadas de video:** Líneas 4090-4102 - `send_push_notification()`

### 3. Frontend
- **Hook:** `/app/frontend/src/hooks/usePushNotifications.js`
- **UI:** `/app/frontend/src/pages/NotificationSettingsPage.jsx`
- **Service Worker:** `/app/frontend/public/sw.js` (v3)
- **VAPID Public Key:** En `/app/frontend/.env`

### 4. Colección MongoDB
- `push_subscriptions`: `{ id, user_id, endpoint, keys, created_at, last_used }`

### 5. Bug Fix
- Corregido `GET /api/notifications` - Ahora maneja notificaciones sin `actor_id`

---

## Test Reports
- `/app/test_reports/iteration_26.json` - Push notifications y camera (100% pass)
- `/app/test_reports/iteration_27.json` - UI fixes: BubbleSelect, templates, chat (100% pass)
- `/app/test_reports/iteration_28.json` - Nav, hipervinculos, NFC PIUP Manager (100% - 12/12 backend, 100% frontend)

---

## Fase 13: Correcciones UI - Cards, Chat, Templates (Completado 2025-03-11)

### 1. BubbleSelect Z-Index Fix
- **Problema:** Dropdown de tipo de tarjeta quedaba detras de la seccion de plantillas
- **Solucion:** Uso de createPortal para renderizar el dropdown fuera del stacking context
- **Z-index:** Overlay 99998, Options 99999
- **Archivo:** `/app/frontend/src/components/BubbleSelect.jsx`

### 2. Preview de Tarjetas Adaptable a Plantilla
- **Problema:** La vista previa no cambiaba al seleccionar diferentes plantillas
- **Solucion:** 3 layouts de preview basados en template_id:
  - **Default (Beacons-style):** Avatar centrado, nombre, social links, boton CTA
  - **edge_actions:** Iconos QR y compartir en el borde del avatar
  - **full_banner_bubble:** Banner dominante con burbuja de info semitransparente
- **Archivo:** `/app/frontend/src/pages/CreateCardPage.jsx` (preview section)

### 3. TemplateSelector Expandido
- **Nuevos tipos soportados:** servicios, mascotas, oferta_trabajo, busqueda_personal, solicitud_servicio
- **Cada tipo** tiene sus propias plantillas especificas + edge_actions + full_banner_bubble
- **Diseno visual mejorado:** Mini-preview con gradientes por tipo de plantilla
- **Archivo:** `/app/frontend/src/components/TemplateSelector.jsx`

### 4. Chat Mejorado
- **Header compacto:** Avatar + nombre + estado en linea (mas pequeno)
- **Navegacion a perfil:** Click en avatar/nombre navega a /profile/{userId}
- **Iconos de llamada:** Phone y Video en el header del chat
- **FloatingChatBubble:** Ahora incluye iconos de Phone y Video en el header
- **Chat list:** Items mas compactos con avatares de 12x12 -> 12x12
- **Archivos:** `/app/frontend/src/pages/ChatPage.jsx`, `/app/frontend/src/components/FloatingChatBubble.jsx`

---

## Fase 14: Navegacion, Hipervinculos y NFC PIUP Manager (Completado 2025-03-11)

### 1. Navegacion Inferior Reorganizada
- **Archivo:** `/app/frontend/src/components/MobileBottomNav.jsx`

### 2. Hipervinculos de Perfil Corregidos
- **Archivos:** PostCard.jsx, FeedPage.jsx, ChatPage.jsx

### 3. NFC PIUP Manager Completo
- **Archivos:** NFCManagerPage.jsx, server.py

---

## Fase 15: Reels TikTok, Mascotas BRUNO (Completado 2025-03-15)

### 1. ReelsPage TikTok-Style (/reels y /lives unificados)
### 2. Mascotas BRUNO (logo, perro visto chat, personajes onboarding)
### 3. Chat Profile Navigation Fix (e.stopPropagation en ChatList)
### 4. Navegacion: Inicio > Tienda > Reels > Camara > Mapa > Alertas > Perfil

---

## Fase 16: Dashboard en Perfil + Paginas Legales (Completado 2025-03-15)

### 1. Dashboard Migrado al Perfil
- **Tab "Tarjetas"** en MyProfilePage con panel completo:
  - Stats: total tarjetas, vistas, publicas
  - Grid/List toggle
  - Acciones: crear, editar, compartir, QR, eliminar
  - Botones: Nueva Tarjeta + NFC Manager
- **/dashboard** redirige a /my-profile (Navigate)
- **Endpoint:** GET /api/cards/explore para tarjetas publicas

### 2. Paginas Legales Completas
- **/legal** - Hub legal con 6 secciones
- **/cookies** - Politica de Cookies
- **/legal/community** - Normas de la Comunidad (contenido, sanciones, NFC)
- **/legal/data-rights** - Derechos GDPR (acceso, rectificacion, olvido, portabilidad)
- **Settings** tiene link a Legal y Condiciones

---

## Test Reports
- iteration_26-30.json - Todos 100% pass

---

## Proximas Tareas

### P1 - Importantes
- [ ] Correcciones de tarjetas (plantillas, estilos, actualizacion)
- [ ] Bug Safari/iPhone: Verificar fix de cache
- [ ] Algoritmos de recomendacion

### P2 - Deseables
- [ ] Monetizacion Stripe
- [ ] Refactoring server.py
- [ ] Configuracion expandida usuario

---

*Last Updated: 2025-03-15 - Fase 16: Dashboard en perfil, paginas legales*
