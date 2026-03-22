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

### Fase 20: For You Feed + Settings Expandido (2025-03-22)
- **Feed "Para Ti" personalizado:** Algoritmo que puntua posts por:
  - Posts de usuarios seguidos (peso alto)
  - Posts con hashtags del historial de interacciones (peso medio-alto)
  - Posts trending con muchos likes/comentarios (peso medio)
  - Posts de descubrimiento de nuevos usuarios (peso bajo)
  - Cada post muestra razon de recomendacion: "De alguien que sigues", "Basado en tus intereses", "Trending"
- **Interaction Tracking:** POST /api/feed/interaction registra views, clicks, expands, shares, dwell time
- **Settings Completo:** Pagina /settings con secciones:
  - Cuenta: editar perfil, contrasena, bloqueados
  - Notificaciones: toggles para likes, comentarios, follows, mensajes, menciones
  - Privacidad: estado online, confirmaciones lectura, quien puede enviar mensajes, visibilidad perfil
  - Contenido: autoplay videos, contenido sensible, visibilidad por defecto de posts
  - Apariencia: tema (claro/oscuro/sistema), idioma (es/en/pt), modo de feed (Para Ti/Cronologico)
- **Panel de Perfil mejorado:** Links directos a /settings, /saved, /analytics, /nfc-manager

---

## API Endpoints (Fase 20 new)
- GET /api/feed/for-you - Feed personalizado con _for_you_reason
- POST /api/feed/interaction - Tracking de interacciones
- GET /api/settings/preferences - Obtener preferencias
- PUT /api/settings/preferences - Actualizar preferencias

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
- iteration_34.json - For You feed + Settings (100% - 30/30 backend)
- iteration_33.json - Modern social features (100% - 27/27 backend)
- iteration_32.json - Nav responsive + Social system (100%)
- iteration_31.json - Camara TikTok + Safari cache (100%)

---

## Proximas Tareas

### P1 - Correcciones
- [ ] Correcciones de tarjetas (templates, estilos avanzados, preview mejorada)

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
- [ ] DMs mejorados

---

*Last Updated: 2025-03-22 - Fase 20: For You Feed Personalizado + Settings Expandido*
