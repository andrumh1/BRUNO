# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a polished PWA with social networking features, e-commerce, and AI assistant.

---

## FASE 1 - Correcciones Críticas (COMPLETADO)

### Completado

#### 1. Sistema de Usuarios Mejorado
- Sesión persistente con opción de mantener sesión
- Endpoints de logout y actualización de perfil
- Cache de usuario en localStorage para carga rápida
- Manejo de errores de autenticación mejorado
- `/app/frontend/src/contexts/AuthContext.js` - Actualizado

#### 2. Tienda PIUP Ampliada (36 productos)
**Categorías implementadas:**
- Tarjetas NFC (Negro, Blanco, Naranja, Dorado, Holográfica)
- Carnets empresariales
- Hogar (WiFi, Despensa, Alarma, Emergencia, Llaveros GPS)
- Restaurantes y Comercios (Menú QR, WiFi, Redes, AR productos)
- Oficinas (Citas, Apps, Pagos, Web, Inventario, Acceso, Archivos)
- Mascotas (Tags básicos, GPS, Collares completos)
- Guardian (Pulseras adultos, infantiles)
- Habladores (Mesa, Pared, Mostrador, A-Frame)
- Servicios (Diseño personalizado, Configuración empresarial)
- MEOW APP (Redes sociales, Branding, Publicidad)

#### 3. Mapa Estilo Snapchat
- Diseño visual similar a Snapchat
- Cálculo de distancias (fórmula Haversine)
- Marcadores con avatares de tarjetas
- Lista de tarjetas con distancia
- Botón "Cómo llegar" abre Google/Apple Maps

#### 4. Variantes de Tarjetas
- `MiniCard` - Para mapas y selecciones rápidas
- `MediumCard` - Para listados y grids  
- `LargeCard` - Presentación completa
- `MapMarkerCard` - Marcadores en mapa
- Botón de Chat integrado en cada tarjeta

#### 5. Nuevo Tipo de Tarjeta: Servicios
- Para emprendedores y freelancers
- Campos adicionales: services, products, pricing, portfolio
- Template: servicios_portfolio

#### 6. BRUNO IA Mejorado
- System message extensivo con toda la info de la app
- Conocimiento de todas las categorías de productos
- Guía de diseño de tarjetas
- Información de MEOW APP partner
- **NUEVO: Sistema de Recomendaciones Inteligentes**
- Busca tarjetas, posts y reels relevantes
- Comparte tarjetas con usuarios que las buscan

#### 7. Chat Mejorado
- Grabación y envío de notas de voz
- Envío de archivos (documentos, PDFs)
- Diseño de burbujas mejorado
- Indicador de "escribiendo..."
- Menú de adjuntos (imagen, archivo, tarjeta, sticker)
- **Videollamadas y llamadas de voz funcionales**
- **Stickers y tarjetas compartibles**

#### 8. Feed con Reels
- Tab de "Reels" para videos
- Filtro de posts con contenido de video
- Vista de video estilo TikTok/Instagram

#### 9. Videollamadas y Llamadas de Voz
- Integración completa de videollamadas en el chat
- Llamadas de solo voz con diseño minimalista
- Backend endpoints completos
- WebSocket notifications para llamadas entrantes

#### 10. Sistema de Puntos/Gamificación
- Sistema completo de puntos y niveles
- Niveles: Novato → Activo → Popular → Influencer → Embajador → Leyenda
- Check-in diario con rachas
- Leaderboard con ranking de usuarios

#### 11. Notificaciones Push
- Infraestructura completa para notificaciones push
- Service Worker configurado
- Preferencias configurables por tipo

#### 12. Stickers en Chat
- 4 packs de stickers: BRUNO, Emojis HD, Reacciones, Negocios
- Búsqueda de stickers
- Stickers recientes

#### 13. Tour de Bienvenida
- Tour interactivo guiado por BRUNO IA
- 9 pasos informativos
- Auto-show para usuarios nuevos

#### 14. Compartir Tarjetas en Chat
- CardPicker para seleccionar tarjetas
- Vista previa visual con colores de la tarjeta

#### 15. Página Web BRUNO.com
- Landing page marketing completa
- Feature cards, pricing, testimonios

---

## FASE 2 - Marketplace y Stories (COMPLETADO 2025-02-26)

