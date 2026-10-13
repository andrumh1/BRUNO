#!/usr/bin/env bash
# Compila la web de BRUNO apuntando al backend de producción y la copia dentro de android/ e ios/.
# Uso:  yarn native:build            (lee frontend/.env.native)
#       REACT_APP_BACKEND_URL=https://tu-dominio.com yarn native:build
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.native ]; then set -a; . ./.env.native; set +a; fi
: "${REACT_APP_BACKEND_URL:?Falta REACT_APP_BACKEND_URL. Copia .env.native.example a .env.native y pon el dominio público de tu backend (el mismo que usa la web).}"

case "$REACT_APP_BACKEND_URL" in
  *localhost*|*127.0.0.1*|*0.0.0.0*) echo "✖ REACT_APP_BACKEND_URL no puede ser localhost: el teléfono no puede verlo." >&2; exit 1;;
  https://*) ;;
  *) echo "✖ REACT_APP_BACKEND_URL debe empezar por https:// (iOS/Android bloquean http en producción)." >&2; exit 1;;
esac

echo "▶ API/dominio que usará la app: $REACT_APP_BACKEND_URL"
export CI=false GENERATE_SOURCEMAP=false
yarn build

echo "▶ Sincronizando plugins y assets web → android/"
npx cap sync android
if [[ "${OSTYPE:-}" == darwin* ]]; then
  echo "▶ Sincronizando → ios/ (pod install)"
  npx cap sync ios
else
  echo "▶ Copiando → ios/ (en Linux/Windows no se ejecuta pod install; hazlo en el Mac con: npx cap sync ios)"
  npx cap copy ios
fi

bash scripts/native-verify.sh "$REACT_APP_BACKEND_URL"
