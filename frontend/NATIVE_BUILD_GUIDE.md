# BRUNO · Guía de compilación nativa (Capacitor 7 · Android + iOS)

Dominio oficial: **https://brunocard.com** (web + API `/api`). App ID: **com.brunocard.app**.
La app nativa carga el bundle web local (`webDir: build`) y llama a la API de producción. **No** tiene `server.url`: es intencional. No lo cambies a `localhost` ni a un preview.

## 0. Requisitos fijos (Windows, macOS y Linux)
| Herramienta | Versión obligatoria | Notas |
|---|---|---|
| Node.js | **24 LTS** (recomendada; `.nvmrc`) · también 20 o 22 LTS | `engines` en package.json rechaza Node < 20 y Node ≥ 25. **Node 26 NO compila** CRA/Craco. Windows: [nvm-windows](https://github.com/coreybutler/nvm-windows) → `nvm install 24` + `nvm use 24`, o instalador LTS de nodejs.org. |
| Instalador | **yarn 1.22.22** (único oficial) | `npm install -g yarn@1.22.22`. `npm install` está bloqueado por `preinstall` (npm produce otro árbol: ajv 6 vs 8, ERESOLVE date-fns). El `yarn.lock` versionado fija exactamente lo probado. |
| JDK | **21** (válido 17–23, **nunca 25**) | Gradle 8.11.1 + AGP 8.7.2. En Android Studio: *Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK = 21* (el JBR que trae Android Studio sirve si es 21). |
| Gradle | 8.11.1 (wrapper, no lo cambies) | Si falta `android/gradle/wrapper/gradle-wrapper.jar` tras clonar, en `frontend\android` ejecuta `gradle wrapper --gradle-version 8.11.1`. |
| Android Studio | Ladybug o superior (probado con Rabbit 2) | SDK 35. |

Versiones fijadas en `package.json` que **no** deben subirse sin probar: `date-fns 3.6.0` (peer de `react-day-picker 8.10.1`), `@aparajita/capacitor-biometric-auth 9.1.2` (Capacitor 7), `react-scripts 5.0.1`, `@craco/craco 7.1.0`, Capacitor `^7`.

## 1. Windows — pasos exactos desde un clon limpio (cmd o PowerShell)
```bat
git clone https://github.com/Andrumh1/BRUNO.git
cd BRUNO\frontend
node -v                                   :: debe mostrar v24.x (o v20/v22). Si no: nvm use 24
npm install -g yarn@1.22.22               :: solo la primera vez
copy .env.native.example .env.native      :: REACT_APP_BACKEND_URL=https://brunocard.com + claves públicas (VAPID, Maps)
yarn install --frozen-lockfile            :: "success Saved lockfile" / "Already up-to-date", SIN ERESOLVE ni warnings de ajv
yarn native:build                         :: = yarn build → cap sync android → cap copy ios → native-verify
yarn native:open:android                  :: abre frontend\android en Android Studio (o File → Open → frontend\android)
```
Qué debe salir en cada paso:
1. `yarn install --frozen-lockfile`: termina con `Done in …s`. Si dice *The engine "node" is incompatible* → cambia a Node 24. Si dice *BRUNO se instala SOLO con yarn* → estabas usando npm.
2. `yarn native:build`:
   - `▶ API/dominio que usará la app: https://brunocard.com`
   - `Compiled successfully.` (o `Compiled with warnings.`; **nunca** `Failed to compile`) y `✔ build/index.html generado`
   - `[info] Sync finished in …s` de `cap sync android` (copia `android/app/src/main/assets/public` y genera `android/capacitor-cordova-android-plugins/cordova.variables.gradle`)
   - `cap copy ios`: copia a `ios/App/App/public` (sin `pod install`; eso es solo en Mac). Si fallara en Windows, es solo un aviso ⚠ y no afecta a Android.
   - `✅ Paquete nativo coherente con la web (https://brunocard.com)`
3. Android Studio → *Sync Project with Gradle Files* → **BUILD SUCCESSFUL**; luego ▶ Run en emulador o dispositivo (USB con depuración).

Scripts equivalentes: `yarn native:build:windows` (alias) y `yarn native:build:bash` (bash, Linux/macOS). Todos los scripts `native:*` de build/verify son Node y funcionan en Windows sin bash.

**Orden obligatorio:** `install → build → cap sync android → abrir Android Studio`. `cap sync` se ejecuta **después** del build porque necesita `build/index.html`; si lo ejecutas antes verás *The web assets directory (./build) must contain an index.html file*. Si abres `android/` sin haber hecho `cap sync`, Gradle falla con *Could not read script … cordova.variables.gradle*: no copies archivos a mano, ejecuta `yarn native:build`.

Errores ya resueltos (no deben volver a aparecer con este repositorio):
| Error | Causa | Solución aplicada |
|---|---|---|
| `npm ERR! ERESOLVE … date-fns ^4.1.0 / react-day-picker peer ^2.28 \|\| ^3` | date-fns 4 no es peer válido de react-day-picker 8 | `date-fns` fijado en `3.6.0` (el código no usa date-fns directamente) |
| `Cannot find module 'ajv/dist/compile/codegen'` | npm hoisteaba ajv 6 donde schema-utils 4 necesita ajv 8 | Instalador único yarn + `yarn.lock` (ajv 8 queda anidado bajo schema-utils; ajv 6 solo para eslint, como requiere CRA) |
| `Module not found: Can't resolve './native'` / `'./web-utils'` en `@aparajita/capacitor-biometric-auth` | la regla `fullySpecified:false` de `craco.config.js` solo reconocía rutas con `/` (Unix), no `\` (Windows) | regla con `[\\/]` y cobertura `@aparajita`, `@exxili`, `@capacitor`, `@capacitor-community` |
| `'bash' is not recognized` en `yarn native:build` | script bash | `scripts/native-build.js` y `scripts/native-verify.js` (Node, multiplataforma) |
| `Could not read script … cordova.variables.gradle` | se abrió Android Studio sin `cap sync android` | flujo install → build → sync documentado y verificado por `native-verify` |
| `The web assets directory (./build) must contain an index.html` | `cap sync` antes del build | `native-build.js` comprueba `build/index.html` antes de sincronizar |

## 2. macOS / Linux
```bash
cd frontend
cp .env.native.example .env.native
yarn install --frozen-lockfile
yarn native:build                         # igual que en Windows (en macOS hace cap sync ios con pod install)
yarn native:verify https://brunocard.com  # comprueba que android/ e ios/ apuntan a producción
```
`native-verify` falla si el bundle contiene `localhost:8001` o el dominio de preview.

## 3. Android (Android Studio o CLI)
```bash
yarn native:open:android          # abre android/ en Android Studio
yarn native:apk                   # APK debug  → android/app/build/outputs/apk/debug/   (bash; en Windows usa Android Studio → Build → Build APK)
yarn native:apk:release           # APK release (requiere android/keystore.properties)
yarn native:aab                   # AAB para Google Play
```
- Firma: copia `android/keystore.properties.example` → `android/keystore.properties` (no se versiona).
- Push: coloca `android/app/google-services.json` (Firebase → Configuración del proyecto → Apps → Android `com.brunocard.app`). **Sin él, Gradle omite el plugin y la app compila sin push** (no es un bloqueo para probar en local). Este archivo no se sube a GitHub.
- App Links: edita `public/.well-known/assetlinks.json` con las huellas SHA-256:
  `keytool -list -v -keystore <keystore> -alias <alias>` (subida) y la de **Play App Signing** (Play Console → Integridad de la app). Verifica tras desplegar:
  `curl -s https://brunocard.com/.well-known/assetlinks.json` y en el móvil `adb shell pm verify-app-links --re-verify com.brunocard.app`.
- Archivos generados por `cap sync` (NO editar a mano, están en .gitignore): `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`, `android/capacitor-cordova-android-plugins/`, `android/app/src/main/assets/`, `android/app/src/main/res/xml/config.xml`.

### 3.1 Arranque sin crash (auditoría de los 18 plugins)
Crash corregido: `IllegalStateException: Default FirebaseApp is not initialized` en `PushNotificationsPlugin.register` (Bridge.java callPluginMethod). `register()`/`unregister()` del plugin llaman a `FirebaseMessaging.getInstance()` en Java; sin `google-services.json` la excepción nace en el hilo nativo y mata el proceso (un try/catch en JS no la alcanza). Solución: **no llamar a `register()` si Firebase no está inicializado**.
- `android/app/src/main/java/com/brunocard/app/BrunoDeviceCapsPlugin.java` (registrado en `MainActivity`) expone `BrunoDeviceCaps.get()` → `{ firebase, playServices, nfc, biometricHardware }`. `firebase` es true solo si el plugin google-services generó el recurso `google_app_id` (es decir, si existe `google-services.json`).
- `src/native/useNativePush.js`: al arrancar **no pide permiso ni toca Firebase**; solo re-registra si `firebase === true` **y** el permiso ya estaba concedido. El permiso POST_NOTIFICATIONS se pide únicamente desde Ajustes → Notificaciones (`enableNativePush()`), por acción del usuario. Sin Firebase: `console.info("[BRUNO native] push desactivado: falta google-services.json")` y la app abre normal.
- Sin Google Play Services: `register()` emite `registrationError` (sin crash); Maps es web (JS) y degrada solo.
- Splash: `launchAutoHide: true` + `launchShowDuration: 3000` → se oculta antes desde JS cuando la web está lista, y como máximo a los 3 s aunque el bundle falle (ya no se queda pegado). Si falta `build/index.html`, `cap sync` falla antes con mensaje claro.

| Plugin | Al arrancar | Sin hardware / permiso / servicio |
|---|---|---|
| push-notifications 7.0.7 | solo `addListener`; `register()` gated por Firebase + permiso previo | sin Firebase → push off; sin Play Services → `registrationError` |
| biometric-auth 9.1.2 | import perezoso; `checkBiometry` solo si el usuario activó el bloqueo biométrico | `canAuthenticate` devuelve NO_HARDWARE/NONE_ENROLLED → `available:false`, sin crash |
| secure-storage 7.1.6 | `get` dentro de try/catch (JS) y `call.reject` (Java) | Keystore no disponible → fallback AES/localStorage + `console.warn` |
| exxili-capacitor-nfc 0.0.14 | `handleOnResume` retorna si `NfcAdapter == null`; JS solo en /card-transfer | `isSupported:false` → QR/enlace |
| BrunoNfcHce (propio) | nada | `isSupported` comprueba FEATURE_NFC_HOST_CARD_EMULATION |
| safe-area 7.0.0 / status-bar / keyboard / splash-screen / app | llamadas en try/catch | errores ignorados |
| privacy-screen 6.1.0 | `load()` solo lee config; se activa en lives | — |
| camera / geolocation / filesystem / share / haptics / browser / network / preferences | nunca al arrancar; permisos solo al usar la función | negar permiso → error controlado en la acción |
Permisos del manifiesto (CAMERA, RECORD_AUDIO, ACCESS_FINE_LOCATION, NFC, POST_NOTIFICATIONS, USE_BIOMETRIC) **no** se solicitan al inicio. Red: la restauración de sesión tiene timeout (15 s) y conserva el usuario en caché sin red; la app abre igual.
Prueba en frío obligatoria en el emulador: *Force stop* (o `adb shell am force-stop com.brunocard.app`) → abrir → debe pasar del splash a la app; `adb logcat *:E | findstr brunocard` sin `FATAL`.

### 3.2 Login nativo: CORS y Google
- El WebView de Android sirve la app en `https://localhost` (iOS: `capacitor://localhost`) y llama a `https://brunocard.com/api` con `withCredentials`. El backend **no puede responder `Access-Control-Allow-Origin: *`** con credenciales; `backend/server.py` ahora tiene lista explícita (`https://brunocard.com`, `https://www.brunocard.com`, `https://localhost`, `http://localhost`, `capacitor://localhost`, `ionic://localhost`, más `CORS_ORIGINS`/`FRONTEND_URL` del entorno y los dominios de preview/host de Emergent por regex) y devuelve el origen exacto + `Access-Control-Allow-Credentials: true` en preflight y respuesta. **Este cambio es de backend: brunocard.com lo tendrá cuando se publique la siguiente versión.**
- Sesión nativa: login/registro/Google envían `platform: "native"` → el backend devuelve `refresh_token` en el cuerpo (la web usa cookie httpOnly) y la app lo guarda en Keychain/Keystore (`@aparajita/capacitor-secure-storage`); al reabrir, `/api/auth/refresh` con ese token restaura la sesión. Sin red mantiene el usuario en caché.
- Google en nativo (`src/lib/googleLogin.js`): la app genera un nonce aleatorio y abre Emergent Auth en Custom Tab (`@capacitor/browser`) con `redirect = https://brunocard.com/dashboard?native_auth=<nonce>`. La web de producción (`AuthCallback`) llama a `POST /api/auth/native-handoff {nonce, session_id}`: el backend canjea el session_id con Emergent, emite una sesión **nativa** (access + refresh en el cuerpo) y la guarda de un solo uso bajo el nonce (TTL 2 min). La app la recoge con `GET /api/auth/native-handoff/<nonce>` (polling cada 2 s hasta 5 min y al volver al frente) → `login()` → Keystore → /dashboard. La web muestra "¡Listo! Tu sesión ya está en la app" con botón **Abrir BRUNO** (`com.brunocard.app://auth/done`). No depende de que Chrome permita redirecciones a esquemas propios (las bloquea sin gesto del usuario). Requiere la web/backend publicados con esta versión. Sin cambios en Google Cloud (Emergent Auth gestiona el cliente de Google).
  - **Google exige un navegador real.** El Custom Tab es una pestaña de Chrome *dentro* de la app (no un WebView: Google rechaza WebViews con `disallowed_useragent`). Si el dispositivo/emulador **no tiene Chrome ni otro navegador** (imágenes AOSP sin Google), `BrunoDeviceCaps.browser=false` y la app muestra: "Este dispositivo no tiene un navegador (Chrome)…". Para probar Google en el emulador usa una imagen **con Google Play** (incluye Chrome) o un teléfono real.
  - Estado visible (`components/auth/GoogleNativeStatus.jsx`): "Abriendo Google…" → "Completa el inicio de sesión en la ventana de Google…" (con Cancelar) → error en español con **Reintentar** si no se pudo abrir, si se cerró la ventana sin terminar (6 s de gracia), o tras 5 min.
  - Selector de cuenta de Google: lo decide Google según las cuentas abiertas en Chrome (Emergent Auth no acepta `prompt=select_account`; se probó). Con varias cuentas o sin sesión en Chrome, Google muestra el selector; con una sola cuenta ya autorizada puede entrar directo.
- Multi-cuenta (solo app nativa): Ajustes → **Cuentas** (`components/auth/AccountSwitcherSheet.jsx`). Lista de hasta 6 cuentas usadas (última primero), cambio con un toque **sin cerrar sesión** (`switchAccount` en `AuthContext`: la sesión actual queda guardada y la otra se restaura con su propio refresh token del Keystore), **Añadir cuenta** (`/login?add=1`, correo o Google) y **Quitar cuenta** con confirmación (revoca solo ese refresh token en el servidor y lo borra del dispositivo). Si el token de una cuenta caducó, al elegirla se avisa y se pide su contraseña; las demás no cambian. En web se mantiene una única sesión (cookies httpOnly).
- Sin internet / API caída: banner nativo "Sin conexión…/No se pudo conectar con BRUNO" con **Reintentar** (`src/native/ApiStatusBanner.jsx`); login y registro muestran el error de red en español. Sesión expirada: toast "Tu sesión expiró" y vuelta a /login (sin bucle).

## 4. iOS (solo en macOS con Xcode 15+)
```bash
cd frontend && npx cap sync ios      # ejecuta pod install
yarn native:open:ios                 # abre ios/App/App.xcworkspace
```
- Target iOS **14.3** (cámara, QR y WebRTC dentro de WKWebView).
- En Signing & Capabilities: equipo, **Push Notifications**, **Associated Domains** (`applinks:brunocard.com`, `applinks:www.brunocard.com`), **Near Field Communication Tag Reading**.
- Universal Links: sustituye `REEMPLAZAR_TEAM_ID` en `public/.well-known/apple-app-site-association` por el Team ID (Apple Developer → Membership). Apple descarga el archivo vía su CDN al instalar la app; comprueba:
  `curl -sI https://brunocard.com/.well-known/apple-app-site-association` (HTTP 200, sin redirecciones).
- Push: sube la clave APNs (.p8) a Firebase → Cloud Messaging → Configuración de apps Apple, y añade `ios/App/App/GoogleService-Info.plist`.
- `aps-environment` cambia a `production` automáticamente al archivar para App Store.

## 5. Backend (push nativo)
- `FIREBASE_SERVICE_ACCOUNT_JSON` en `backend/.env` (JSON de la cuenta de servicio o ruta al archivo). Sin él, `utils/native_push.py` registra "native push disabled" y solo funciona Web Push.

## 6. Pruebas en dispositivo (no automatizables aquí)
| Prueba | Android | iOS |
|---|---|---|
| Login, biometría, cierre y reapertura (token en Keystore/Keychain) | ✔ requerido | ✔ requerido |
| Cámara/galería/micrófono, grabar reel, subir video largo | ✔ | ✔ (≥ 14.3) |
| Push en primer plano / segundo plano / app cerrada | ✔ (FCM) | ✔ (APNs) |
| App Link / Universal Link a perfil, tarjeta, video, producto | ✔ | ✔ |
| Pago Stripe: pestaña in-app → vuelta a BRUNO | ✔ | ✔ |
| NFC lectura y escritura de tag PIUP | ✔ | lectura ✔ (Apple no permite escribir desde HCE ni emitir tarjeta) |
| HCE: Android emite la tarjeta y un iPhone la lee | solo teléfonos con `android.hardware.nfc.hce` | lector |
| Mapa, "Historias cerca de mí", lugares populares (permiso de ubicación) | ✔ | ✔ |
| Llamada / live (WebRTC) y audio en segundo plano | ✔ | ✔ |
| Teclado en chat/comentarios, botón atrás, safe areas con notch | ✔ | ✔ |

## 7. Versionado
- Android: `versionCode` / `versionName` en `android/app/build.gradle`.
- iOS: `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` en Xcode (General).
