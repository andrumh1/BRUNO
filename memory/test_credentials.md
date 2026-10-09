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
