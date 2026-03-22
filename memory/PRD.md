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
- **Nav bar responsive:** Visible en TODAS las pantallas (mobile, tablet, desktop). Eliminado md:hidden.
- **Follow/Unfollow:** Toggle completo con actualización de contadores en tiempo real
- **Block/Unblock:** Con auto-unfollow bidireccional. Pantalla de bloqueo con opción desbloquear
- **Report:** Opción de reportar usuario desde menú contextual
- **Followers/Following lists:** Modal clickeable desde contadores en perfil propio y ajeno
- **UserProfilePage:** Mejorado con botones de follow/chat/block/report + tabs posts/media/tarjetas
- **MyProfilePage:** Contadores de seguidores/siguiendo clickeables con modal de lista

---

## API Endpoints Clave

### Auth
- POST `/api/auth/register`, `/login`, `/logout`
- GET `/api/auth/me`, `/api/auth/google`

### Social (NEW in Fase 18)
- POST `/api/users/{userId}/follow` - Toggle follow
- POST `/api/users/{userId}/block` - Toggle block (auto-unfollows)
- GET `/api/users/{userId}/followers` - List followers
- GET `/api/users/{userId}/following` - List following
- GET `/api/users/me/blocked` - List blocked users
- GET `/api/users/{userId}/profile` - Profile with is_following, is_blocked_by_me, is_blocked_by_them

### Cards, Posts, Upload, Chat, Store, NFC, etc.
(Endpoints detallados en fases anteriores)

---

## 3rd Party Integrations
- **OpenAI GPT-5.2:** Text Generation (Emergent LLM Key)
- **Daily.co:** Video/Audio Calls (MOCKED)
- **Cloudinary:** Image Storage
- **Emergent Google Auth:** Social Login
- **Leaflet/OpenStreetMap:** Maps
- **face-api.js:** AR Filters

---

## Test Reports
- iteration_32.json - Nav responsive + Social system (100%)
- iteration_31.json - Camara TikTok + Safari cache (100%)
- iteration_30.json - Dashboard en perfil + legales (100%)

---

## Proximas Tareas

### P1 - Correccion de tarjetas
- [ ] Templates y estilos de tarjetas mejorados
- [ ] Vista previa correcta por tipo de tarjeta

### P1 - Algoritmos de recomendacion
- [ ] Tracking de interacciones (likes, vistas, guardados)
- [ ] Perfiles de preferencias

### P2 - Monetizacion
- [ ] Stripe real para pagos
- [ ] Planes premium

### P2 - Refactoring
- [ ] server.py -> routers modulares
- [ ] MyProfilePage.jsx -> sub-componentes

### P3 - Backlog
- [ ] Encuestas en Stories
- [ ] Reacciones animadas
- [ ] RESEND para emails reales
- [ ] Configuracion expandida de usuario
- [ ] Push notifications reales

---

*Last Updated: 2025-03-22 - Fase 18: Nav Responsive + Social System (Follow/Block/Report)*
