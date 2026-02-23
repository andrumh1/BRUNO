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
- Botones de llamada/videollamada (UI lista)
- `/app/frontend/src/pages/ChatPage.jsx` - Reescrito completamente
- Endpoints: `/api/upload/audio`, `/api/upload/file` - Creados

#### 8. Feed con Reels
- Tab de "Reels" para videos
- Filtro de posts con contenido de video
- Vista de video estilo TikTok/Instagram
- Estado vacío cuando no hay reels
- `/app/frontend/src/pages/FeedPage.jsx` - Actualizado

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
- [ ] Videollamadas funcionales (WebRTC/Daily.co)

#### Páginas Web
- [ ] BRUNO.com - Sitio web oficial

---

## FASE 2 - Mejoras de UX (Próximo)

- [ ] Feed con Reels
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
- `PUT /api/auth/me` - Actualizar usuario (NUEVO)
- `POST /api/auth/logout` - Logout (NUEVO)

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

### Nuevos/Actualizados
- `/app/frontend/src/contexts/AuthContext.js` - Sesión persistente
- `/app/frontend/src/components/CardVariants.jsx` - Variantes de tarjetas
- `/app/frontend/src/pages/MapPage.jsx` - Mapa estilo Snapchat
- `/app/frontend/src/pages/CreateCardPage.jsx` - Tipo Servicios
- `/app/frontend/src/pages/StorePage.jsx` - Nuevas categorías
- `/app/backend/server.py` - 36 productos, endpoints auth, BRUNO IA mejorado

---

## Test Credentials
- **User 1:** `newtest@bruno.com` / `Test1234!`
- **User 2:** `chattest2@bruno.com` / `Test1234!`

---

*Last Updated: 2026-02-23 - Fase 1 en progreso*
