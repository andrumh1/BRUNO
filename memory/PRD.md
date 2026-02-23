# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a polished PWA with social networking features, e-commerce, and AI assistant.

---

## FASE 1 - Correcciones Críticas (EN PROGRESO)

### ✅ Completado

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
- Componente `MapMarkerCard` para marcadores
- `/app/frontend/src/pages/MapPage.jsx` - Actualizado

#### 4. Variantes de Tarjetas
- `MiniCard` - Para mapas y selecciones rápidas
- `MediumCard` - Para listados y grids  
- `LargeCard` - Presentación completa
- `MapMarkerCard` - Marcadores en mapa
- Botón de Chat integrado en cada tarjeta
- `/app/frontend/src/components/CardVariants.jsx` - Creado

#### 5. Nuevo Tipo de Tarjeta: Servicios
- Para emprendedores y freelancers
- Campos adicionales: services, products, pricing, portfolio
- Template: servicios_portfolio
- Actualizado en CreateCardPage.jsx

#### 6. BRUNO IA Mejorado
- System message extensivo con toda la info de la app
- Conocimiento de todas las categorías de productos
- Guía de diseño de tarjetas
- Información de MEOW APP partner
- `/app/backend/server.py` - BRUNO_SYSTEM_MESSAGE actualizado

#### 7. Chat Mejorado
- Grabación y envío de notas de voz
- Envío de archivos (documentos, PDFs)
- Diseño de burbujas mejorado
- Indicador de "escribiendo..."
- Menú de adjuntos (imagen, archivo, tarjeta, sticker)
- **NUEVO: Videollamadas funcionales**
- `/app/frontend/src/pages/ChatPage.jsx` - Reescrito completamente
- Endpoints: `/api/upload/audio`, `/api/upload/file` - Creados

#### 8. Feed con Reels
- Tab de "Reels" para videos
- Filtro de posts con contenido de video
- Vista de video estilo TikTok/Instagram
- Estado vacío cuando no hay reels
- `/app/frontend/src/pages/FeedPage.jsx` - Actualizado

#### 9. Videollamadas y Llamadas de Voz (NUEVO - 2025-02-23)
- **Integración completa de videollamadas en el chat**
- **Llamadas de solo voz con diseño minimalista**
- Backend endpoints: `/api/calls/start`, `/api/calls/{id}/answer`, `/api/calls/{id}/decline`, `/api/calls/{id}/end`
- Componente `VideoCallModal.jsx` con Daily.co para WebRTC
- `AudioOnlyControls` - Controles minimalistas para llamadas de voz
- UI de llamada de audio: ondas animadas verdes, cronómetro de duración
- Botones de llamada de voz y video en el header del chat
- Notificaciones WebSocket para llamadas entrantes
- Modal de llamada entrante con opciones de aceptar/rechazar
- Controles de cámara y micrófono durante la llamada
- Tests completos: 12/12 tests pasados
- `/app/frontend/src/components/VideoCallModal.jsx` - Actualizado
- `/app/backend/routers/video_calls.py` - Creado (router separado)

---

### 🔄 Pendiente Fase 1

#### Tarjetas
- [ ] Corrección de visualización de burbujas (info duplicada)
- [ ] Plantillas editables en modo edición
- [ ] Links NFC corregidos
- [ ] Preguntas según tipo de tarjeta

#### Chat
- [ ] Envío de stickers (UI lista, funcionalidad pendiente)
- [ ] Envío de tarjetas en chat
- [ ] Burbuja expandible flotante

#### Páginas Web
- [ ] BRUNO.com - Sitio web oficial

#### Backend Refactoring (En Progreso)
- [x] Crear estructura de routers (`/app/backend/routers/`)
- [x] Crear modelos separados (`/app/backend/models/`)
- [x] Crear utilidades (`/app/backend/utils/`)
- [x] Router de autenticación (`auth.py`)
- [x] Router de videollamadas (`video_calls.py`)
- [ ] Migrar resto de endpoints de server.py a routers separados

