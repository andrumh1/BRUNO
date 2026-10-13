#!/usr/bin/env bash
# Genera el APK de prueba (debug) o el AAB firmado para Google Play.
# Uso:  yarn native:apk        → android/app/build/outputs/apk/debug/app-debug.apk
#       yarn native:aab        → android/app/build/outputs/bundle/release/app-release.aab (necesita android/keystore.properties)
#       yarn native:apk:release → APK release firmado (para probar la build final fuera de Play)
set -euo pipefail
cd "$(dirname "$0")/../android"
MODE="${1:-debug}"

if ! command -v java >/dev/null 2>&1; then
  echo "✖ Necesitas Java 17+ (viene con Android Studio) y ANDROID_HOME apuntando al SDK." >&2; exit 1
fi
if [ ! -f local.properties ] && [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]; then
  echo "✖ Define ANDROID_HOME (ruta del SDK de Android) o crea android/local.properties con sdk.dir=..." >&2; exit 1
fi

case "$MODE" in
  debug)
    ./gradlew assembleDebug
    echo "✅ APK de prueba: $(pwd)/app/build/outputs/apk/debug/app-debug.apk"
    echo "   Instálalo con: adb install -r app/build/outputs/apk/debug/app-debug.apk";;
  release)
    [ -f keystore.properties ] || { echo "✖ Falta android/keystore.properties (copia keystore.properties.example)"; exit 1; }
    ./gradlew assembleRelease
    echo "✅ APK release firmado: $(pwd)/app/build/outputs/apk/release/app-release.apk";;
  aab)
    [ -f keystore.properties ] || { echo "✖ Falta android/keystore.properties (copia keystore.properties.example)"; exit 1; }
    ./gradlew bundleRelease
    echo "✅ AAB para Google Play: $(pwd)/app/build/outputs/bundle/release/app-release.aab";;
  *) echo "Uso: $0 [debug|release|aab]"; exit 1;;
esac
