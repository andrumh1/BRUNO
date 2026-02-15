# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a highly polished, visually appealing PWA with extensive customization and social features.

## What's Been Implemented

### Session: 2026-02-15 (Current)

**Bugs Corregidos (P0):**

1. **Bug ViewCardPage Template "Bubble"**
   - El template `full_banner_bubble` tenía código de `edge_actions` mezclado incorrectamente
   - Se separó el código correctamente - ahora cada template muestra sus botones sin duplicar
   - Archivo: `/app/frontend/src/pages/ViewCardPage.jsx`

2. **Bug ImageEditor (Brillo/Contraste)**
   - Los sliders de Shadcn no funcionaban correctamente
   - Reemplazados por inputs range nativos de HTML para mayor compatibilidad
   - Mejorado el manejo de eventos para touch/mobile
   - Archivo: `/app/frontend/src/components/ImageEditor.jsx`

**Features Nuevas (P1-P2):**

3. **Dropdown Selector de Tipo de Tarjeta**
   - Reemplazados los radio buttons por un dropdown en CreateCardPage y EditCardPage
   - Muestra el tipo + descripción en cada opción
   - Preview del tipo seleccionado debajo del dropdown

4. **Nuevo Perfil: Mascotas (Pets)**
   - 7 tipos de tarjeta disponibles ahora
   - Campos específicos:
     - Pet Information: nombre, especie, raza, edad, color, tamaño, marcas distintivas
     - Medical Information: vacunado, esterilizado, microchip, condiciones médicas, veterinario
     - If Lost Section (borde amarillo destacado): recompensa, instrucciones, contactos del dueño
   - Traducciones completas en ES/EN

**Archivos Modificados:**
- `/app/frontend/src/pages/ViewCardPage.jsx` - Fix bug bubble template
- `/app/frontend/src/components/ImageEditor.jsx` - Sliders nativos
- `/app/frontend/src/pages/CreateCardPage.jsx` - Dropdown + mascotas
- `/app/frontend/src/pages/EditCardPage.jsx` - Dropdown + mascotas + ProfileSpecificFields
- `/app/frontend/src/components/ProfileSpecificFields.jsx` - Campos de mascotas
- `/app/frontend/src/contexts/LanguageContext.js` - Traducciones mascotas ES/EN

---

### Session Anterior: 2026-02-15

**Correcciones Completadas:**

1. **Logo sin deformación** - Clase CSS `.bruno-logo` con `object-fit: contain`
2. **Márgenes Responsive para Móviles** - Padding ajustado automáticamente
3. **Campos Específicos por Tipo de Perfil** (Personal, Empresarial, Negocio, Lugares, Guardian, Curriculum)
4. **QR Code Optimizado** con logo "B" naranja en el centro
5. **Sistema i18n (ES/EN)** con auto-detección
6. **Vista Lista/Cuadrícula** en Feed y Dashboard
7. **Google OAuth** - Arreglado el bucle infinito de login

---

## Prioritized Backlog

### P0 (Must Have) - Bugs Pendientes
- [ ] Verificar Social Links funcionando correctamente para todos los usuarios
- [ ] Completar traducciones faltantes en algunas secciones

### P1 (Should Have)
- [ ] Eliminar/Archivar tarjetas desde Dashboard
- [ ] NFC Lock - bloquear edición después de escribir en NFC tag
- [ ] Mapa embebido (Leaflet) para direcciones
- [ ] PDF export para CURRICULUM cards
- [ ] Social features (likes, comentarios)
- [ ] Card collections/álbum

### P2 (Nice to Have)
- [ ] Más preguntas/campos por tipo de perfil
- [ ] Google Reviews integration real (API)
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
- **Authentication:** JWT + Emergent-managed Google OAuth

## Key Files Reference
- `/app/backend/server.py` - Servidor principal (necesita refactorización)
- `/app/frontend/src/pages/CreateCardPage.jsx` - Creación de tarjetas
- `/app/frontend/src/pages/EditCardPage.jsx` - Edición de tarjetas
- `/app/frontend/src/pages/ViewCardPage.jsx` - Vista pública de tarjetas
- `/app/frontend/src/components/ProfileSpecificFields.jsx` - Campos por tipo de perfil
- `/app/frontend/src/contexts/LanguageContext.js` - Traducciones ES/EN
- `/app/frontend/src/components/ImageEditor.jsx` - Editor de imágenes

---
*Last Updated: 2026-02-15*