---

## FASE 2 - Mejoras de UX (Próximo)

- [ ] Feed con Reels completo
- [ ] Perfil tipo red social completo
- [ ] Sistema de puntos
- [ ] Tour de bienvenida
- [ ] Cuestionario de perfil

---

## FASE 3 - Nuevas Funcionalidades

- [ ] Suscripciones con diferencias claras
- [ ] Tarjetas preferenciales por suscripción
- [ ] Habladores para negocios

---

## FASE 4 - Expansión

- [ ] Página web BRUNO.com
- [ ] Integración completa MEOW APP

---

## API Endpoints

### Auth
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual
- `PUT /api/auth/me` - Actualizar usuario
- `POST /api/auth/logout` - Logout

### Videollamadas (NUEVO)
- `POST /api/calls/start` - Iniciar videollamada
- `POST /api/calls/{call_id}/answer` - Responder llamada
- `POST /api/calls/{call_id}/decline` - Rechazar llamada
- `POST /api/calls/{call_id}/end` - Terminar llamada

### Tienda
- `GET /api/store/products` - Lista productos (36 productos)
- Categorías: nfc_card, hogar, comercios, oficinas, mascotas, guardian, habladores, servicios, meow_services

### Mapa
- `GET /api/cards/public?with_location=true` - Tarjetas con ubicación

### BRUNO IA
- `POST /api/ai/chat` - Chat con IA
- `GET /api/ai/history` - Historial
- `DELETE /api/ai/history` - Limpiar historial

---

## Key Files

### Nuevos/Actualizados (Feb 2025)
- `/app/frontend/src/components/VideoCallModal.jsx` - Componente de videollamadas
- `/app/frontend/src/pages/ChatPage.jsx` - Chat con integración de videollamadas
- `/app/backend/routers/video_calls.py` - Router de videollamadas
- `/app/backend/routers/auth.py` - Router de autenticación
- `/app/backend/models/user.py` - Modelos de usuario
- `/app/backend/utils/security.py` - Utilidades de seguridad
- `/app/backend/utils/database.py` - Conexión a base de datos

### Archivos Existentes
- `/app/frontend/src/contexts/AuthContext.js` - Sesión persistente
- `/app/frontend/src/components/CardVariants.jsx` - Variantes de tarjetas
- `/app/frontend/src/pages/MapPage.jsx` - Mapa estilo Snapchat
- `/app/frontend/src/pages/CreateCardPage.jsx` - Tipo Servicios
- `/app/frontend/src/pages/StorePage.jsx` - Nuevas categorías
- `/app/backend/server.py` - Servidor principal (en proceso de refactorización)

---

## Test Credentials
- **User 1:** `newtest@bruno.com` / `Test1234!`
- **User 2:** `chattest2@bruno.com` / `Test1234!`

---

## Test Reports
- `/app/test_reports/iteration_8.json` - Chat system validation
- `/app/test_reports/iteration_9.json` - WebSocket bug fix
- `/app/test_reports/iteration_10.json` - Video calls (12/12 tests passed)

---

## Technical Notes

### Video Calls Implementation
- Uses Daily.co for WebRTC (currently with demo domain)
- For production: Set `DAILY_DOMAIN` env var with real Daily.co domain
- WebSocket notifications for real-time call events
- Full call lifecycle: start -> answer/decline -> end

### Backend Architecture (In Progress)
```
/app/backend/
├── server.py           # Main app (being refactored)
├── routers/
│   ├── auth.py        # Authentication routes
│   └── video_calls.py # Video call routes
├── models/
│   └── user.py        # User models
└── utils/
    ├── database.py    # MongoDB connection
    └── security.py    # Auth utilities
```

---

*Last Updated: 2025-02-23 - Videollamadas implementadas y testeadas*
