# BRUNO - Digital Business Card & Social Network

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a polished PWA with social networking features, e-commerce, and AI assistant.

---

## Los 9 Puntos Originales - TODOS COMPLETADOS

| # | Punto | Estado |
|---|-------|--------|
| 1 | **Mapa** estilo Snapchat | COMPLETADO |
| 2 | **Cards** multiples vistas | COMPLETADO |
| 3 | **Feed** fotos/videos/ubicaciones | COMPLETADO |
| 4 | **Chat** todos los medios, llamadas | COMPLETADO |
| 5 | **Tienda** NFC + MEOW APP | COMPLETADO |
| 6 | **BRUNO IA** asistente integrado | COMPLETADO |
| 7 | **Usuarios** sesion, seguridad, tour | COMPLETADO |
| 8 | **Website** BRUNO.com | COMPLETADO |
| 9 | **Perfil** posts, reels, cards | COMPLETADO |

---

## Fases Completadas

### Fases 1-16: Core Features + UI
(Ver historial completo en CHANGELOG)

### Fase 17: Camara TikTok + Safari Cache (2025-03-22)
- Camara rediseñada full-screen estilo TikTok con sidebar lateral, filtros circulares, modo foto/15s/60s
- Service Worker v4 con network-first para HTML, cache-busting para Safari/iPhone

### Fase 18: Nav Responsive + Social System (2025-03-22)
- Nav bar responsive visible en TODAS las pantallas (mobile, tablet, desktop)
- Follow/Unfollow con contadores, Block/Unblock con auto-unfollow, Report
- Followers/Following lists con modal clickeable

### Fase 19: Modernizacion Social Completa (2025-03-22)
- **Trending Hashtags:** Sidebar con hashtags mas usados, pagina dedicada /hashtag/{tag}
- **Personas Sugeridas:** Algoritmo por follows mutuos, usuarios populares y recientes
- **Bookmarks/Guardados:** Toggle en posts, pagina /saved con todos los guardados
- **Reacciones Multi-emoji:** like, love, fire, laugh, wow, sad - popup en long-press
- **Repost/Compartir:** Repostear en perfil, contador de shares, indicador visual
- **Hashtag Auto-parsing:** Extraccion automatica de hashtags del contenido
- **Explore Feed:** Descubrimiento por trending, recientes, media, cards
- **Polls/Encuestas:** Crear, votar, ver resultados - integrado con stories
- **PostCard Modernizado:** Acciones completas con bookmark, repost, reactions, hashtag pills
- **Feed Sidebar Desktop:** Tendencias + Sugeridos + Quick links en pantallas grandes

---

## API Endpoints Clave

### Auth: /api/auth/register, /login, /logout, /me, /google
### Social (Fase 18-19):
- POST /api/users/{id}/follow - Toggle follow
- POST /api/users/{id}/block - Toggle block
- GET /api/users/{id}/followers, /following
- GET /api/users/me/blocked
- POST /api/posts/{id}/bookmark - Toggle bookmark
- GET /api/posts/saved/list - Saved posts
- POST /api/posts/{id}/react?reaction_type={type} - Multi-emoji reaction
- GET /api/posts/{id}/reactions - Reaction counts
- POST /api/posts/{id}/repost - Repost with quote
- GET /api/social/trending - Trending hashtags
- GET /api/social/suggested - Suggested users
- GET /api/social/hashtag/{tag} - Posts by hashtag
- GET /api/social/explore?category={type} - Explore feed
- POST /api/social/polls - Create poll
- POST /api/social/polls/{id}/vote - Vote on poll
- GET /api/social/polls/{id} - Get poll

### Cards, Posts, Upload, Chat, Store, NFC, AI, etc.
(Endpoints detallados en fases anteriores)

---

## 3rd Party Integrations
- **OpenAI GPT-5.2:** Text Generation (Emergent LLM Key)
- **Daily.co:** Video/Audio Calls (MOCKED)
- **Cloudinary:** Image Storage
- **Emergent Google Auth:** Social Login
- **Leaflet/OpenStreetMap:** Maps
- **face-api.js:** AR Filters en camara

---

## Test Reports
- iteration_33.json - Modern social features (100% - 27/27 backend, frontend OK)
- iteration_32.json - Nav responsive + Social system (100% - 14/14)
- iteration_31.json - Camara TikTok + Safari cache (100%)
- iteration_30.json - Dashboard en perfil + legales (100%)

---

## Proximas Tareas

### P1 - Correcciones pendientes
- [ ] Correcciones de tarjetas (templates, estilos avanzados)
- [ ] Configuracion expandida de usuario

### P2 - Monetizacion y Refinamiento
- [ ] Stripe real para pagos
- [ ] Planes premium funcionales
- [ ] RESEND para emails reales

### P2 - Refactoring
- [ ] server.py -> routers modulares (mover endpoints sociales a /routers/social.py)
- [ ] MyProfilePage.jsx -> sub-componentes mas manejables

### P3 - Backlog
- [ ] Encuestas integradas en Stories UI
- [ ] Reacciones animadas (lottie/framer-motion)
- [ ] Push notifications reales con Firebase/Resend
- [ ] Algoritmo de recomendacion avanzado (ML)
- [ ] Mentions (@user) con autocomplete
- [ ] DMs (mensajes directos) desde perfil

---

*Last Updated: 2025-03-22 - Fase 19: Modernizacion Social Completa (Trending, Bookmarks, Reactions, Reposts, Polls)*
