#!/bin/bash
# Flujo completo del pedido (QA): solicitud → checkout → producción → revisión → aprobación → pago manual → entrega
set -u
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
ADMIN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"email":"testc@brunoqa.com","password":"Prueba1234!"}' | J "d['access_token']")
CLIENT=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"email":"newtest@bruno.com","password":"Test1234!"}' | J "d['access_token']")
OTHER=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"email":"viewer2@bruno.com","password":"Test1234!"}' | J "d['access_token']")
echo "tokens ok: ${#ADMIN} ${#CLIENT} ${#OTHER}"

RID=$(python3 -c "import uuid;print(uuid.uuid4())")
echo "== 1. solicitud US con sesión del cliente"
R=$(curl -s -X POST "$API/api/bruno-service/requests" -H "Origin: $API" -H "Authorization: Bearer $CLIENT" -F requestId=$RID -F type=Personal -F name="QA Flujo" -F email=newtest@bruno.com -F cardName="Tarjeta QA Flujo" -F description="prueba" -F consent=on -F market=US -F language=es)
echo "$R"
echo "== 2. público + checkout (Stripe)"
curl -s "$API/api/bruno-service/orders/$RID/public"; echo
CK=$(curl -s -X POST "$API/api/bruno-service/orders/$RID/checkout" -H "Origin: $API"); echo "${CK:0:200}"
echo "== 3. producción: acceso, lista, detalle, crear tarjeta (2 veces → misma)"
curl -s "$API/api/bruno-service/me/access" -H "Authorization: Bearer $ADMIN"; echo
curl -s -o /dev/null -w "cliente lista: %{http_code}\n" "$API/api/bruno-service/orders" -H "Authorization: Bearer $CLIENT"
curl -s "$API/api/bruno-service/orders?status=pending_payment" -H "Authorization: Bearer $ADMIN" | J "len(d)"
C1=$(curl -s -X POST "$API/api/bruno-service/orders/$RID/card" -H "Authorization: Bearer $ADMIN"); echo "$C1"
C2=$(curl -s -X POST "$API/api/bruno-service/orders/$RID/card" -H "Authorization: Bearer $ADMIN"); echo "$C2"
CARD=$(echo "$C1" | J "d['card_id']")
echo "admin ve la tarjeta en su perfil? (debe ser 0):"; curl -s "$API/api/cards" -H "Authorization: Bearer $ADMIN" | J "sum(1 for c in d if c['id']=='$CARD')"
echo "== 4. enviar a revisión (v1)"
S1=$(curl -s -X POST "$API/api/bruno-service/orders/$RID/send-review" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"note":"Primera versión"}'); echo "$S1"
URL1=$(echo "$S1" | J "d['review_url']"); TOK1=${URL1##*/}
echo "== 5. revisión: sin sesión / otra cuenta / cuenta correcta"
curl -s "$API/api/bruno-service/review/$TOK1" | J "d['state']"
curl -s "$API/api/bruno-service/review/$TOK1" -H "Authorization: Bearer $OTHER" | J "d['state']"
curl -s "$API/api/bruno-service/review/$TOK1" -H "Authorization: Bearer $CLIENT" | J "(d['state'], d['version'], d['version_current'], d.get('card_changed'), 'card' in d)"
echo "-- otra cuenta intenta aprobar (403):"; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/api/bruno-service/review/$TOK1/approve" -H "Authorization: Bearer $OTHER" -H "Content-Type: application/json" -d '{"version":1}'
echo "== 6. el equipo modifica la tarjeta → aprobación de v1 debe fallar (409 stale)"
curl -s -o /dev/null -w "put card: %{http_code}\n" -X PUT "$API/api/cards/$CARD" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"subtitle":"Cambio tras envío"}'
curl -s -X POST "$API/api/bruno-service/review/$TOK1/approve" -H "Authorization: Bearer $CLIENT" -H "Content-Type: application/json" -d '{"version":1}'; echo
echo "== 7. reenviar (v2) → token v1 revocado"
S2=$(curl -s -X POST "$API/api/bruno-service/orders/$RID/send-review" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{}'); echo "$S2" | J "d['version']"
URL2=$(echo "$S2" | J "d['review_url']"); TOK2=${URL2##*/}
curl -s "$API/api/bruno-service/review/$TOK1" -H "Authorization: Bearer $CLIENT"; echo
echo "== 8. solicitar ajustes (ronda 1) y reenvío v2 (misma versión, hash igual)"
curl -s -X POST "$API/api/bruno-service/review/$TOK2/changes" -H "Authorization: Bearer $CLIENT" -H "Content-Type: application/json" -d '{"message":"Cambia el color"}'; echo
S3=$(curl -s -X POST "$API/api/bruno-service/orders/$RID/resend-review" -H "Authorization: Bearer $ADMIN"); echo "$S3" | J "d['version']"
TOK3=$(echo "$S3" | J "d['review_url'].rsplit('/',1)[1]")
echo "== 9. aprobar v2 sin publicar (doble clic) — sin pago → approved, no entregada"
curl -s -X POST "$API/api/bruno-service/review/$TOK3/approve" -H "Authorization: Bearer $CLIENT" -H "Content-Type: application/json" -d '{"version":2,"publish":false}' | J "(d.get('ok'), d.get('already'), d['production_status'], d['payment_status'])"
curl -s -X POST "$API/api/bruno-service/review/$TOK3/approve" -H "Authorization: Bearer $CLIENT" -H "Content-Type: application/json" -d '{"version":2,"publish":false}' | J "(d.get('ok'), d.get('already'), d.get('production_status') or d.get('detail'))"
echo "cliente ya ve la tarjeta? (debe ser 0):"; curl -s "$API/api/cards" -H "Authorization: Bearer $CLIENT" | J "sum(1 for c in d if c['id']=='$CARD')"
echo "== 10. pago: producción no puede conciliar (403); admin sí → entrega"
curl -s -o /dev/null -w "cliente paga manual: %{http_code}\n" -X POST "$API/api/bruno-service/orders/$RID/payment" -H "Authorization: Bearer $CLIENT" -H "Content-Type: application/json" -d '{"status":"paid","reference":"QA-REF-1"}'
curl -s -X POST "$API/api/bruno-service/orders/$RID/payment" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"status":"paid","reference":"QA-REF-1","note":"QA"}'; echo
curl -s -X POST "$API/api/bruno-service/orders/$RID/payment" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"status":"paid","reference":"QA-REF-1"}'; echo " (segunda vez: changed false)"
curl -s "$API/api/bruno-service/orders/$RID/public" | J "(d['production_status'], d['payment_status'], d['card_id'])"
echo "tarjeta en cuenta del cliente (debe ser 1):"; curl -s "$API/api/cards" -H "Authorization: Bearer $CLIENT" | J "[(c['is_public'], c['is_draft']) for c in d if c['id']=='$CARD']"
echo "tarjeta en cuenta admin (debe ser 0):"; curl -s "$API/api/cards" -H "Authorization: Bearer $ADMIN" | J "sum(1 for c in d if c['id']=='$CARD')"
echo "cliente edita su tarjeta:"; curl -s -o /dev/null -w "%{http_code}\n" -X PUT "$API/api/cards/$CARD" -H "Authorization: Bearer $CLIENT" -H "Content-Type: application/json" -d '{"subtitle":"Ahora es mía"}'
echo "admin ya no edita:"; curl -s -o /dev/null -w "%{http_code}\n" -X PUT "$API/api/cards/$CARD" -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" -d '{"subtitle":"x"}'
echo "== 11. historial"
curl -s "$API/api/bruno-service/orders/$RID" -H "Authorization: Bearer $ADMIN" | J "[h['action'] for h in d['history']]"
curl -s "$API/api/bruno-service/orders/$RID" -H "Authorization: Bearer $ADMIN" | J "[(e['kind'], e['status']) for e in d.get('client_emails',[])]"
echo "RID=$RID CARD=$CARD"
