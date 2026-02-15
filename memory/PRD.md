# BRUNO - Digital Business Card Application

## Problem Statement
Build a comprehensive digital business card application called "BRUNO" - a highly polished, visually appealing PWA with extensive customization and social features.

## What's Been Implemented

### Session: 2026-02-15 (Current) - Part 2

**Corrección de Dropdowns Móviles:**

5. **BubbleSelect - Componente iOS 26 Style**
   - Nuevo componente de dropdown personalizado que funciona en móviles
   - Estilo glassmorphism/burbuja semitransparente
   - `backdrop-filter: blur(20px/30px)`
   - Fondos: `rgba(255,255,255,0.7)` trigger, `rgba(255,255,255,0.92)` opciones
   - Touch events funcionan correctamente
   - Archivo: `/app/frontend/src/components/BubbleSelect.jsx`

6. **SocialLinkSelector Actualizado**
   - Usa BubbleSelect para selección de tipo de red social
   - Muestra iconos de cada red social (Instagram, Facebook, etc.)
   - Formulario mejorado con estilo de burbuja
   - Archivo: `/app/frontend/src/components/SocialLinkSelector.jsx`

7. **Estilos CSS iOS 26**
   - Clase `.bubble-native-select` para selects nativos
   - Animaciones suaves de apertura/cierre
   - Scrollbar personalizado naranja
   - Optimizaciones para móviles (min-height 48px táctil)
   - Archivo: `/app/frontend/src/index.css`

**Archivos Modificados:**
- `/app/frontend/src/components/BubbleSelect.jsx` - NUEVO
- `/app/frontend/src/components/SocialLinkSelector.jsx` - Actualizado con BubbleSelect
- `/app/frontend/src/pages/CreateCardPage.jsx` - Usa BubbleSelect
- `/app/frontend/src/pages/EditCardPage.jsx` - Usa BubbleSelect
- `/app/frontend/src/components/ProfileSpecificFields.jsx` - Clase bubble-native-select
- `/app/frontend/src/index.css` - Estilos iOS 26 para dropdowns

---

### Session: 2026-02-15 - Part 1

**Bugs Corregidos (P0):**

1. **Bug ViewCardPage Template "Bubble"**
   - El template `full_banner_bubble` tenía código de `edge_actions` mezclado incorrectamente
   - Se separó el código correctamente - ahora cada template muestra sus botones sin duplicar

2. **Bug ImageEditor (Brillo/Contraste)**
   - Los sliders de Shadcn no funcionaban correctamente
   - Reemplazados por inputs range nativos de HTML para mayor compatibilidad

**Features Nuevas:**

3. **Dropdown Selector de Tipo de Tarjeta**
   - Reemplazados los radio buttons por un dropdown en CreateCardPage y EditCardPage

4. **Nuevo Perfil: Mascotas (Pets)**
   - 7 tipos de tarjeta disponibles ahora
   - Campos específicos: nombre, especie, raza, edad, color, tamaño, información médica
   - Sección "If Lost" con recompensa, instrucciones, contactos del dueño

---

## Prioritized Backlog

### P0 (Must Have) - Bugs Pendientes
- [x] ~~Dropdowns no funcionan en móvil~~ ✅ COMPLETADO
- [ ] Verificar Social Links funcionando correctamente para todos los usuarios

### P1 (Should Have)
- [ ] Eliminar/Archivar tarjetas desde Dashboard
- [ ] NFC Lock - bloquear edición después de escribir en NFC tag
- [ ] Mapa embebido (Leaflet) para direcciones
- [ ] PDF export para CURRICULUM cards
- [ ] Social features (likes, comentarios)

### P2 (Nice to Have)
- [ ] Más preguntas/campos por tipo de perfil
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
- `/app/frontend/src/components/BubbleSelect.jsx` - Dropdown iOS style
- `/app/frontend/src/components/SocialLinkSelector.jsx` - Selector de redes sociales
- `/app/frontend/src/pages/CreateCardPage.jsx` - Creación de tarjetas
- `/app/frontend/src/pages/EditCardPage.jsx` - Edición de tarjetas
- `/app/frontend/src/pages/ViewCardPage.jsx` - Vista pública de tarjetas
- `/app/frontend/src/components/ProfileSpecificFields.jsx` - Campos por tipo de perfil
- `/app/frontend/src/index.css` - Estilos CSS (incluye bubble styles)

---
*Last Updated: 2026-02-15*
