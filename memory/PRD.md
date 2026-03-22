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

### Fases 1-16: Core Features + UI (ver CHANGELOG)
### Fase 17: Camara TikTok + Safari Cache Fix
### Fase 18: Nav Responsive + Social System (Follow/Block/Report)
### Fase 19: Modernizacion Social (Trending, Bookmarks, Reactions, Reposts, Polls, Hashtags, Explore)
### Fase 20: For You Feed Personalizado + Settings Expandido

### Fase 21: Correccion de Tarjetas (2025-03-22)
- **Overflow corregido:** ViewCardPage, BeaconsStyleCard, CardVariants - todos usan overflow-hidden + img tags (no background-image) para banners
- **Templates actualizados:** Banner como img con object-cover, gradientes como divs separados, contenedor con rounded-2xl
- **Edicion preserva ID/ruta:** PUT /api/cards/{id} mantiene mismo ID, todas las tarjetas compartidas se actualizan automaticamente
- **Rutas unificadas:** Todas las refs a /dashboard migradas a /my-profile (CreateCard, EditCard, ActivateNFC, etc.)
- **Propagacion de cambios:** Al editar una tarjeta, todos los que la guardaron/compartieron ven los cambios inmediatamente (mismo ID, misma URL /c/{id})
- **Card previews en perfil:** Banners contenidos con overflow-hidden

---

## API Endpoints Clave
### Cards: POST, GET, PUT, DELETE /api/cards/{id}, /api/cards/{id}/qr
### Social: follow, block, bookmark, react, repost, trending, suggested, hashtag, explore, polls
### Feed: /api/feed/for-you (personalizado), /api/feed/interaction (tracking)
### Settings: GET/PUT /api/settings/preferences
### Auth, Chat, Store, NFC, AI, etc.

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
- iteration_35.json - Card fixes (100% frontend, 88% backend)
- iteration_34.json - For You feed + Settings (100%)
- iteration_33.json - Modern social features (100%)
- iteration_32.json - Nav responsive + Social (100%)
- iteration_31.json - Camara TikTok (100%)

---

## Proximas Tareas

### P2 - Monetizacion
- [ ] Stripe real para pagos
- [ ] Planes premium funcionales
- [ ] RESEND para emails reales

### P2 - Refactoring
- [ ] server.py -> routers modulares
- [ ] MyProfilePage.jsx -> sub-componentes

### P3 - Backlog
- [ ] Encuestas integradas en Stories UI
- [ ] Reacciones animadas (lottie/framer-motion)
- [ ] Push notifications reales
- [ ] Algoritmo ML avanzado
- [ ] Mentions (@user) con autocomplete

---

*Last Updated: 2025-03-22 - Fase 21: Correccion de Tarjetas (overflow, templates, edicion, rutas)*
