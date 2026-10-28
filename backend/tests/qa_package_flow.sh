#!/bin/bash
# Flujo QA del paquete «perfil completo + 3 tarjetas»: asesor → finalizar → cliente acepta → efectivo confirmado → transferencia
set -u
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
LOGIN() { curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | J "d['access_token']"; }
ADMIN=$(LOGIN testc@brunoqa.com 'Prueba1234!'); ADV=$(LOGIN viewer3@bruno.com 'Test1234!'); CLI=$(LOGIN newtest@bruno.com 'Test1234!'); OTHER=$(LOGIN viewer2@bruno.com 'Test1234!')
echo "== 0. roles: asesor + permiso de cobro a viewer3"
curl -s -X POST "$API/api/packages/staff" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"email":"viewer3@bruno.com","role":"asesor","cash_collector":true}'; echo
curl -s "$API/api/packages/me/access" -H "Authorization: Bearer $ADV"; echo
curl -s -o /dev/null -w "cliente lista paquetes: %{http_code}\n" "$API/api/packages" -H "Authorization: Bearer $CLI"
echo "== 1. crear paquete (3 tarjetas ocultas)"
P=$(curl -s -X POST "$API/api/packages" -H "Authorization: Bearer $ADV"); PID=$(echo "$P" | J "d['id']"); echo "$P" | J "(d['ref'], d['advisor_handle'], len(d['card_ids']), d['prep_status'])"
echo "asesor ve las tarjetas del paquete en su perfil? (0):"; curl -s "$API/api/cards" -H "Authorization: Bearer $ADV" | J "sum(1 for c in d if c.get('package_id')=='$PID')"
echo "== 2. autoguardado + otro asesor sin acceso (403)"
curl -s -X PATCH "$API/api/packages/$PID" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"client":{"name":"Cliente QA Paquete","bio":"Bio QA","profession":"Diseñadora","phone":"+57 300","website":"https://qa.example.com","social_links":[{"url":"https://instagram.com/qa"}],"password":"NO"}}' | J "('password' in d['client'], d['client']['name'])"
curl -s -o /dev/null -w "otro usuario GET: %{http_code}\n" "$API/api/packages/$PID" -H "Authorization: Bearer $OTHER"
echo "== 3. finalizar sin títulos (400) → poner títulos → finalizar efectivo CO"
curl -s -X POST "$API/api/packages/$PID/finalize" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"advisor_handle":"@viewer3","market":"CO","payment_method":"cash"}' | head -c 150; echo
for CID in $(echo "$P" | J "' '.join(d['card_ids'])"); do curl -s -o /dev/null -X PUT "$API/api/cards/$CID" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"title":"Tarjeta QA '$RANDOM'"}'; done
echo "-- @ incorrecto (400):"; curl -s -X POST "$API/api/packages/$PID/finalize" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"advisor_handle":"@otro","market":"CO","payment_method":"cash"}' | head -c 120; echo
HANDLE=$(curl -s "$API/api/packages/me/access" -H "Authorization: Bearer $ADV" | J "d['handle']")
F=$(curl -s -X POST "$API/api/packages/$PID/finalize" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d "{\"advisor_handle\":\"@$HANDLE\",\"market\":\"CO\",\"payment_method\":\"cash\"}"); echo "$F" | J "(d['prep_status'], d['currency'], d['amount'], d['payment_method'], d['payment_status'], d['delivery_status'])"
URL=$(echo "$F" | J "d['claim_url']"); TOK=${URL##*/}; echo "claim url: ${URL:0:60}..."
echo "== 4. enlace: vista previa sin sesión (sin datos privados), aceptar sin sesión 401"
curl -s "$API/api/packages/claim/$TOK" | J "(d['state'], d['client_first_name'], 'client' in d, d['price_label'])"
curl -s -o /dev/null -w "accept sin sesión: %{http_code}\n" -X POST "$API/api/packages/claim/$TOK/accept" -H "Content-Type: application/json" -d '{"profile_fields":[],"confirm_handle":"x"}'
echo "== 5. cliente logueado: revisión completa + diff + aceptar con @ incorrecto (400) y correcto"
R=$(curl -s "$API/api/packages/claim/$TOK" -H "Authorization: Bearer $CLI"); echo "$R" | J "(d['state'], d['account']['handle'], len(d['cards']), [f['field'] for f in d['profile_diff']], d['provider_ready'])"
CH=$(echo "$R" | J "d['account']['handle']")
curl -s -X POST "$API/api/packages/claim/$TOK/accept" -H "Authorization: Bearer $CLI" -H "Content-Type: application/json" -d '{"profile_fields":["bio"],"confirm_handle":"@nope"}' | head -c 120; echo
curl -s -X POST "$API/api/packages/claim/$TOK/accept" -H "Authorization: Bearer $CLI" -H "Content-Type: application/json" -d "{\"profile_fields\":[\"bio\",\"profession\",\"website\"],\"confirm_handle\":\"@$CH\"}" | J "(d['payment_status'], d['delivery_status'], d['payment_method'])"
echo "-- otra cuenta intenta reclamar (409) y ver (claimed_by_other):"; curl -s -o /dev/null -w "%{http_code} " -X POST "$API/api/packages/claim/$TOK/accept" -H "Authorization: Bearer $OTHER" -H "Content-Type: application/json" -d '{"profile_fields":[],"confirm_handle":"viewer2"}'; curl -s "$API/api/packages/claim/$TOK" -H "Authorization: Bearer $OTHER" | J "d['state']"
echo "-- checkout virtual CO sin Wompi (503) y por otro usuario (403):"; curl -s -o /dev/null -w "%{http_code} " -X POST "$API/api/packages/$PID/checkout" -H "Origin: $API" -H "Authorization: Bearer $CLI"; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/api/packages/$PID/checkout" -H "Origin: $API" -H "Authorization: Bearer $OTHER"
echo "cliente ya tiene las tarjetas? (0):"; curl -s "$API/api/cards" -H "Authorization: Bearer $CLI" | J "sum(1 for c in d if c.get('package_id')=='$PID')"
echo "== 6. efectivo: cliente no puede (403); importe incorrecto (400); asesor con permiso confirma → transferencia"
curl -s -o /dev/null -w "cliente confirma efectivo: %{http_code}\n" -X POST "$API/api/packages/$PID/cash-confirm" -H "Authorization: Bearer $CLI" -H "Content-Type: application/json" -d '{"amount_received":30000,"currency":"COP","receipt_ref":"R-1"}'
curl -s -o /dev/null -w "importe incorrecto: %{http_code}\n" -X POST "$API/api/packages/$PID/cash-confirm" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"amount_received":25000,"currency":"COP","receipt_ref":"R-1"}'
curl -s -X POST "$API/api/packages/$PID/cash-confirm" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"amount_received":30000,"currency":"COP","receipt_ref":"R-QA-1","note":"QA"}' | J "(d['receipt']['id'], d['payment_status'], d['delivery_status'])"
curl -s -X POST "$API/api/packages/$PID/cash-confirm" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"amount_received":30000,"currency":"COP","receipt_ref":"R-QA-1"}'; echo " (segunda vez: already)"
echo "tarjetas del paquete en cuenta cliente (3):"; curl -s "$API/api/cards" -H "Authorization: Bearer $CLI" | J "sum(1 for c in d if c.get('package_id')=='$PID')"
echo "perfil cliente actualizado:"; curl -s "$API/api/profile" -H "Authorization: Bearer $CLI" | J "(d.get('bio'), d.get('profession'), d.get('website'))"
echo "asesor ya no edita (409 patch / 403 card):"; curl -s -o /dev/null -w "%{http_code} " -X PATCH "$API/api/packages/$PID" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"client":{"name":"x"}}'; CID1=$(echo "$P" | J "d['card_ids'][0]"); curl -s -o /dev/null -w "%{http_code}\n" -X PUT "$API/api/cards/$CID1" -H "Authorization: Bearer $ADV" -H "Content-Type: application/json" -d '{"title":"hack"}'
echo "enlace tras activación (estado):"; curl -s "$API/api/packages/claim/$TOK" -H "Authorization: Bearer $CLI" | J "(d['state'], d['delivery_status'])"
echo "== 7. admin: lista con filtros + historial"
curl -s "$API/api/packages?advisor=$HANDLE&market=CO&payment_method=cash&delivery=activated" -H "Authorization: Bearer $ADMIN" | J "len(d)"
curl -s "$API/api/packages/$PID" -H "Authorization: Bearer $ADMIN" | J "[h['action'] for h in d['history']]"
echo "PID=$PID"
