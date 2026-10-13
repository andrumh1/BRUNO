#!/usr/bin/env bash
# Verifica que el bundle empaquetado en android/ e ios/ consume el mismo backend/dominio que la web.
# Uso: yarn native:verify [https://tu-dominio.com]
set -euo pipefail
cd "$(dirname "$0")/.."

EXPECTED="${1:-${REACT_APP_BACKEND_URL:-}}"
if [ -z "$EXPECTED" ] && [ -f .env.native ]; then EXPECTED="$(grep -E '^REACT_APP_BACKEND_URL=' .env.native | cut -d= -f2- | tr -d '"' || true)"; fi
if [ -z "$EXPECTED" ]; then echo "✖ Indica el dominio esperado: yarn native:verify https://tu-dominio.com" >&2; exit 1; fi

fail=0
check_dir () {
  local dir="$1" label="$2"
  local js
  js="$(ls "$dir"/static/js/main.*.js 2>/dev/null | head -1 || true)"
  if [ -z "$js" ]; then echo "✖ $label: no hay bundle en $dir (ejecuta yarn native:build)"; fail=1; return; fi
  if grep -q "$EXPECTED" "$js"; then echo "✔ $label: el bundle apunta a $EXPECTED"; else echo "✖ $label: el bundle NO contiene $EXPECTED"; fail=1; fi
  if grep -Eq 'localhost:8001|127\.0\.0\.1:8001' "$js"; then echo "✖ $label: el bundle contiene localhost:8001"; fail=1; fi
  local hits
  hits="$(grep -oE 'https://[a-z0-9.-]+\.(emergentagent\.com|emergent\.host)' "$js" | sort -u | grep -v "$EXPECTED" | grep -v "auth.emergentagent.com" || true)"
  if [ -n "$hits" ]; then echo "⚠ $label: otros dominios Emergent en el bundle (revisa .env): $hits"; fi
}

check_dir android/app/src/main/assets/public "Android"
check_dir ios/App/App/public "iOS"

if [ -f android/app/src/main/assets/capacitor.plugins.json ]; then
  echo "▶ Plugins nativos registrados en Android:"
  python3 - <<'PY'
import json
for p in json.load(open("android/app/src/main/assets/capacitor.plugins.json")):
    print("   •", p.get("pkg"), "→", p.get("classpath"))
PY
fi

APPID="$(python3 -c 'import json;print(json.load(open("capacitor.config.json"))["appId"])')"
grep -q "applicationId \"$APPID\"" android/app/build.gradle && echo "✔ Android applicationId = $APPID" || { echo "✖ applicationId en android/app/build.gradle ≠ $APPID"; fail=1; }
grep -q "PRODUCT_BUNDLE_IDENTIFIER = $APPID;" ios/App/App.xcodeproj/project.pbxproj && echo "✔ iOS bundle id = $APPID" || { echo "✖ bundle id iOS ≠ $APPID"; fail=1; }

for perm in CAMERA RECORD_AUDIO ACCESS_FINE_LOCATION NFC POST_NOTIFICATIONS USE_BIOMETRIC; do
  grep -q "android.permission.$perm" android/app/src/main/AndroidManifest.xml && echo "✔ Android permiso $perm" || { echo "✖ Falta permiso Android $perm"; fail=1; }
done
for key in NSCameraUsageDescription NSMicrophoneUsageDescription NSLocationWhenInUseUsageDescription NFCReaderUsageDescription NSFaceIDUsageDescription NSPhotoLibraryUsageDescription; do
  grep -q "$key" ios/App/App/Info.plist && echo "✔ iOS $key" || { echo "✖ Falta $key en Info.plist"; fail=1; }
done

[ "$fail" -eq 0 ] && echo "✅ Paquete nativo coherente con la web ($EXPECTED)" || { echo "❌ Hay problemas en el paquete nativo"; exit 1; }
