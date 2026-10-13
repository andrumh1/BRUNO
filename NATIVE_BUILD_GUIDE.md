# 📱 BRUNO — Guía de compilación nativa (Android APK/AAB + iOS)

La app nativa es **la misma web de BRUNO** empaquetada con Capacitor: misma UI, mismas funciones,
mismo backend. Lo único que cambia es la "cáscara" (WebView nativo + plugins) y cómo se distribuye.

> Todo lo que está en este repositorio ya está hecho. Lo que **tú** tienes que aportar está marcado con 🧑‍💻.

---

## 0. Resumen de 2 minutos

```bash
cd frontend
cp .env.native.example .env.native      # pon tu dominio público en REACT_APP_BACKEND_URL
yarn install
yarn native:build                       # build web + copia a android/ e ios/ + verificación
yarn native:apk                         # APK de prueba (necesita Android Studio / SDK)
yarn native:aab                         # AAB firmado para Google Play (necesita keystore)
yarn native:open:ios                    # Xcode (solo en Mac) → Archive → App Store Connect
```

---

## 1. Qué hay en el repositorio

| Pieza | Dónde | Estado |
|---|---|---|
| Config Capacitor (`appId com.brunocard.app`, `appName BRUNO`, `webDir build`) | `frontend/capacitor.config.json` | ✅ |
| Proyecto Android generado + permisos + deep links + HCE NFC | `frontend/android/` | ✅ |
| Proyecto iOS generado + `Info.plist` con textos de permisos + `App.entitlements` | `frontend/ios/` | ✅ |
| Iconos adaptativos (claro/oscuro) y splash claro/oscuro con el logo naranja | `frontend/resources/` → generados en `android/app/src/main/res` y `ios/App/App/Assets.xcassets` | ✅ |
| Plugins nativos | `@capacitor/push-notifications`, `@aparajita/capacitor-biometric-auth`, `@capacitor/camera`, `@capacitor/geolocation`, `@capacitor/filesystem`, `@capacitor/haptics`, `@capacitor/share`, `@exxili/capacitor-nfc`, `@capacitor/keyboard`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor-community/safe-area`, `@capacitor/app`, `@capacitor/preferences`, `@capacitor/network` | ✅ |
| Código puente (sin romper la web: en navegador todo cae a la API web equivalente) | `frontend/src/native/` | ✅ |
| Scripts | `frontend/scripts/*.sh`, `yarn native:*` | ✅ |

### `frontend/src/native/`
- `capacitor.js` — `isNative() / isIOS() / isAndroid()`.
- `NativeBootstrap.jsx` — montado globalmente: safe-areas reales (notch/gesture bar), barra de estado
  acorde al tema, splash, teclado (iOS sin barra accesoria, sin zoom), **botón atrás de Android**
  (cierra teclado → cierra hoja/modal → atrás → salir solo desde Reels/Login), **deep links**
  (`com.brunocard.app://c/ID` y `https://TU-DOMINIO/...`), registro de push y **bloqueo biométrico**.
- `useNativePush.js` — permiso + token FCM/APNs → `POST /api/mobile/devices/register`; tocar una push navega a su `url`.
- `biometric.js` + `BiometricGate.jsx` — Face ID / huella / rostro Android. Ajustes → Cuenta → "Bloquear con…".
  Pide biometría al abrir la app y al volver tras >20 s en segundo plano. Fallback a PIN del teléfono.
- `nativeApis.js` — `takePhoto`, `getCurrentLocation`, `shareContent`, `triggerHaptic`, `hapticNotify`, `saveToDevice`.
- `files.js` — `saveToDevice(blob|dataURL, nombre)` → en nativo escribe en Filesystem y abre la hoja
  "Guardar en Fotos / Archivos / AirDrop"; en web descarga. Usado en QR y en imágenes de tarjeta.
- `nfcShare.js` — NFC unificado: app nativa (Android + iPhone) lee/escribe tags PIUP con `@exxili/capacitor-nfc`;
  Android Chrome usa Web NFC; Android nativo además **emite la tarjeta como tag (HCE)**
  (`native-android/nfc-hce`, ya integrado en `android/`). iPhone solo lee (límite de Apple).
- `privacyScreen.js` — oculta el contenido en el selector de apps (lives privados).

### Permisos declarados
**Android** (`android/app/src/main/AndroidManifest.xml`): INTERNET, CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS,
ACCESS_FINE/COARSE_LOCATION, NFC (+ `hce`), READ_MEDIA_IMAGES/VIDEO (+ storage ≤ API 32), POST_NOTIFICATIONS,
USE_BIOMETRIC, VIBRATE. Cámara/micrófono/NFC/GPS marcados como `required=false` (la app se instala en cualquier teléfono).
`windowSoftInputMode=adjustResize` + `Keyboard.resizeOnFullScreen` para que el chat y el pill de navegación
suban con el teclado.

**iOS** (`ios/App/App/Info.plist`): `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`,
`NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSLocationWhenInUseUsageDescription`,
`NFCReaderUsageDescription`, `NSFaceIDUsageDescription`, `UIBackgroundModes` (remote-notification, audio, voip),
solo retrato en iPhone. `App.entitlements`: push (`aps-environment`), NFC (`NDEF`, `TAG`), Associated Domains.

### Cómo se mantiene "la misma web"
- `REACT_APP_BACKEND_URL` se incrusta en el bundle al compilar. `yarn native:build` lo toma de `.env.native`
  y **rechaza** `localhost` o `http://`.
- `yarn native:verify` comprueba que el JS copiado en `android/` e `ios/` contiene exactamente ese dominio,
  que no hay `localhost:8001`, que el `applicationId`/bundle id coinciden y que todos los permisos están.
- La sesión en nativo va por **token Bearer** guardado cifrado en el dispositivo (`AuthContext` ya lo hace
  cuando `isNative()`); en web sigue siendo cookie httpOnly. El backend acepta ambos. CORS ya admite el
  origen de la app (`https://localhost` en Android, `capacitor://localhost` en iOS) porque `CORS_ORIGINS=*`;
  si en producción lo restringes, añade esos dos orígenes.
- WebSockets (chat, mapa, lives), Daily.co (llamadas/lives), Stripe Checkout (se abre en navegador del sistema
  y vuelve por deep link) y subidas por chunks funcionan igual que en la web.

---

## 2. 🧑‍💻 Lo que tienes que aportar

| Para | Qué | Dónde se usa |
|---|---|---|
| Que la app hable con tu backend | **Dominio público https** de producción | `frontend/.env.native` → `REACT_APP_BACKEND_URL` |
| Deep links `https://` | El mismo dominio | `android/app/src/main/res/values/strings.xml` → `deeplink_host`; `ios/App/App/App.entitlements` → `applinks:`; publicar `/.well-known/assetlinks.json` y `/.well-known/apple-app-site-association` (§9) |
| APK/AAB | **Android Studio** (SDK + Java 17) en tu PC/Mac | `yarn native:apk`, `yarn native:aab` |
| Firmar Android | **Keystore** `.jks` (lo creas tú una vez, §6) | `android/keystore.properties` |
| Google Play | Cuenta **Google Play Console** (25 USD una vez) | §7 |
| iOS | **Mac con Xcode** + cuenta **Apple Developer** (99 USD/año) | §8 |
| Push nativas | Proyecto **Firebase**: `google-services.json` (Android), `GoogleService-Info.plist` (iOS), clave `.p8` de APNs y service account para el backend | §5 |
| Mapas | Clave de Google Maps con facturación (opcional; hay fallback OpenStreetMap) | `.env.native` |

---

## 3. Preparar el entorno

### Cualquier sistema (Android)
1. Instala **Android Studio** → SDK Manager → *Android SDK Platform 35*, *Build-Tools*, *Command-line Tools*, *Platform-Tools*.
2. Variables:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk          # Mac: $HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export JAVA_HOME=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home   # Java 17 incluido
   ```
3. Node 20+, `yarn`.

### Mac (iOS)
```bash
xcode-select --install
sudo gem install cocoapods
```

### Clonar el código
Chat de Emergent → **Save to GitHub** → en tu equipo:
```bash
git clone https://github.com/TU_USUARIO/bruno-app.git && cd bruno-app/frontend && yarn install
```

---

## 4. Compilar la web para la app

```bash
cd frontend
cp .env.native.example .env.native
# edita .env.native → REACT_APP_BACKEND_URL=https://tu-dominio.com  (el dominio donde está desplegado BRUNO)
yarn native:build
```
Hace: `yarn build` → `npx cap sync android` → `npx cap copy ios` (en Mac `sync ios` con pods) → `native:verify`.
Repite `yarn native:build` cada vez que cambie el código React.

> Las carpetas `android/` e `ios/` ya están en el repo: **no** ejecutes `npx cap add`.

---

## 5. Push nativas (Firebase)

1. https://console.firebase.google.com → proyecto `bruno-app`.
2. **Android**: Add app → package `com.brunocard.app` → descarga `google-services.json` → `frontend/android/app/google-services.json`
   (Gradle lo aplica automáticamente si existe).
3. **iOS**: Add app → bundle `com.brunocard.app` → `GoogleService-Info.plist` → arrástralo a `ios/App/App` en Xcode.
   Xcode → Signing & Capabilities → **Push Notifications** y **Background Modes → Remote notifications** (ya vienen en `App.entitlements`).
4. **APNs**: developer.apple.com → Keys → APNs → descarga `.p8` → Firebase → Cloud Messaging → sube `.p8` + Key ID + Team ID.
5. **Backend**: Firebase → Service accounts → *Generate new private key* → en el `.env` del backend
   `FIREBASE_SERVICE_ACCOUNT_JSON={...json...}` → reinicia. Log esperado: `Firebase Admin SDK initialized — native push enabled`.
6. Prueba: inicia sesión en la app, acepta el permiso; `GET /api/mobile/devices` debe listar tu token.

---

## 6. Android: APK de prueba y AAB para Play

### APK de prueba (debug, sin firma propia)
```bash
yarn native:apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
O abre `yarn native:open:android` y pulsa ▶ con el teléfono conectado (depuración USB activada).

### Crear la keystore (una sola vez — **guárdala y sus contraseñas, sin ella no podrás actualizar la app**)
```bash
keytool -genkeypair -v -keystore ~/bruno-release.jks -alias bruno-key -keyalg RSA -keysize 2048 -validity 10000
cp android/keystore.properties.example android/keystore.properties   # rellena ruta y contraseñas
```
`android/keystore.properties` y `*.jks` están en `.gitignore`.

### AAB firmado
```bash
yarn native:aab        # → android/app/build/outputs/bundle/release/app-release.aab
yarn native:apk:release # → APK release firmado para probar fuera de Play
```
Versión: `android/app/build.gradle` → `versionCode` (+1 en cada subida) y `versionName`.

---

## 7. Publicar en Google Play

1. https://play.google.com/console → **Create app** → BRUNO, español, App, Gratis.
2. **App content**: política de privacidad (`https://tu-dominio.com/privacy`), *Data safety*, anuncios (No),
   público objetivo, declaración de **permisos sensibles** (cámara/micrófono/ubicación: explica reels, llamadas, mapa).
3. **Main store listing**: icono 512×512 (`android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` o `resources/icon.png`),
   gráfico 1024×500, ≥2 capturas por tipo de dispositivo.
4. **Testing → Internal testing** primero (recomendado): sube el AAB, añade tus correos, instala desde el enlace.
5. **Production → Create release** → sube `app-release.aab` → notas → *Start rollout*. Revisión 1-3 días la primera vez.

---

## 8. iOS: compilar y publicar en App Store (Mac)

```bash
cd frontend && yarn native:build && npx cap sync ios && yarn native:open:ios
```
En Xcode:
1. Target **App** → Signing & Capabilities → *Automatically manage signing* → **Team** = tu cuenta.
   Capabilities ya declaradas en `App.entitlements`: Push, **Near Field Communication Tag Reading**, Associated Domains,
   Background Modes. Si Xcode las marca en rojo, pulsa "+ Capability" y añádelas (se sincronizan con el portal).
2. Conecta el iPhone → selecciónalo → ▶ para probar. Primera vez: Ajustes → General → VPN y gestión de dispositivos → confiar.
3. **Archive**: esquema *Any iOS Device (arm64)* → Product → Archive → *Distribute App* → App Store Connect → Upload.
4. https://appstoreconnect.apple.com → My Apps → + → bundle `com.brunocard.app`, SKU `brunocard-app-001`.
   Ficha: nombre BRUNO, categoría Social Networking, capturas 6,7" (1290×2796), icono 1024 sin alfa (`resources/icon.png`),
   URL de privacidad, **cuenta demo para revisión** (`newtest@bruno.com` / `Test1234!`).
   *App Privacy*: declara cámara, micrófono, ubicación, contactos (no), identificadores (no).
5. **Submit for Review**. 24-48 h.

Versión: Xcode → General → *Version* (`MARKETING_VERSION`) y *Build* (`CURRENT_PROJECT_VERSION`, +1 por subida).

---

## 9. Deep links https (opcional pero recomendado)

1. `android/app/src/main/res/values/strings.xml` → `deeplink_host` = `tu-dominio.com`.
2. `ios/App/App/App.entitlements` → `applinks:tu-dominio.com`.
3. Publica en el backend:
   - `https://tu-dominio.com/.well-known/assetlinks.json` con el SHA-256 de tu keystore (`keytool -list -v -keystore ~/bruno-release.jks`).
   - `https://tu-dominio.com/.well-known/apple-app-site-association` con `TEAMID.com.brunocard.app`.
   Así `https://tu-dominio.com/c/<tarjeta>` y los tags NFC PIUP abren la app directamente.

---

## 10. Checklist antes de publicar

- [ ] `yarn native:build` termina con "✅ Paquete nativo coherente con la web (https://…)"
- [ ] Login, Reels, chat con teclado, mapa, cámara (reel), llamada y NFC probados en un teléfono real
- [ ] Push de prueba recibida (Android e iOS)
- [ ] `google-services.json` / `GoogleService-Info.plist` presentes (no se suben a git)
- [ ] Iconos y splash en claro y oscuro (`yarn native:assets` si cambias `resources/`)
- [ ] `versionCode`/`versionName` (Android) y Version/Build (iOS) actualizados
- [ ] Política de privacidad publicada y cuenta demo lista

---

## 11. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| "Cannot connect" / pantalla de login no responde | `.env.native` apunta a `localhost` o a un dominio sin https. `yarn native:verify https://tu-dominio.com`. |
| CORS en consola del WebView | Si restringiste `CORS_ORIGINS` en el backend, añade `https://localhost` y `capacitor://localhost`. |
| Teclado tapa el chat en Android | Confirma `windowSoftInputMode="adjustResize"` en el manifest y `Keyboard.resizeOnFullScreen=true` en `capacitor.config.json`. |
| Face ID no aparece | iOS Simulator → Features → Face ID → Enrolled. En Android, registra una huella en el sistema. |
| NFC no escribe en iPhone | Capability *Near Field Communication Tag Reading* no activada en Xcode; iPhone solo lee/escribe tags, no emite. |
| Splash en blanco o icono por defecto | Ejecuta `yarn native:assets` y vuelve a `yarn native:build`. |
| `google-services.json not found` | Push desactivadas hasta añadir el archivo de Firebase; el resto funciona. |
| Build iOS falla por pods | `cd ios/App && pod install --repo-update`. |
| Android: "SDK location not found" | `export ANDROID_HOME=...` o crea `android/local.properties` con `sdk.dir=/ruta/al/sdk`. |

---

## 12. NFC: qué puede hacer cada teléfono

| | Leer tag PIUP | Escribir tag PIUP | Emitir la tarjeta a otro teléfono |
|---|---|---|---|
| Android app | ✅ | ✅ | ✅ (HCE, lo lee un iPhone o Android) |
| Android Chrome (web) | ✅ Web NFC | ✅ Web NFC | ❌ |
| iPhone app | ✅ | ✅ | ❌ (Apple no lo permite) → AirDrop / QR |
| iPhone Safari | ❌ | ❌ | ❌ → QR / enlace |

**Última actualización:** Fase 86 · Junio 2026
