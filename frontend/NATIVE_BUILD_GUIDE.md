# BRUNO · Guía de compilación nativa (Capacitor 7 · Android + iOS)

Dominio oficial: **https://brunocard.com** (web + API `/api`). App ID: **com.brunocard.app**.

## 1. Preparar el bundle web de producción
```bash
cd frontend
cp .env.native.example .env.native        # ya creado: REACT_APP_BACKEND_URL=https://brunocard.com (+ claves públicas)
yarn native:build                         # yarn build → cap sync android → cap copy ios → native-verify
yarn native:verify https://brunocard.com  # comprueba que android/ e ios/ apuntan a producción
```
`native-verify` falla si el bundle contiene `localhost:8001` o el dominio de preview.

## 2. Android (Android Studio o CLI)
```bash
yarn native:open:android          # abre android/ en Android Studio
yarn native:apk                   # APK debug  → android/app/build/outputs/apk/debug/
yarn native:apk:release           # APK release (requiere android/keystore.properties)
yarn native:aab                   # AAB para Google Play
```
- Firma: copia `android/keystore.properties.example` → `android/keystore.properties` (no se versiona).
- Push: coloca `android/app/google-services.json` (Firebase → Configuración del proyecto → Apps → Android `com.brunocard.app`). Sin él, Gradle omite el plugin y la app compila sin push.
- App Links: edita `public/.well-known/assetlinks.json` con las huellas SHA-256:
  `keytool -list -v -keystore <keystore> -alias <alias>` (subida) y la de **Play App Signing** (Play Console → Integridad de la app). Verifica tras desplegar:
  `curl -s https://brunocard.com/.well-known/assetlinks.json` y en el móvil `adb shell pm verify-app-links --re-verify com.brunocard.app`.

## 3. iOS (solo en macOS con Xcode 15+)
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

## 4. Backend (push nativo)
- `FIREBASE_SERVICE_ACCOUNT_JSON` en `backend/.env` (JSON de la cuenta de servicio o ruta al archivo). Sin él, `utils/native_push.py` registra "native push disabled" y solo funciona Web Push.

## 5. Pruebas en dispositivo (no automatizables aquí)
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

## 6. Versionado
- Android: `versionCode` / `versionName` en `android/app/build.gradle`.
- iOS: `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` en Xcode (General).
