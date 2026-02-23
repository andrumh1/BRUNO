# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a highly polished, visually appealing PWA with extensive customization and social networking features.

## What's Been Implemented

### Session: 2026-02-23 - Burbujas Flotantes ✅ NEW

**FloatingBubbles.jsx Implementado:**
- Burbuja de Chat (esquina inferior derecha) - acceso rápido a mensajes
- Burbuja de BRUNO IA (esquina inferior izquierda) - asistente IA (próximamente)
- Solo visible para usuarios logueados
- Contador de mensajes no leídos en la burbuja de chat
- Modal informativo de BRUNO IA con features próximas
- Ocultas en la página /chat para evitar duplicación

---

### Session: 2026-02-21 - Sistema de Chat Privado ✅

**Chat System Implementado:**

1. **ChatPage.jsx** ✅
   - Lista de conversaciones con último mensaje y hora
   - Vista de chat con mensajes agrupados por fecha
   - Búsqueda de conversaciones
   - Modal para iniciar nueva conversación
   - Soporte para envío de imágenes/videos
   - Polling automático cada 5 segundos para nuevos mensajes

2. **API Endpoints Chat** ✅
   - `GET /api/chats` - Lista de conversaciones del usuario
   - `POST /api/chats?participant_id={id}` - Crear/obtener chat directo
   - `GET /api/chats/{id}/messages` - Mensajes de un chat
   - `POST /api/chats/{id}/messages` - Enviar mensaje
   - `GET /api/users/search?q={query}` - Buscar usuarios

3. **Funcionalidades** ✅
   - Mensajes de texto
   - Adjuntar imágenes/videos
   - Indicador de mensaje leído (✓ / ✓✓)
   - Contador de mensajes no leídos
   - Preview del último mensaje en lista

4. **Navegación** ✅
   - Icono de chat en FeedPage para usuarios logueados
   - Rutas `/chat` y `/chat/:chatId`

---

### Session: 2026-02-18 - Red Social Profesional ✅

**Feed Social Implementado:**
- FeedPage con pestañas "Feed" y "Explorar"
- Crear posts de texto
- Likes con contador
- Comentarios
- Compartir posts

---

### Session Anterior - Bug Fixes & Store

**Completado:**
- Sincronización de tarjetas
- NFC redirect
- Tienda PIUP
- Animaciones Spring iOS

---

## Prioritized Backlog

### P0 (Completado)
- [x] Feed social con posts ✅
- [x] Likes y comentarios ✅
- [x] Sistema de chat privado ✅
- [x] **Burbujas flotantes (Chat + BRUNO IA)** ✅ NEW

### P1 (Próximo)
- [ ] Perfiles públicos de usuario
- [ ] Subir imágenes/videos a posts (mejorar CreatePost)
- [ ] Notificaciones en tiempo real (WebSockets)
- [ ] Notas de voz en chat

### P2 (Siguiente)
- [ ] Asistente IA "BRUNO" con GPT-5.2
- [ ] Sistema de suscripciones con Stripe
- [ ] Página web oficial de marketing

### P3 (Futuro)
- [ ] Panel admin
- [ ] Native apps
- [ ] Seguimiento de pedidos

---

## Test Credentials
- **Email:** `newtest@bruno.com`
- **Password:** `Test1234!`

## API Endpoints

### Chat System
- `GET /api/chats` - Lista de chats del usuario
- `POST /api/chats?participant_id={id}` - Crear chat directo
- `GET /api/chats/{id}/messages` - Obtener mensajes
- `POST /api/chats/{id}/messages` - Enviar mensaje
- `GET /api/users/search?q={query}` - Buscar usuarios

### Social Feed
- `POST /api/posts` - Crear post
- `GET /api/posts` - Feed de posts
- `POST /api/posts/{id}/like` - Toggle like
- `GET/POST /api/posts/{id}/comments` - Comentarios

## Key Files

### Floating Bubbles
- `/app/frontend/src/components/FloatingBubbles.jsx` - Burbujas flotantes Chat + IA
- `/app/frontend/src/App.js` - Incluido globalmente

### Chat System
- `/app/frontend/src/pages/ChatPage.jsx` - Página principal de chat
- `/app/frontend/src/App.js` - Rutas /chat y /chat/:chatId
- `/app/backend/server.py` - Endpoints (líneas 2656-2850)

### Social Feed
- `/app/frontend/src/pages/FeedPage.jsx` - Feed con tabs
- `/app/frontend/src/components/PostCard.jsx` - Post component
- `/app/frontend/src/components/CreatePost.jsx` - Crear post

## Data Models

### Chat
- **ChatRoom:** id, type, participants[], last_message_id, last_message_at
- **Message:** id, chat_id, sender_id, content, message_type, attachments[], is_read, read_by[]
- **MessageAttachment:** type, url, filename, size, duration

### Social
- **Post:** id, user_id, content, media[], likes_count, comments_count
- **Comment:** id, post_id, user_id, content
- **Like:** id, user_id, target_id, target_type

---

## Test Reports
- `/app/test_reports/iteration_7.json` - Tests de Red Social (100% passed)
- `/app/test_reports/iteration_8.json` - Tests de Chat (24/24 passed - 100%)

## Test Credentials (Chat Testing)
- **User 1:** `newtest@bruno.com` / `Test1234!`
- **User 2:** `chattest2@bruno.com` / `Test1234!`

*Last Updated: 2026-02-23*
