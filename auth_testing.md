# BRUNO · pruebas de sesión (access corto + refresh rotatorio)
- Login web: `curl -c cj -X POST $API/api/auth/login -d '{"email":..,"password":..,"platform":"web"}'` → cookies httpOnly `bruno_session` (access, /api, 1 h) y `bruno_refresh` (/api/auth, 180 d). El cuerpo NO trae refresh_token.
- Login nativo (`"platform":"native"`): cuerpo con `access_token` + `refresh_token` (Keychain/Keystore); sin cookies.
- Renovar: `POST /api/auth/refresh` (cookie o `{"refresh_token":..,"platform":"native"}`) → rota el refresh; reuso del anterior dentro de 60 s = reintento (OK, el hijo previo se revoca); reuso tras 60 s = robo → toda la familia revocada (401 `refresh_reused`).
- Logout: `POST /api/auth/logout` con access y/o refresh → revoca jti + familia (access vivos de esa familia dejan de valer) y borra cookies. Funciona con access caducado.
- Cambio de contraseña → revoca todo (`tokens_valid_after` + refresh) y devuelve par nuevo para el dispositivo actual.
- Migración: access antiguo de larga duración (sin claim `fam`) → `POST /api/auth/refresh` con `Authorization: Bearer` lo canjea una vez por un par nuevo y lo revoca.
- Frontend: `lib/session.js` (estado, renovación única en vuelo, 3 reintentos ante red), interceptor 401 en `lib/httpSetup.js`, `AuthContext` (arranque con loader, renovación proactiva 2 min antes de caducar, al volver a primer plano/online, `appStateChange` en Capacitor).
