# BRUNO - Digital Business Card Application

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

## Fases Completadas (Resumen)

### Fases 1-12: Core Features
- Auth, Cards, Chat, Feed, Marketplace, Stories, Notificaciones
- Badges, Mapa Leaflet, Store Router, Analytics
- Camara con filtros, Mascota BRUNO IA, Navegacion movil
- Privacidad, Terminos, Eliminacion cuenta, Reportes
- Lives TikTok, Monetizacion, Moderacion
- UI Compacta, Tarjetas Laborales, Albums
- BRUNO IA Acciones (crear tarjetas auto), Push Notifications

### Fase 13-16: UI Fixes & Features
- BubbleSelect z-index fix, Templates, Chat mejorado
- Navegacion reorganizada, NFC PIUP Manager
- Reels TikTok, Mascotas BRUNO integradas
- Dashboard migrado al perfil, Paginas legales

### Fase 17: Camara TikTok + Safari Cache Fix (2025-03-22)

#### 1. Camara Estilo TikTok
- **Archivo:** `/app/frontend/src/pages/BrunoCameraPage.jsx` (completamente rediseñado)
- **Layout inmersivo full-screen** estilo TikTok/Instagram
- **Barra lateral derecha** con iconos: Voltear, Belleza, Efectos AR, Timer
- **Carrusel de filtros** horizontal con miniaturas circulares (16 filtros de color)
- **Selector de modo** deslizable: Foto / 15s / 60s con highlight activo
- **Boton de captura grande** con anillo de progreso SVG para grabacion
- **Post-captura:** Sidebar de edicion (Filtros, Stickers, Texto) + Repetir/Caption/Publicar
- **Publicacion corregida:** Upload a Cloudinary -> Crear post (2 pasos)
- **"Agregar sonido"** placeholder en header superior
- **Glassmorphism** en paneles y botones laterales
- **data-testid** completos para testing

#### 2. Safari/iPhone Cache Fix
- **Service Worker v4:** `/app/frontend/public/sw.js`
  - Network-first para HTML (cache: 'no-store' para navegacion)
  - Cache de assets estaticos (js, css, imagenes) con fallback offline
  - Purga agresiva de caches antiguos al activar
- **SW Registration:** `updateViaCache: 'none'` en NotificationContext.js
- **Meta tags anti-cache** ya existentes en index.html
- **Resultado:** Usuarios nuevos en Safari veran siempre la version mas reciente

---

## API Endpoints Clave

### Auth
- `/api/auth/register`, `/login`, `/logout`, `/me`, `/google`

### Upload
- `POST /api/upload/image` - Subir imagen a Cloudinary
- `POST /api/upload/audio` - Subir audio
- `POST /api/upload/file` - Subir archivo generico

### Posts
- `POST /api/posts` - Crear post (content, media, post_type)
- `GET /api/posts` - Listar posts del feed
- `DELETE /api/posts/{id}` - Eliminar post

### Cards, Chat, Store, NFC, Analytics, Lives, etc.
(Ver fases anteriores para detalle completo)

---

## 3rd Party Integrations
- **OpenAI GPT-5.2:** Text Generation (Emergent LLM Key)
- **Daily.co:** Video/Audio Calls (MOCKED)
- **Cloudinary:** Image/File Storage
- **Stripe:** Payments (prepared)
- **Emergent Google Auth:** Social Login
- **Resend:** Email (prepared)
- **Leaflet/OpenStreetMap:** Interactive Maps
- **face-api.js:** AR Filters en camara

---

## Test Reports
- iteration_31.json - Camara TikTok + Safari cache (100% UI, publish fix aplicado)
- iteration_30.json - Dashboard en perfil + legales (100%)
- iteration_26-29.json - Push notifications, UI fixes, NFC (100%)

---

## Proximas Tareas

### P1 - Importantes
- [ ] Algoritmos de recomendacion (tracking interacciones)
- [ ] Correcciones de tarjetas (plantillas, estilos)
- [ ] Configuracion expandida de usuario

### P2 - Deseables
- [ ] Monetizacion con Stripe real
- [ ] Refactoring server.py (mover a routers)
- [ ] Refactoring MyProfilePage.jsx (sub-componentes)
- [ ] Encuestas en Stories, Reacciones animadas
- [ ] RESEND para emails reales

---

*Last Updated: 2025-03-22 - Fase 17: Camara TikTok-style, Safari Cache Fix v4*