### 16. Marketplace Completo
- **Backend Router:** `/app/backend/routers/marketplace.py` (416 líneas)
- **Categorías:** 10 categorías (Electrónica, Ropa, Hogar, Servicios, Vehículos, Deportes, Belleza, Alimentos, Arte, Otros)
- **Productos:**
  - CRUD completo (crear, leer, actualizar, eliminar)
  - Filtros: categoría, precio min/max, condición, ubicación, búsqueda
  - Ordenamiento: más recientes, precio asc/desc, populares
  - Imágenes múltiples (hasta 10)
  - Condiciones: Nuevo, Usado, Reacondicionado
  - Envío configurable
- **Carrito de compras:**
  - Agregar/quitar productos
  - Control de cantidad
  - Subtotales y total
  - Vaciar carrito
- **Favoritos:** Toggle de favoritos con contador
- **Mis Productos:** Dashboard con estadísticas (vistas, favoritos)
- **Frontend Pages:**
  - `MarketplacePage.jsx` - Listado con grid/list view
  - `ProductDetailPage.jsx` - Detalle de producto
  - `NewProductPage.jsx` - Formulario de creación
  - `CartPage.jsx` - Carrito de compras
  - `MyProductsPage.jsx` - Gestión de productos propios

### 17. Stories de 24 Horas (Estilo Instagram)
- **Backend Router:** `/app/backend/routers/stories.py`
- **Características:**
  - Expiración automática a las 24h
  - Visibilidad: público, seguidores, privado
  - Soporte para imagen y video
  - Captions opcionales
  - Contador de vistas
  - Reacciones
- **Frontend Components:**
  - `Stories.jsx` - StoriesRow, StoryViewer, CreateStoryModal
  - Integrado en FeedPage
  - Navegación tap izquierda/derecha
  - Progress bars automáticas
  - Pausa/play

### 18. Stories Estáticas en Cards (Catálogos)
- **Backend:** Endpoints en `/app/backend/routers/stories.py`
- **Características:**
  - Sin expiración (permanentes)
  - Vinculadas a tarjetas específicas
  - Título, descripción, precio, link externo
  - Orden personalizable
  - Contador de vistas
- **Frontend Component:**
  - `CardStories.jsx` - CardStoriesGallery, CardStoryViewer, AddCardStoryModal
  - Scroll horizontal tipo carrusel
  - Edición inline para propietarios

### 19. Bruno IA con Recomendaciones
- **Nuevo Endpoint:** `POST /api/ai/recommend`
- **Funcionalidades:**
  - Búsqueda inteligente de tarjetas públicas
  - Búsqueda de posts por contenido y hashtags
  - Tipos: cards, posts, all
  - Mensaje contextual con resultados
- **Endpoint:** `GET /api/ai/share-card/{card_id}`
  - Comparte tarjeta recomendada vía chat
  - Crea conversación si no existe
  - Notificación WebSocket

---

## API Endpoints

### Auth
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual
- `PUT /api/auth/me` - Actualizar usuario
- `POST /api/auth/logout` - Logout
- `POST /api/auth/google` - Login Google

### Marketplace (NUEVO)
- `GET /api/marketplace/categories` - Lista categorías
- `GET /api/marketplace/products` - Lista productos con filtros
- `POST /api/marketplace/products` - Crear producto
- `GET /api/marketplace/products/{id}` - Detalle producto
- `PUT /api/marketplace/products/{id}` - Actualizar producto
- `DELETE /api/marketplace/products/{id}` - Eliminar producto
- `POST /api/marketplace/products/{id}/favorite` - Toggle favorito
- `GET /api/marketplace/my-products` - Mis productos
- `GET /api/marketplace/cart` - Ver carrito
- `POST /api/marketplace/cart/add` - Agregar al carrito
- `DELETE /api/marketplace/cart/{product_id}` - Quitar del carrito
- `DELETE /api/marketplace/cart` - Vaciar carrito

### Stories (NUEVO)
- `POST /api/stories/` - Crear story 24h
- `GET /api/stories/feed` - Feed de stories
- `GET /api/stories/user/{user_id}` - Stories de un usuario
- `POST /api/stories/{id}/view` - Marcar como vista
- `POST /api/stories/{id}/react` - Reaccionar
- `DELETE /api/stories/{id}` - Eliminar story

