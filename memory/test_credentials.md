# Test Credentials - BRUNO App

## Main Test Account
- Email: newtest@bruno.com
- Password: Test1234!

## Test Card ID
- d16c2745-e082-4b22-84f8-749beb5e33fd

## App URLs
- Frontend: https://premium-launch-13.preview.emergentagent.com
- Backend API: https://premium-launch-13.preview.emergentagent.com/api

## Viewer secundario (lives privados)
- viewer2@bruno.com / Test1234!  (creado 2026-06, para probar entrar a un live privado con código)
- viewer3@bruno.com, viewer4@bruno.com, viewer5@bruno.com / Test1234! (creados para probar agrupación de notificaciones)

## Tour tester (usuario nuevo, para ver el tour una sola vez)
- tourtest1@bruno.com / Test1234! (ya vio el tour en este navegador; registrar tourtestN nuevo para volver a verlo)

## Grupo de prueba
- chat id 655d23d2-b133-4188-a95c-bd8a777c04f4 "Equipo BRUNO" (admin newtest)

## Segunda cuenta (espectador de lives / pruebas con dos usuarios)
- Email: viewer2@bruno.com
- Password: Test1234!
- username: viewerdos · id: 3636b29b-ae7d-49c4-8a1e-2312500d0eeb

## Cuentas QA aisladas (auth / chats / llamadas) — creadas 2026-06
- A: testa@brunoqa.com / Prueba1234!
- B: testb@brunoqa.com / Prueba1234!
- C: testc@brunoqa.com / Prueba1234!
- Script de regresión: `cd /app/backend && python3 tests/test_auth_chat_isolation.py` (33 comprobaciones; necesita Origin en WS).
- Bloqueo: 5 fallos → 429 durante 15 min (por correo y por IP).
- Admin QA (finanzas /admin/money): testc@brunoqa.com / Prueba1234! (role=admin)
- Stripe: sandbox reclamable (Flow A) — claves en backend/.env (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET). Connect NO activado hasta reclamar la cuenta. Test de monetización: `python3 tests/test_money.py` (24/24).

## Comprador QA con correo real entregable (recibos por email, Resend) — creado 2026-06
- delivered+brunoqa@resend.dev / Prueba1234! (id f113dac3-0932-45b6-812b-5ac241c5408d)
- Cupones de prueba del vendedor newtest: VERANO20 (20 %, 2 usos, caduca 31/12/2026), FIJO5 (5 USD, solo Marketplace)
- Producto de newtest para cotizar: 4334a391-d035-463c-b8cc-3e18e88aa833 (149.99 USD)

## Sesión web con cookie httpOnly (2026-06)
- Login web → cookie `bruno_session` (httpOnly, Secure, SameSite=Lax, path=/api) + token en memoria (no en localStorage). `POST /api/auth/session/restore` devuelve el token a partir de la cookie. Nativo (platform=native) sigue con Bearer en almacenamiento cifrado.
- Compra simulada QA del comprador delivered+brunoqa@resend.dev (vendedor testa@brunoqa.com) para /purchases y reenvío de recibo.

## Lives / PIN / créditos (2026-06)
- Host QA: testb@brunoqa.com / Prueba1234! · Espectador adulto: viewer2@bruno.com / Test1234! (birth_date 1990-05-05, saldo de créditos ~6 USD) · Menor: ninguno (usar un usuario nuevo y POST /api/users/me/birth-date con fecha reciente).
- Flujo live: POST /api/lives (status preparing) → POST /api/lives/{id}/start (live) → POST /heartbeat cada 20 s → POST /end. Privados: PIN en respuesta de creación (`access_code`, solo host); espectador POST /join {access_code}; 5 fallos → 429 15 min (colección pin_attempts).
- Créditos: GET /api/credits/wallet, /gifts, POST /api/credits/gift {live_id,gift_id,quantity}. Recarga: POST /api/money/checkout kind "credits" option c5|c10|c20|c50.

## Búsqueda global (2026-06)
- Datos semilla: tarjeta privada "Tarjeta Secreta Zanahoria" (newtest, is_public=false → NO debe aparecer); tarjeta pública de negocio "Panadería Doña Ñoña" (viewer3 → aparece en Tarjetas y Empresas); viewer4@bruno.com es cuenta PRIVADA con post "Xilófono privado…" (solo visible para sus seguidores); post antiguo público "Canción antigua del río Magdalena" (viewer3, 2026-01-05).
- Admin reindex: POST /api/search/admin/reindex (testc@brunoqa.com). Estado: GET /api/search/status.
- Historial de moderación: /admin/users (buscar usuario) y /admin/users/{id}/moderation (admin testc). Usuario con acción registrada: Prueba B (testb@brunoqa.com, id b1838f61-9fcf-4f4f-b4cb-2da82280dada).

## Videos largos / cupones / voz (2026-06)
- Videos largos semilla (newtest): 12b28791-edff-4be8-875d-f23742f6b758 (420 s, capítulos en descripción) y bdce489a-6f05-46b3-93c4-a0e70360bd64 (600 s). Ruta /video/:id. Feed: GET /api/posts/recommended-videos?kind=video&long=1.
- Progreso: POST/GET /api/posts/{id}/progress. Capítulos: PUT /api/posts/{id} {chapters:[{time,title}]} (solo dueño).
- Cupones: GET /api/money/coupons/stats (clics se cuentan al abrir GET /api/money/coupons/{id}/public).
- Serie semilla (newtest): 6ff8761f-215b-423d-a934-d0bd9a017824 "Curso BRUNO completo" (2 videos). Rutas /series/:id, /series/new, /video/:id?series=:sid. Capítulos IA: POST /api/posts/{id}/chapters/ai (422 en videos sin voz).
- Ejemplos de tarjetas: /cards/examples, /cards/examples/{type}?template=..., público /c/example-{type}?template&lang. API: /api/card-examples, /api/card-examples/coverage/report. Sin login.
