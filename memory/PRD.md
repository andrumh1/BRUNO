# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a highly polished, visually appealing PWA with extensive customization and social features.

## What's Been Implemented

### Session: 2026-02-18 (Current)

**1. Animaciones Spring iOS 26**
- Animación `bubble-spring-in` con `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Efecto de rebote al abrir/cerrar dropdowns
- Clases `.spring-button`, `.spring-card`, `.spring-modal`, `.spring-item`, `.spring-bounce`
- Animaciones staggered para listas

**2. Tienda PIUP (Personal Intelligent Unlock Point)**
- Página `/store` con catálogo de productos
- **Tarjetas NFC** en múltiples colores: Negro, Blanco, Naranja BRUNO, Dorado Premium, Holográfica ($15-$30)
- **Pulseras Guardian** de silicona con NFC para niños/adultos mayores ($10-$12)
- **Tags para Mascotas** con NFC básico y GPS Premium ($15-$45)
- **Servicios**: Diseño personalizado, Configuración empresarial
- Carrito de compras con sidebar animado
- Checkout con selección de direcciones guardadas
- Integración con Stripe para pagos

**3. Sistema de Datos Guardados del Usuario**
- Direcciones de envío guardadas (CRUD completo)
- Redes sociales favoritas reutilizables
- Datos personales (nombre, teléfono, email, avatar, bio)
- Referencias laborales guardadas
- Fotos/galería personal
- Métodos de pago guardados

**4. Planes de Suscripción Mejorados**
- **Gratis**: 1 tarjeta, QR básico, 1 plantilla, 3 fotos, 5 links sociales
- **Pro ($9.99/mes)**: 5 tarjetas, QR con logo, todas las plantillas, estadísticas, NFC, sin branding, 20 fotos
- **Business ($29.99/mes)**: Ilimitado, panel de equipo, dominio personalizado, API, CRM, soporte 24/7

**Archivos Creados/Modificados:**
- `/app/frontend/src/pages/StorePage.jsx` - NUEVO
- `/app/frontend/src/index.css` - Animaciones spring (~100 líneas)
- `/app/backend/server.py` - Modelos y endpoints de tienda (~400 líneas)
- `/app/frontend/src/pages/FeedPage.jsx` - Ícono de tienda en header
- `/app/frontend/src/App.js` - Rutas de tienda

---

### Session: 2026-02-15

**Dropdowns Móviles Corregidos:**
- Componente `BubbleSelect.jsx` con estilo glassmorphism iOS 26
- `backdrop-filter: blur(20px/30px)`
- Touch events optimizados
- Clase `bubble-native-select` para selects nativos

**Bugs P0 Corregidos:**
- ViewCardPage template "Bubble" - código duplicado separado
- ImageEditor - sliders nativos funcionando

**Features:**
- Dropdown selector de tipo de tarjeta
- Perfil "Mascotas" con campos específicos
- Traducciones ES/EN completas

---

## Prioritized Backlog

### P0 (Must Have)
- [x] ~~Dropdowns no funcionan en móvil~~ ✅
- [x] ~~Tienda PIUP~~ ✅
- [x] ~~Animaciones spring iOS 26~~ ✅
- [x] ~~Datos guardados del usuario~~ ✅

### P1 (Should Have)
- [ ] Eliminar/Archivar tarjetas desde Dashboard
- [ ] NFC Lock - bloquear edición después de escribir
- [ ] Mapa embebido (Leaflet) para direcciones
- [ ] PDF export para CURRICULUM cards
- [ ] Completar checkout flow con Stripe webhooks

### P2 (Nice to Have)
- [ ] Social features (likes, comentarios)
- [ ] SEO meta tags para cards públicas
- [ ] Panel corporativo

### P3 (Future)
- [ ] Super-admin panel
- [ ] Native app conversion

---

## Test Credentials
- **Email:** `newtest@bruno.com`
- **Password:** `Test1234!`

## Tech Stack
- **Frontend:** React, React Router, Axios, Tailwind CSS, shadcn/ui, lucide-react
- **Backend:** FastAPI, Pydantic, MongoDB (motor), JWT, Pillow, Cloudinary, Stripe
- **Payments:** Stripe (emergentintegrations)
- **Authentication:** JWT + Emergent-managed Google OAuth

## Key Files Reference
- `/app/frontend/src/pages/StorePage.jsx` - Tienda PIUP
- `/app/frontend/src/components/BubbleSelect.jsx` - Dropdown iOS style
- `/app/backend/server.py` - API principal con tienda, productos, planes
- `/app/frontend/src/index.css` - Estilos CSS (animaciones spring, glassmorphism)

## API Endpoints (Tienda)
- `GET /api/store/products` - Lista productos
- `GET /api/store/products/{id}` - Detalle producto
- `POST /api/store/orders` - Crear orden
- `POST /api/store/checkout/{order_id}` - Crear checkout Stripe
- `GET /api/plans` - Planes de suscripción
- `GET /api/user/saved-data` - Datos guardados del usuario
- `PUT /api/user/saved-data` - Actualizar datos guardados
- `POST /api/user/addresses` - Agregar dirección
- `DELETE /api/user/addresses/{id}` - Eliminar dirección

---
*Last Updated: 2026-02-18*
