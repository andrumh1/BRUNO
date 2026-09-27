# 📱 BRUNO — Guía de compilación nativa iOS + Android

Esta guía te lleva paso a paso desde el estado actual (código listo, Capacitor
integrado) hasta tener tu app publicada en **App Store** y **Google Play**.

---

## 📋 Índice

1. [Estado actual del código](#1-estado-actual-del-código)
2. [Crear cuentas de desarrollador](#2-crear-cuentas-de-desarrollador)
3. [Descargar código a tu Mac](#3-descargar-el-código-a-tu-mac)
4. [Setup local (Node, Xcode, Android Studio)](#4-setup-local)
5. [Añadir plataformas nativas](#5-añadir-plataformas-nativas)
6. [Iconos y Splash screens](#6-iconos-y-splash-screens)
7. [Configurar Firebase (Push nativas)](#7-configurar-firebase-para-push-nativas)
8. [Configurar APNs (iOS push)](#8-configurar-apns-ios-push)
9. [Compilar y probar en dispositivo](#9-compilar-y-probar-en-dispositivo-real)
10. [Publicar en App Store](#10-publicar-en-app-store)
11. [Publicar en Google Play](#11-publicar-en-google-play)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Estado actual del código

✅ **Ya integrado en tu proyecto BRUNO:**

- `@capacitor/core` + `@capacitor/ios` + `@capacitor/android` (v7)
- Plugins nativos: `camera`, `geolocation`, `push-notifications`, `share`,
  `splash-screen`, `status-bar`, `haptics`, `app`, `filesystem`,
  `preferences`, `network`.
- `capacitor.config.ts` — bundle ID `com.brunocard.app`, nombre "BRUNO"
- `/app/frontend/src/native/` — helpers reutilizables:
  - `capacitor.js` — detección de plataforma
  - `useNativePush.js` — registro FCM/APNs → backend
  - `nativeApis.js` — cámara, geo, share, haptics (con fallback web)
  - `NativeBootstrap.jsx` — mounted globalmente, integra todo
- Backend `utils/native_push.py` — envía FCM/APNs cuando hay device tokens
- Endpoint `/api/mobile/devices/register` — recibe tokens de dispositivos

Faltan solo pasos **fuera del código** (cuentas + build local).

---

## 2. Crear cuentas de desarrollador

### 2.1 Apple Developer Program ($99 USD/año)

1. Ve a **https://developer.apple.com/programs/enroll/**
2. Necesitas un **Apple ID** con autenticación de dos factores activada.
3. Elige **Individual** (más rápido, sin papeleo D-U-N-S) o **Organization**
   (nombre de empresa, requiere D-U-N-S Number gratis).
4. Paga $99 USD. Aprobación: 24-48h típico.
5. Cuando esté activa, entra a **App Store Connect**:
   https://appstoreconnect.apple.com/

### 2.2 Google Play Console ($25 USD único)

1. Ve a **https://play.google.com/console/signup**
2. Elige **Cuenta personal** o **Organización**.
3. Paga $25 USD (una sola vez, cuenta de por vida).
4. Verificación: 24-48h. Necesitarás foto de documento oficial.

### 2.3 (Opcional) Firebase — gratis

1. https://console.firebase.google.com/ → **Add project**
2. Nombre: `bruno-app` (o el que prefieras)
3. **NO** actives Google Analytics para este paso (opcional después)
4. Espera 30s a que se cree.

---

## 3. Descargar el código a tu Mac

En el chat de Emergent, usa el botón **"Save to GitHub"**:

1. Conecta tu cuenta de GitHub
2. Crea un repo nuevo llamado `bruno-app`
3. Push automático → tu código está en GitHub

En tu Mac:
```bash
cd ~/Developer
git clone https://github.com/TU_USUARIO/bruno-app.git
cd bruno-app/frontend
```

Copia el `.env` de producción (te lo genero al final, con las URLs correctas):
```bash
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://brunocard.com
EOF
```

Instala dependencias:
```bash
yarn install
```

---

## 4. Setup local

### Mac (para iOS):

```bash
# Xcode — desde App Store, ~15 GB. Requerido para iOS.
xcode-select --install

# CocoaPods — gestor de dependencias iOS
sudo gem install cocoapods

# Verificar Node 20+
node --version   # debe ser >= 20
```

### Cualquier OS (para Android):

1. Descarga **Android Studio**: https://developer.android.com/studio
2. Abre → Preferences → Appearance → System Settings → Android SDK
3. Instala:
   - **Android SDK Platform** (API 34 o superior)
   - **Android SDK Build-Tools** (última)
   - **Android SDK Command-line Tools**
   - **Android Emulator** (para testing sin dispositivo)
4. Añade variables de entorno:
   ```bash
   # ~/.zshrc o ~/.bash_profile
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
   ```

---

## 5. Añadir plataformas nativas

En `frontend/`:

```bash
# Genera el build web primero
yarn build

# Añadir iOS (se crea carpeta ios/)
yarn cap:add:ios

# Añadir Android (se crea carpeta android/)
yarn cap:add:android

# Sincronizar el build web dentro de las carpetas nativas
yarn cap:sync
```

Ahora tienes dos proyectos nativos:
- `frontend/ios/` — abre con Xcode
- `frontend/android/` — abre con Android Studio

Cada vez que cambies código React:
```bash
yarn build && npx cap sync
```

---

## 6. Iconos y Splash screens

### Opción A — Usar CLI oficial (recomendado)

```bash
# Instalar assets tool
yarn add -D @capacitor/assets

# Prepara los archivos fuente:
mkdir -p frontend/resources
# Copia tu icono (mínimo 1024x1024 PNG) → frontend/resources/icon.png
# Copia tu splash (mínimo 2732x2732 PNG) → frontend/resources/splash.png
# Opcional: splash-dark.png para modo oscuro

# Generar todos los tamaños automáticamente:
npx capacitor-assets generate
```

Esto genera **decenas de tamaños** para iOS + Android automáticamente.

### Opción B — Manual

- iOS icono: `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (arrastra tu 1024x1024)
- Android icono: `android/app/src/main/res/mipmap-*` (5 tamaños)
- Splash Android: `android/app/src/main/res/drawable/splash.png`

**Ya tienes** `/app/frontend/public/bruno-mascot.png` que puedes usar como base.
Recomiendo redimensionar a 1024x1024 fondo naranja `#FF6B35` y logo blanco encima.

---

## 7. Configurar Firebase (para push nativas)

### 7.1 Añadir la app a Firebase

**Android:**
1. Firebase Console → tu proyecto → ⚙️ → Project Settings
2. **Add app** → Android
3. Package name: `com.brunocard.app`
4. Nickname: BRUNO Android
5. **Register app** → descarga `google-services.json`
6. Guarda en: `frontend/android/app/google-services.json`

**iOS:**
1. Firebase Console → **Add app** → iOS
2. Bundle ID: `com.brunocard.app`
3. Descarga `GoogleService-Info.plist`
4. Abre `frontend/ios/App/App.xcworkspace` con Xcode
5. Arrastra el `.plist` a la carpeta `App` (marca "Copy items if needed")

### 7.2 Configurar Gradle (Android)

Edita `frontend/android/build.gradle`:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.2'
    }
}
```

Edita `frontend/android/app/build.gradle`, al final del archivo:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 7.3 Backend — service account

1. Firebase Console → ⚙️ → Service accounts
2. **Generate new private key** → descarga JSON
3. **NO** subas este archivo a Git. Guarda su ruta.
4. En Emergent, configura la variable de entorno:
   ```bash
   # Añade a /app/backend/.env
   FIREBASE_SERVICE_ACCOUNT_JSON=/app/backend/secrets/firebase-admin.json
   ```
   O pega el JSON completo inline:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
   ```
5. Reinicia backend: `sudo supervisorctl restart backend`

**Verificación** — el log debe mostrar:
```
Firebase Admin SDK initialized — native push enabled
```

---

## 8. Configurar APNs (iOS push)

En **Apple Developer**:

1. https://developer.apple.com/account/resources/authkeys/list
2. **Keys** → **+** → **Apple Push Notifications service (APNs)** → Continue
3. Descarga el `.p8` (SOLO UNA VEZ, guárdalo bien) → anota **Key ID**
4. Anota tu **Team ID** (arriba a la derecha)

En **Firebase**:

1. Project Settings → Cloud Messaging → **Apple app configuration**
2. Sube el `.p8` con Key ID + Team ID

Firebase ya sabrá enrutar tus push a iOS. ✅

**En Xcode**, activa capabilities:
1. Abre `frontend/ios/App/App.xcworkspace`
2. Signing & Capabilities → **+ Capability** → **Push Notifications**
3. **+ Capability** → **Background Modes** → activa **Remote notifications**

---

## 9. Compilar y probar en dispositivo real

### iOS (necesitas cable + Mac):

```bash
cd frontend
yarn build && npx cap sync ios
npx cap open ios   # abre Xcode
```

En Xcode:
1. Signing & Capabilities → **Team**: elige tu Apple Developer
2. Conecta iPhone por USB → confía en el ordenador
3. Selecciona tu iPhone arriba a la izquierda
4. Presiona ▶️ Play

Primera vez: en iPhone → Settings → General → VPN & Device Management →
confía en tu developer certificate.

### Android (más flexible):

```bash
cd frontend
yarn build && npx cap sync android
npx cap open android   # abre Android Studio
```

En Android Studio:
1. Sync Gradle (esquina superior derecha)
2. Conecta Android por USB con **USB debugging** activado (Settings → About →
   toca 7x en Build number → Developer options → USB debugging)
3. Selecciona tu dispositivo arriba
4. Presiona ▶️ Run

O directo por CLI:
```bash
npx cap run android
```

---

## 10. Publicar en App Store

### 10.1 Build para producción

En Xcode:
1. Product → Scheme → Edit Scheme → Build Configuration = **Release**
2. Selecciona **Any iOS Device (arm64)** arriba
3. Product → **Archive** (tarda 5-10 min)
4. Organizer se abre → **Distribute App** → App Store Connect → Upload

### 10.2 Ficha en App Store Connect

1. https://appstoreconnect.apple.com/ → My Apps → **+** → New App
2. Bundle ID: `com.brunocard.app`
3. SKU: `brunocard-app-001`
4. Rellena:
   - **Nombre**: BRUNO
   - **Subtítulo**: Tu red social profesional
   - **Categoría primaria**: Social Networking (o Business)
   - **Descripción**: (500 caracteres+)
   - **Palabras clave**: red social, negocios, tarjetas, digital, NFC, videos
   - **Screenshots**: 6.7" iPhone (1290x2796) — mínimo 3, máximo 10
   - **Ícono**: 1024x1024 sin transparencia
   - **Privacy Policy URL**: https://brunocard.com/privacy
5. **App Review Information**: nombre, email, teléfono, cuenta demo
   (credenciales de prueba: `newtest@bruno.com` / `Test1234!`)
6. Cuando el build subido aparezca (30 min), selecciónalo.
7. **Submit for Review**

⏱️ Apple review: 24-48h típico (a veces más si es tu primera app).

---

## 11. Publicar en Google Play

### 11.1 Firmar el AAB

En Android Studio:
1. Build → **Generate Signed Bundle / APK** → Android App Bundle → Next
2. Create new keystore (**guarda bien** este .jks + contraseñas — sin él no
   puedes actualizar la app):
   - Path: `~/Documents/bruno-keystore.jks`
   - Password: (tú eliges, mínimo 6 caracteres)
   - Alias: `bruno-key`
   - Validity: 25 años
   - Certificate: rellena tu nombre + organización
3. **Release** build → Finish

Se genera: `android/app/release/app-release.aab`

### 11.2 Ficha en Play Console

1. https://play.google.com/console → **Create app**
2. Nombre: BRUNO
3. Idioma default: Spanish
4. Tipo: App
5. Free / Paid: Free
6. Declaraciones (contenido no restringido, etc.)
7. Menú lateral:
   - **App content** → completa Privacy Policy, Data safety, Ads (No), etc.
   - **Store settings** → categoría Social o Business
   - **Main store listing** → nombre, breve descripción (80c), descripción
     completa (4000c), ícono (512x512), gráfico destacado (1024x500),
     mínimo 2 screenshots por dispositivo (teléfono 1080x1920)
   - **Production** → Create new release
     - Upload `app-release.aab`
     - Release name: `1.0.0 (1)`
     - Release notes: "Primera versión de BRUNO 🎉"
   - **Save** → **Review release** → **Start rollout to production**

⏱️ Google review: 1-3 días la primera vez, luego horas.

---

## 12. Troubleshooting

### "Firebase Admin SDK initialized" no aparece en logs
- Verifica que `FIREBASE_SERVICE_ACCOUNT_JSON` esté en `/app/backend/.env`
- Reinicia: `sudo supervisorctl restart backend`
- Testea:
  ```bash
  curl -X POST https://brunocard.com/api/push/test \
    -H "Authorization: Bearer $TOKEN"
  ```

### "No matching signing identity" en Xcode
- Xcode → Settings → Accounts → añade tu Apple ID de developer
- Signing & Capabilities → **Automatically manage signing** = ON
- Team = tu developer account

### App crashea al abrir en Android
- Verifica `google-services.json` está en `android/app/`
- `cd android && ./gradlew clean` luego `yarn cap:sync android`

### Push nativa no llega
- Revisa `/api/mobile/devices` — debería listar tu device_token
- Firebase Console → Cloud Messaging → **Send test message** al token
- Si llega en Firebase pero no en la app: revisa capabilities iOS
  (Push Notifications + Background Modes → Remote notifications)

### Frontend en web deja de compilar tras `yarn add @capacitor/*`
- Los imports son tree-shakeable en web (Capacitor detecta plataforma en
  runtime). Si aparece "Module not found" tras un cambio, ejecuta:
  ```bash
  rm -rf node_modules/.cache && yarn start
  ```

### "Cannot connect to backend" en la app instalada
- Verifica `.env` frontend antes de `yarn build`:
  ```
  REACT_APP_BACKEND_URL=https://brunocard.com
  ```
- **NO** uses `localhost` (el móvil no puede resolverlo)
- Después de cambiar `.env`, siempre `yarn build && npx cap sync`

---

## 🎯 Checklist final antes de publicar

- [ ] Build web funciona (`yarn build` sin errores)
- [ ] iOS abre en simulador
- [ ] Android abre en emulador
- [ ] Push notification test llega al móvil
- [ ] Login funciona apuntando al backend correcto (no localhost)
- [ ] Iconos y splash generados
- [ ] Privacy Policy publicada en `/privacy`
- [ ] Screenshots (3+ por tienda)
- [ ] Cuenta demo lista para reviewers
- [ ] Versión: `1.0.0` en ambos `Info.plist` (iOS) + `build.gradle` (Android)

---

## 📞 Ayuda

Si te trabas en cualquier paso, escríbeme en el chat y te ayudo a
diagnosticar. Los pasos que requieren tu Mac (Xcode, keystore, upload a
tiendas) no puedo hacerlos yo, pero puedo verificar código, endpoints,
configuración Firebase y errores específicos.

**Última actualización:** Fase 64 · Feb 2026


## 13. NFC HCE Android — transferir tarjeta a un iPhone con un toque
El código está en `frontend/native-android/nfc-hce/` (plugin `BrunoNfcHce` + `NdefHostApduService`).
Sigue el `README.md` de esa carpeta: copiar los `.java`, el `apdu_service.xml`, el snippet del manifest,
la cadena `nfc_service_desc` y registrar el plugin en `MainActivity`. Sin pasos extra en el frontend.
Limitación de plataforma: iPhone solo **lee** (XS+, pantalla encendida); no puede emitir NFC a otros teléfonos.