### Card Stories (NUEVO)
- `POST /api/stories/card` - Crear story de catálogo
- `GET /api/stories/card/{card_id}` - Stories de una tarjeta
- `PUT /api/stories/card/{story_id}` - Actualizar
- `DELETE /api/stories/card/{story_id}` - Eliminar
- `PUT /api/stories/card/{card_id}/reorder` - Reordenar

### AI Recommendations (NUEVO)
- `POST /api/ai/recommend` - Buscar tarjetas/posts
- `GET /api/ai/share-card/{card_id}?target_user_id=` - Compartir tarjeta

### Videollamadas
- `POST /api/calls/start` - Iniciar llamada
- `POST /api/calls/{id}/answer` - Responder
- `POST /api/calls/{id}/decline` - Rechazar
- `POST /api/calls/{id}/end` - Terminar

### Sistema de Puntos
- `GET /api/points/me` - Puntos del usuario
- `POST /api/points/daily-check-in` - Check-in diario
- `GET /api/points/leaderboard` - Ranking
- `GET /api/points/history` - Historial

---

## Key Files

### Backend Routers
- `/app/backend/routers/marketplace.py` - Marketplace completo
- `/app/backend/routers/stories.py` - Stories 24h y Card Stories
- `/app/backend/routers/auth.py` - Autenticación
- `/app/backend/routers/video_calls.py` - Videollamadas
- `/app/backend/routers/points.py` - Sistema de puntos
- `/app/backend/routers/notifications.py` - Notificaciones

### Frontend Pages
- `/app/frontend/src/pages/MarketplacePage.jsx`
- `/app/frontend/src/pages/ProductDetailPage.jsx`
- `/app/frontend/src/pages/CartPage.jsx`
- `/app/frontend/src/pages/NewProductPage.jsx`
- `/app/frontend/src/pages/MyProductsPage.jsx`
- `/app/frontend/src/pages/FeedPage.jsx` - Con Stories integradas
- `/app/frontend/src/pages/MyProfilePage.jsx`

### Frontend Components
- `/app/frontend/src/components/Stories.jsx`
- `/app/frontend/src/components/CardStories.jsx`
- `/app/frontend/src/components/ReelsFeed.jsx`
- `/app/frontend/src/components/StickerPicker.jsx`
- `/app/frontend/src/components/CardPicker.jsx`

---

## Test Credentials
- **User 1:** `newtest@bruno.com` / `Test1234!`
- **User 2:** `chattest2@bruno.com` / `Test1234!`

---

## Test Reports
- `/app/test_reports/iteration_15.json` - Marketplace, Stories, AI Recommendations (100% pass)
- `/app/test_reports/iteration_13.json` - Welcome Tour, Card Sharing, Website
- `/app/test_reports/iteration_12.json` - Points, Notifications, Stickers
- `/app/test_reports/iteration_11.json` - Audio calls

---

## Próximas Tareas (Backlog)

### P0 - Alta Prioridad
- [ ] Continuar refactoring de server.py a routers modulares
- [ ] Integración de pagos en Marketplace (Stripe)
- [ ] Upload real de archivos multimedia a Cloudinary para Stories

### P1 - Media Prioridad
- [ ] Mapa UI completo estilo Snapchat con ubicaciones en tiempo real
- [ ] Vistas de Cards miniatura y lista para mapa
- [ ] Templates de Cards editables
- [ ] Feed con ubicaciones y actualizaciones públicas de cards

### P2 - Baja Prioridad
- [ ] Niveles de suscripción con diferencias claras
- [ ] Modelo de seguridad avanzado
- [ ] Chat burbuja flotante expandible
- [ ] Acciones del BRUNO IA para manipular sistema (crear/editar tarjetas)

---

## 3rd Party Integrations
- **OpenAI GPT-5.2:** Text Generation (via Emergent LLM Key)
- **Daily.co:** Video/Audio Calls (MOCKED - uses demo domain)
- **Cloudinary:** Image/File Storage
- **Stripe:** Payments (key available in environment)
- **Emergent Google Auth:** Social Login
- **Web Push:** Notifications (MOCKED - stores subscriptions only)

---

*Last Updated: 2025-02-26 - Marketplace, Stories 24h, Card Stories, AI Recommendations implementados y testeados*
