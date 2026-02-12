# BRUNO - Tarjetas Digitales del Futuro

## Descripción del Proyecto
Aplicación de tarjetas de presentación digitales con características de red social. Permite crear, compartir y descubrir tarjetas digitales profesionales con códigos QR personalizados y soporte NFC.

## Arquitectura Técnica
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + MongoDB
- **Autenticación**: JWT + Google OAuth (Emergent-managed)
- **Almacenamiento de imágenes**: Cloudinary
- **Tipo de app**: PWA (Progressive Web App)

## Funcionalidades Implementadas

### Fase 1 - Fundación ✅
- [x] Sistema de autenticación (email/password + Google OAuth)
- [x] CRUD de tarjetas digitales
- [x] 5 tipos de tarjetas: Personal, Empresarial, Negocio, Lugares, **Guardián**
- [x] Generación de códigos QR con logo BRUNO
- [x] Subida de imágenes (avatar, banner)
- [x] Sistema de plantillas (15 plantillas, 3 por tipo)

### Fase 2 - Características Sociales (En progreso)
- [x] Feed público (página principal)
- [x] Filtros por tipo de tarjeta
- [x] Vista de tarjeta pública
- [x] Contador de visualizaciones
- [x] Botones de compartir
- [x] **Navegación tipo red social**: Explorar | Mapa | Mi Panel
- [ ] Likes en tarjetas
- [ ] Comentarios en tarjetas
- [ ] Sistema de colecciones (favoritos, historial)

### Fase 3 - Funcionalidades Avanzadas (Pendiente)
- [ ] Suscripciones y planes de pago
- [ ] Gestión de cuentas corporativas
- [ ] Panel de Super-Admin
- [ ] Conversión a app nativa (iOS/Android)

## Correcciones Completadas (12 Feb 2026)
1. ✅ **QR con logo BRUNO**: El código QR ahora incluye el logo de Bruno en el centro
2. ✅ **Sistema NFC mejorado**: Página con detección de dispositivo y permisos completos para Android/iOS
3. ✅ **Feed como página principal**: La ruta `/` ahora muestra el Feed (Explorar)
4. ✅ **Botón Editar funcional**: Navega correctamente a `/cards/{cardId}/edit`
5. ✅ **Tipo de tarjeta Guardián**: Disponible en todos los formularios y filtros

## Estructura de Archivos Principales
```
/app/
├── backend/
│   ├── server.py          # API FastAPI completa
│   ├── requirements.txt
│   └── .env               # MONGO_URL, CLOUDINARY_*, SECRET_KEY
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── FeedPage.jsx       # Página principal
│   │   │   ├── Dashboard.jsx      # Panel de usuario
│   │   │   ├── CreateCardPage.jsx # Crear tarjeta
│   │   │   ├── EditCardPage.jsx   # Editar tarjeta
│   │   │   ├── ViewCardPage.jsx   # Vista pública de tarjeta
│   │   │   ├── NFCWritePage.jsx   # Programar NFC
│   │   │   └── MapPage.jsx        # Mapa de tarjetas
│   │   ├── components/
│   │   │   ├── TemplateSelector.jsx
│   │   │   ├── SocialLinkSelector.jsx
│   │   │   └── LocationSelector.jsx
│   │   └── App.js
│   └── public/
│       ├── bruno-logo.png
│       ├── bruno-mascot.png
│       └── manifest.json
└── test_reports/
    └── iteration_1.json   # Resultados de pruebas
```

## APIs Principales
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/auth/register` | POST | Registro de usuario |
| `/api/auth/login` | POST | Login con email/password |
| `/api/auth/google` | POST | Login con Google |
| `/api/cards` | GET/POST | Listar/Crear tarjetas |
| `/api/cards/{id}` | GET/PUT/DELETE | Operaciones en tarjeta |
| `/api/cards/{id}/qr` | GET | Obtener QR con logo |
| `/api/nfc/activate` | POST | Activar tarjeta NFC |
| `/api/upload/avatar` | POST | Subir foto de perfil |
| `/api/upload/banner` | POST | Subir banner |

## Credenciales de Prueba
- **Email**: demo@bruno.com
- **Password**: demo123
- **Card ID de prueba**: 01e1d78c-a082-4de5-9590-ef3b0ed532b2

## Próximos Pasos (Backlog)
### P1 - Alta Prioridad
- Implementar likes en tarjetas
- Implementar comentarios en tarjetas
- Sistema de colecciones (favoritos, historial, guardados)

### P2 - Media Prioridad
- Sistema de suscripciones con Stripe
- Gestión de cuentas corporativas
- Notificaciones push

### P3 - Baja Prioridad
- Panel de Super-Admin
- Conversión a app nativa
- Analytics avanzados

## Notas Técnicas
- El archivo `server.py` tiene >1000 líneas y se recomienda refactorizar en módulos
- La API de NFC (Web NFC) solo funciona en Chrome para Android
- iOS no soporta escritura NFC desde navegador web
- Los códigos QR usan alta corrección de errores (H) para permitir el logo en el centro
