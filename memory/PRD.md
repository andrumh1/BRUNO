# BRUNO Social Network - PRD

## Phase 81: Idioma preferido · Traducción automática · Resumen diario · Recordatorios de encuesta · Catálogo PIUP + Suscripciones MEOW/DEAL (2026-06)
- **Idioma de traducción**: `SettingsPage` → select (auto/es/en/pt/fr/de/it/zh/ja/ar/ru/ko/hi) guarda `PUT /settings/preferences {language}` + `localStorage bruno_lang` (TranslateButton lo usa; "auto" = idioma del teléfono).
- **Traducción automática por chat**: toggle "Traducir automáticamente" en el menú de la campana (`MuteMenu`, `auto-translate-toggle`), `localStorage bruno_autotranslate_{chatId}`; `TranslateButton auto` traduce mensajes ajenos al llegar y no muestra nada si ya están en tu idioma.
- **Resumen diario** (`chat_ai.py`): `POST /cron/daily-digest` (Bearer `WEBHOOK_CRON_SECRET`, cron `0 13 * * *` en `.emergent/crons.yml`) → por usuario, grupos con ≥5 mensajes en 24h (máx. 3) → resumen IA guardado en `daily_digests` + notificación `daily_digest`; `GET /digest/latest`.
- **Recordatorios de encuesta** (`polls.py`): `duration_hours` → `closes_at`; `POST /cron/poll-reminders` (cron horario) notifica `poll_reminder` a quienes no votaron cuando cierra en <2h (`reminded` evita duplicados) y cierra automáticamente las vencidas (WS `poll_update`). UI: chips "Cierra en" en `CreatePollSheet`, "cierra en X" en `PollMessage`.
- **Marketplace / Store** (`routers/store.py`, `server.py /store/products` delega al catálogo): 19 productos oficiales PIUP con `group` (hogar 5 / comercios 3 / oficinas 10 / mascotas 1), `sizes` con códigos C/U/R 1-7 (`PIUP_SIZES`, precio por tamaño `SIZE_PRICE`, `size_options`), `GET /store/sizes`, `GET /store/plans` (MEOW Starter/Growth/Pro/Business 15/29/49/79 mensual ×10 anual; DEAL Starter/Professional/Business/Enterprise 39/79/149/249), `subscribe/{tier}` acepta ids `meow-*`/`deal-*`. `MarketplacePage`: toggle Mensual/Anual, 2 marcas × 4 planes, productos agrupados con chips de medidas y "N opciones"; leyenda de medidas.
- FIX: burbujas flotantes (IA/Chat) ocultas en `/chat/*` — tapaban el clip del composer en móvil. `?group=` filtro real en el router store.
- Verificado iteration_90: backend 12/12 + regresión; frontend OK.


## Phase 80: Resumen IA del grupo · Traducir con un toque · Velocidad de notas de voz · Encuestas (2026-06)
- **Resumen "Lo que te perdiste"** (`routers/chat_ai.py`): `POST /chats/{id}/summary?count=N` (últimos N mensajes de otros, gpt-4o-mini vía Emergent key, viñetas en español; <3 → `reason:few`). UI `GroupSummaryCard.jsx` arriba de los mensajes cuando `unread_count ≥ 5` al abrir (sessionStorage evita repetir), soporta **negritas**.
- **Traducir**: `POST /ai/translate {text,target}` (detecta idioma, caché por hash en `translations`). `components/TranslateButton.jsx` (idioma = `bruno_lang` o navegador) bajo mensajes ajenos y transcripciones en el chat, bajo el contenido de posts (`PostCard`) y comentarios (PostCard + `ReelSheets`); "Ver original" alterna.
- **Velocidad notas de voz**: botón 1x/1.5x/2x en `BrunoAudioWaveform.jsx` (`playbackRate`, persistido `bruno_voice_speed`).
- **Encuestas** (`routers/polls.py`): `POST /chats/{id}/polls` crea `polls` doc + mensaje `message_type=poll` (attachment `{type:poll, poll_id}`), `GET /polls/{id}`, `POST /polls/{id}/vote` (toggle/retirar, única o múltiple), `POST /polls/{id}/close` (creador o admin); WS `poll_update` → evento `bruno:poll`. UI `components/chat/Poll.jsx` (`PollMessage` con barras/%/votantes/cerrar, `CreatePollSheet`), opción "Encuesta" en `ChatAttachmentMenu`.
- Verificado iteration_89: backend 14/15 → bug `count<3` corregido y re-verificado; frontend e2e OK.


## Phase 79: Fijar mensajes · Reenviar · Notas de voz transcritas · Visto por (grupos) (2026-06)
- **Fijar** (`chat_extras.py`): `POST /chats/{id}/pin/{mid}` (admin en grupos, cualquiera en 1:1) guarda `chats.pinned_message` {id, content(preview), sender_name, pinned_by...}; `DELETE /chats/{id}/pin`; WS `message_pinned`. UI `PinnedBanner.jsx` bajo la cabecera (tap → salto+destello, ✕ admin), acciones "Fijar/Desfijar" en el popover (`MessageReactionsBubble` prop `actions`, popover con scroll horizontal).
- **Reenviar**: acción "Reenviar" → `ShareCardToChatSheet` en modo `message` (excluye chat actual), envía content+attachments con `forwarded:true, forwarded_from` (REST `MessageCreate` y WS); etiqueta "Reenviado de X" (`forwarded-label`).
- **Transcripción de notas de voz**: `transcribe_message_audio()` (descarga adjunto → whisper-1 vía Emergent key, mismo patrón que `routers/ai.py`) lanzada en background al enviar audio (REST y WS); guarda `transcript`/`transcript_status`; WS `message_transcript`; `POST .../transcribe` bajo demanda. UI: texto bajo la onda (`audio-transcript`), "Transcribiendo…", botón "Ver texto"/reintentar.
- **Visto por**: `GET /chats/{id}/messages/{mid}/read-by` → seen/pending; UI: doble check propio en grupos abre `ReadBySheet.jsx` ("Visto por x/n", Leído/Entregado). FIX WS `mark_read` usaba `is_read:false` (en grupos solo el primero quedaba en `read_by`) → ahora `read_by $nin`; WS `messages_read` actualiza `read_by` en cliente.
- Verificado iteration_88: backend 12/12 + regresión 47/47; frontend móvil OK. Nota menor: el toast puede tapar el ✕ del banner unos segundos.


## Phase 78: Reacciones rápidas · Buscar en el chat · Borradores por chat (2026-06)
- **Reacciones** (`routers/chat_extras.py`): `POST /chats/{id}/messages/{mid}/react?emoji=` toggle (mismo emoji quita, otro reemplaza; una por usuario) + WS `message_reaction`; `GET .../reactions` agrupado por emoji con nombres/is_me. UI: doble toque/doble clic en la burbuja = ❤️ con destello (`heart-burst`), fila de reacciones (`reactions-row`, la mía resaltada) → `ReactorsSheet.jsx` (Todas / por emoji, "Tú · Quitar reacción"). Handler `handleReactMessage` optimista + verdad del servidor; WS actualiza en vivo.
- **Buscar en la conversación**: `GET /chats/{id}/messages/search?q=` (regex case-insensitive, snippet, sender, `offset` = mensajes más nuevos). UI `ChatSearchBar.jsx` (lupa en cabecera `chat-search-toggle`, input `chat-msg-search-input`, contador x/total, flechas, lista con resaltado). `jumpToSearchResult` carga historial (`limit=offset+40`) si hace falta y destella `#bubble-{id}` (también mensajes de sistema y llamadas).
- **Borradores por chat**: `localStorage bruno_draft_{chatId}` (debounce 250ms, evento `bruno:draft`), restauración al cambiar de chat (`draftChatRef` evita cruzar borradores), se limpia al enviar; `ChatList` muestra "Borrador: …" (`chat-draft-preview`).
- Verificado iteration_87: backend 10/10 + regresiones 37/37; frontend móvil OK (incl. actualización WS en vivo desde otro usuario).


## Phase 77: Respuestas en grupo · @mención→perfil · Aviso sin conexión + outbox · Guardar tarjeta desde chat (2026-06)
- **Respuestas**: toque largo / clic derecho → "Responder" (ya existía); ahora la cita muestra el nombre real del remitente en grupos (`message.sender`), cada burbuja tiene `id=bubble-{id}` y tocar la cita (`reply-quote-*`) hace scroll y destello (`.bubble-flash`). WS conserva `reply_to`.
- **@Menciones → perfil**: `mentionTarget()` resuelve el handle contra `message.mentions` + miembros del grupo (o participante 1:1) → `Link /profile/{userId}` (`mention-link-{id}`); sin coincidencia se muestra como texto.
- **Sin conexión**: `hooks/useChatOutbox.js` (cola persistida en `localStorage bruno_outbox_{chatId}`, burbuja optimista con reloj `msg-pending-icon`, flush al evento `online` con guard de in-flight → sin duplicados) + `components/chat/OfflineBanner.jsx` ("Sin conexión · N en espera" / "Enviando…" / "Reconectando…" con gracia 2.5s). `handleSend`: offline → cola; REST sin respuesta de red → cola.
- **Guardar tarjeta desde chat**: `POST /api/cards/{card_id}/save?via=chat` (no dueño, upsert en `received_cards`, notifica al dueño). Botón "Guardar en mi BRUNO" bajo cada tarjeta compartida (oculto si es mensaje propio o la tarjeta es mía — `GET /cards` cacheado) → "Guardada en tu BRUNO".
- Verificado iteration_86 (backend 37/37 incl. regresión; frontend móvil) + correcciones post-test (duplicado del outbox, botón guardar al dueño) re-verificadas con screenshot.


## Phase 76: FIX teclado móvil · @menciones en grupos · Recordatorio de tarjeta · Reenviar tarjeta recibida · Plugin NFC HCE (2026-06)
- **FIX teclado (parpadeo en móvil)**: causa = bucle visualViewport → setState en cada evento + scroll de página en iOS → NavScroll minimizaba/expandía el pill → saltos de layout. Solución: `hooks/useVisualViewportHeight.js` reescrito (solo CSS vars `--app-vh/--app-kb/--app-vv-top`, rAF, `html[data-keyboard=open|closed]`, evento `bruno:viewport`, detección por foco para Chrome Android) montado globalmente en `App.js` (`KeyboardViewportManager`). `ChatPage` es un panel `position:fixed` con `top: --app-vv-top` y `height: --app-vh`, bloquea el scroll del documento (`html.chat-open`), mensajes se anclan abajo al abrir/cerrar teclado (sin `scrollIntoView`). Nav pill y burbujas IA/Chat se ocultan con teclado abierto (`.kb-hide`); `NavScrollContext` ignora scroll con teclado. `index.html`: `interactive-widget=resizes-content, maximum-scale=1`. CSS: inputs ≥16px en táctil (evita auto-zoom iOS). Placeholder del pill "Mensaje...".
- **@Menciones en grupos**: `MessageCreate.mentions[]` (ids) en REST y WS (`server.py` send_message ahora también guarda `mentions`/`reply_to`). `utils/chat_notify.py notify_chat_message()` compartido REST+WS: silenciados se saltan **salvo mencionados** (tipo `mention`, "X te mencionó en {grupo}"; push). UI `components/chat/MentionPicker.jsx`: al escribir `@` en un grupo lista miembros, inserta `@Handle`, ids enviados en `mentions`; resaltado unicode en burbujas.
- **Recordatorio de tarjeta** `components/CardReminderBanner.jsx` (global): usuario con tour completado, <14 días de antigüedad y 0 tarjetas → banner superior "¿Creamos tu primera tarjeta?" en /reels, /my-profile, /map; CTA a /cards/new; "más tarde" = snooze 24h (`bruno_card_reminder_{uid}`).
- **Reenviar tarjeta recibida**: `components/chat/ShareCardToChatSheet.jsx` (multi-selección de chats/grupos, envía `message_type=card`) desde `/wallet` (botón `received-share-*`).
- **Plugin NFC HCE Android** en `frontend/native-android/nfc-hce/` (`BrunoNfcHcePlugin.java`, `NdefHostApduService.java` = Type 4 Tag NDEF URI, `apdu_service.xml`, snippet manifest, README) + sección 13 en `NATIVE_BUILD_GUIDE.md`. `native/nfcShare.js` usa `registerPlugin("BrunoNfcHce")` con no-op web; `CardTransferPage` muestra "Emitiendo por NFC" cuando el plugin está activo. Requiere que el usuario lo copie en su proyecto Android (no hay carpeta android/ en el repo).
- Verificado: regresión backend 31/31 (iteration85), curl menciones (silenciado no recibe mensaje normal, sí la mención), screenshots móviles: panel de chat con teclado simulado (390x500) ancla mensajes y oculta burbujas; picker de menciones; hoja de reenvío; envío OK.


## Phase 75: Grupos · Silenciar temporal · Historial de llamadas · Tour de tarjeta · Transferencia NFC (2026-06)
- **Grupos** (`routers/chat_groups.py`): `POST /chats/group` {name, participant_ids, avatar_url} → chat `is_group/type=group/admin_id`; `GET /chats/{id}/info` (members + is_admin); `PUT /chats/{id}/group` (admin: nombre/foto); `POST /chats/{id}/members`; `DELETE /chats/{id}/members/{uid}` (admin quita / uno mismo sale; último en salir borra chat+mensajes). Mensajes `message_type=system` ("X creó el grupo", "añadió a", "salió"). `get_chats` ahora carga participantes en batch y devuelve `is_group, name, avatar_url, members_count, is_muted, muted_until`. Llamadas grupales: `/calls/start` sobre el chat grupal (Daily max_participants 50), WS `incoming_call` incluye `is_group/chat_name`.
  Frontend: `components/chat/NewGroupModal.jsx` (multi-select + nombre + foto, 2 pasos), `GroupInfoSheet.jsx` (miembros, corona admin, añadir, renombrar/foto, quitar, salir, botones Llamada/Videollamada), `ChatList` menú + → "Nuevo chat / Nuevo grupo", avatar de grupo, nombre del remitente en burbujas ajenas.
- **Silenciar temporal** (`utils/chat_mute.py`): `POST /chats/{id}/mute` {duration: 1h|8h|1w|forever|unmute} guarda `muted_by[]` + `mute_until{uid: iso}`; `active_mutes()` ignora los expirados (usado en get_chats, send_message y calls/start). UI `MuteMenu.jsx`: popover 1 hora / 8 horas / 1 semana / Siempre / Activar sonido; cabecera "Silenciado hasta las HH:MM"; se reactiva solo (timer en cliente + expiración en servidor).
- **Historial de llamadas** (`video_calls.py`): `GET /calls/history?filter=all|missed&q=` (direction, missed, duration, peer/grupo, caller), `DELETE /calls/history[?call_id]` (oculta para ese usuario). UI `CallsHistory.jsx` en pestaña **Llamadas** de la pantalla de chats (tabs Chats/Llamadas), chips Todas/Perdidas, buscador por contacto, volver a llamar (`/chat/:id?call=audio|video`), borrar.
- **FIX**: botón atrás del chat no volvía a la lista (React Router aplica la navegación en transición → el efecto de sync re-seleccionaba el chat). Guard con `syncedChatIdRef`. Cabecera del chat ya no desborda en 390px (`min-w-0`). Placeholder del pill "Mensaje...".
- **Tour animado (solo una vez, usuarios creados <24h)**: `WelcomeTour.jsx` reescrito: Bienvenida → 1 Completa tu perfil (/edit-profile) → 2 Crea tu tarjeta (/cards/new) → 3 Dale tu estilo → 4 Compártela con un toque (NFC Android↔iPhone/QR) → Listo (acciones). Escenas framer-motion en `components/tour/TourScenes.jsx`. Cualquier cierre marca el tour como visto (`bruno_tour_completed_{uid}`).
- **Transferencia de tarjeta por contacto** (`routers/card_transfer.py`): `POST /cards/{id}/transfer-token` (token 15 min + QR), `GET /transfer/{token}` (público; el dueño ve `receivers[]`), `POST /transfer/{token}/accept` (guarda en `received_cards`, notifica `card_received` al dueño), `GET /transfer/received/mine`, `DELETE /transfer/received/{card_id}`. Frontend: `/cards/:id/transfer` (`CardTransferPage`: escena de dos teléfonos, Web NFC write en Chrome Android, HCE nativo si existe plugin `BrunoNfcHce`, AirDrop/Compartir en iPhone, QR + enlace, polling de "guardada por"), `/t/:token` (`TransferReceivePage`: guardar en mi BRUNO con login `?next=`, vCard "Añadir a contactos" sin cuenta, ver tarjeta), `/wallet` (`ReceivedCardsPage`). Botones en ViewCardPage (dueño) y "Recibidas" en MyProfilePage. `native/nfcShare.js` abstrae capacidades.
  **Límite honesto**: iPhone no puede emular NFC (restricción de Apple); iPhone→otro usa AirDrop/QR; Android→iPhone por NFC requiere la app nativa con HCE (o tag PIUP). El QR/enlace funciona en todos los casos.
- **Mapa**: usuario eligió activar facturación de Google Maps (pasos entregados); Google sigue como mapa principal con fallback OSM automático.
- Verificado iteration_85: backend 31/31, frontend ~90% + self-test de tour (6 pasos) y flujo receptor (/t → login → guardar → /wallet).


## Phase 74: Voz en BRUNO IA · IA que ve fotos · Sala de espera Live · Página de sonido (2026-06)
- **Voz** (`routers/ai.py`): `POST /api/ai/transcribe` (multipart audio → `OpenAISpeechToText` whisper-1, idioma es) y `POST /api/ai/speak` ({text, voice=nova, speed} → `OpenAITextToSpeech` tts-1, devuelve MP3; limpia tags [ACTION]/[CARD]/[PUBLISH]). Frontend `FloatingBubbles`: botón micrófono (MediaRecorder → transcribe → auto-envía), toggle de voz en cabecera (persistido `bruno-ai-voice`; lee en voz la respuesta al terminar el streaming) y "Escuchar" por mensaje.
- **Visión**: `_image_content_from_attachment()` convierte la imagen adjunta (URL hospedada o data URL) en `ImageContent` para que ChatGPT la vea de verdad (chat y stream). `VISION_HINT` pide descripción + caption/hashtags y una línea final `[PUBLISH:<caption>]`; el frontend la convierte en botón "Publicar esta foto con el caption" → `POST /posts` con la imagen adjunta → `/post/:id`. Chips rápidos al adjuntar imagen: "Convertir en publicación" / "Describir imagen".
- **Sala de espera Live** (`components/live/LiveWaitingRoom.jsx`): portada difuminada del anfitrión, anillo de cuenta regresiva 10→0, título, estado (conectando / anfitrión preparando / esperando), contador de espectadores, badges privado/protegido. Se muestra en `LiveViewerPage` hasta que llega el `remoteStream`.
- **Página de sonido** `/sound/:postId` (`pages/SoundPage.jsx`): cabecera con disco, nombre, autor, usos; "Usar este sonido"; compartir (Web Share / copiar link); ranking por `views_count` con medallas #1/#2/#3 y badge "Original". Enlace "Ver página" en `ReelSoundSheet`.
- Verificado: TTS 200 (34 KB mp3) → STT transcribe correctamente; visión describe imagen real y emite [PUBLISH]; UI: mic/voz/chips/botón publicar; sala de espera con countdown; página de sonido con 3 en ranking.


## Phase 73: Integración ChatGPT (modelos seleccionables + streaming) (2026-06)
- `emergentintegrations` actualizado a 0.2.0 (necesario para `TextDelta/StreamDone`); `requirements.txt` regenerado.
- Backend `routers/ai.py`: catálogo `CHATGPT_MODELS` (gpt-5.4 recomendado/default, gpt-5.4-mini, gpt-5.5, gpt-4o) en `GET /api/ai/models`; `AIMessageInput.model`; `_get_chat()` reutiliza la sesión LlmChat y la reconstruye al cambiar de modelo; respuesta incluye `model`; conversaciones guardan `model`. **Nuevo `POST /api/ai/chat/stream`** (SSE, `X-Accel-Buffering: no`) con eventos `meta` (session_id, model, cards_context) · `delta` · `done` · `error`. Default subido de gpt-5.2 → gpt-5.4. Usa EMERGENT_LLM_KEY (universal).
- Frontend `FloatingBubbles.jsx` (BRUNO IA): selector de modelo bajo el título (persistido en localStorage `bruno-ai-model`), respuestas por streaming token a token con `fetch` + ReadableStream (mensaje del asistente se va rellenando), tags [CARD:] conservadas. `BrunoMascot` sigue usando el endpoint no-streaming (default gpt-5.4).
- `.gitignore` creado (advertencia del deployment check).
- Verificado: /ai/models, /ai/chat con model, /ai/chat/stream (meta+7 delta+done), UI selector de 4 modelos y respuesta en streaming con ChatGPT 5.4 Mini.


## Phase 72: FIX publicar foto/video no guardaba nada (2026-06)
- **Causa raíz** (`MobileBottomNav.jsx` → `BrunoPublishMenu.onPick`): "Crear → Publicación" con archivo navegaba a `/feed?compose=1` y **descartaba el archivo** (FeedPage ni siquiera leía `compose`); "Crear → Reel" desde galería navegaba a `/reels?upload=1` **sin subir nada**; "Crear → Reel" con cámara lo publicaba como **Story de 24 h** en vez de reel. Por eso "seguía el proceso" pero no quedaba en feed/reels/perfil.
- **Fix**: nuevo `publishPost(file, meta)` en `MobileBottomNav`: sube (`/upload/image` o `/upload/chat-file`), crea el post (`media` con mp4/poster, `post_type`, `audio` si venía música) con toast de progreso → "Reel publicado / Publicación creada" → navega a `/reels?id=` o `/post/:id`. Reel = post permanente; Story sigue siendo 24 h solo desde "Historia". "Publicación" sin archivo → `/feed?compose=1` abre la pestaña Feed, hace scroll al composer (`#feed-composer`) y lo enfoca.
- `CreatePost` y `BrunoCameraPage` ahora muestran toasts de éxito/error (antes fallaban en silencio); foto publicada desde cámara navega a `/post/:id`.
- Verificado con Playwright: Reel desde galería → `/reels?id=<nuevo>`; foto desde composer → aparece en el feed + toast; ambos visibles en perfil (Posts/Reels) y en el feed.


## Phase 71: Notificaciones agrupadas (2026-06)
- `GET /notifications?group=true` (default) apila al estilo Instagram: misma acción + mismo objetivo (o todos los follows / lives) dentro de 48 h → una fila con `ids[]`, `actors[]` (únicos), `count`, `is_read` (todas leídas), `preview_url` y mensaje combinado ("A Ana y 12 personas más les gustó tu reel", "X y Y comenzaron a seguirte"). `_group_notifications` + `_group_message` en `posts_feed.py`. Nuevo `PUT /notifications/read-many {ids}` (el antiguo `/mark-read/{id}` apuntaba a otra colección y nunca marcaba la lista in-app).
- Frontend `NotificationsPage`: avatares apilados con mini-icono, título "Ana y 3 más", clic marca todo el grupo como leído y navega al `url`; los eventos realtime re-cargan la lista (800 ms) para mantener las pilas coherentes.
- Fix infra: `plugins/visual-edits/babel-metadata-plugin.js` crasheaba en hot-reload (`parentPath` null → "Cannot read properties of null (reading 'traverse')") tumbando la compilación; añadida guarda.
- Verificado con screenshot: 3 pilas, grupo de 4 likes, grupo de 2 follows, marcado como leído funcionando.


## Phase 70: "Usar este sonido" + resaltar comentario + notificaciones al estilo red social (2026-06)
- **Usar este sonido**: disco/etiqueta de audio del reel → `ReelSoundSheet` (`GET /posts/sound/{id}`: sonido original, autor, usos, grid original + reutilizaciones) → botón → `/camera?sound=<postId>`. `BrunoCameraPage` muestra chip del sonido, y al grabar mezcla el audio del reel (Audio element + AudioContext) con el micrófono en la pista del video; publica con `audio:{source_post_id,name,url}` (cadena al sonido ORIGINAL si el fuente ya lo reutilizaba) y `sound_uses` +1. Reels muestran `audio.name`.
- **Resaltar comentario**: `ReelCommentsSheet highlightId` y `PostCard highlightCommentId` hacen scroll + ring/bg al comentario. Deep-links `/reels?id=X&comments=1&comment=<cid>` y `/post/X?comment=<cid>`.
- **Notificaciones (flujo red social)**: helper `_push_notification` (una por actor+tipo+target, se re-marca como no leída si se repite, emite WS). Like: dedupe + **se retira al quitar el like**. Comentario: target = el comentario (para resaltarlo), mensaje con vista previa; **reply** notifica al autor del comentario padre. **remix** notifica al creador original y enlaza al dúo/stitch. **live_started** a todos los seguidores al iniciar un live público (no privados). `enrich_notification` mapea todo a `url` + `preview_url`.
- Verificado iteration_76: backend 8/8, frontend 100 % (excepto grabación real con cámara — cubierto a nivel API; probar en móvil real).


## Phase 69: Perfil muestra TODO + Notificaciones con deep-link (2026-06)
- **Perfil (`MyProfilePage`)**: `GET /users/{id}/posts` ahora usa `is_deleted: {$ne: true}` (los posts nuevos no tenían el campo y se ocultaban), límite 500, y el dueño ve todas las visibilidades (público/seguidores/privado; otros solo público). Frontend normaliza `media[]/attachments[]/legacy` → tiles con poster de video, icono Film/galería y badge de visibilidad. Tab Posts = todo (videos, imágenes, texto); tab Reels = videos (filtro incluye `post_type === "video"`). "Crear reel" → /camera.
- **Notificaciones**: `utils/notification_realtime.enrich_notification()` añade `url`, `preview_url`, `target_label` y `message` humano a cada notificación (GET /notifications y evento WS). Reglas: post con video → `/reels?id=X` (+`&comments=1` si es comentario/mención); post normal → `/post/X` (nueva `PostDetailPage`, abre comentarios con `?comments=1`); user → `/profile/X`; chat → `/chat/X`; live → `/lives/X`. `NotificationsPage` mapea iconos/colores/filtros a los tipos reales (like, comment, follow, repost, remix, moderation_warning), muestra miniatura y navega al `url`. Banner realtime también navega al `url`. `ReelsPage` abre el sheet de comentarios al llegar con `comments=1`.
- Verificado con screenshots: 42 posts visibles en perfil; clic en "comentó tu reel" → reel + comentarios abiertos; clic en "le gustó tu publicación" → detalle del post.


## Phase 68: Dúo & Stitch + Live WebRTC verificado end-to-end + fix WebSockets realtime (2026-06)

**Implementado:**
- **Dúo & Stitch** (`components/reels/RemixStudio.jsx`): composición client-side en canvas (720×1280) → `captureStream` + AudioContext (audio original + micrófono mezclados) → MediaRecorder → upload `/upload/image` → `POST /posts` con `remix{type,source_post_id,source_start,source_end}`. Dúo = pantalla dividida; Stitch = recorte ≤5s del original + tu parte (fase "Original" → "Tu parte"). Botón **Remix** en rail del reel (`reel-remix-btn`) → `ReelRemixSheet` (Dúo / Stitch / "Ver N remixes") → `ReelRemixesSheet` (`GET /posts/{id}/remixes`). Etiqueta "Dúo con @x / Stitch de @x" (`reel-remix-label`). Backend: `Post.remix`, `remix_count` (+1 en el original), validación 400/404.
- **Sheets de Reels portaladas a `document.body`** (las transiciones de página crean stacking context y quedaban bajo el nav).
- **BUG RAÍZ realtime (preexistente)**: los WS `/ws/chat` y `/ws/map` no son enrutables por el ingress (solo `/api`) → bucle de reconexión saturaba el pool de conexiones del navegador y bloqueaba el handshake del WS de lives. Fix: `server.py` expone también `/api/ws/chat/{token}` y `/api/ws/map/{token}`; frontend (`RealtimeNotificationContext`, `CallOrchestrator`, `FloatingChatBubble`, `ChatPage`, `SharedLocationsLayer`, `MapPageLegacy`) usa `/api/ws/...`. **Chat realtime ahora funciona en preview y producción.**
- **Lives**: `LiveViewerPage` espera `isLoading` de auth antes de redirigir a login (carga directa de URL); `LoginPage` respeta `?next=`. Servidor: StrictMode duplicaba el socket del host y el cleanup del socket viejo borraba el vivo → ahora el socket nuevo reemplaza al viejo (close 4000) y el cleanup solo elimina si sigue siendo el registrado; `welcome` incluye `host_online`. Viewer hace `play()` al recibir track.
- **Verificado (iteration 73-75, 2 contextos Chromium con cámara falsa):** host inicia live privado → viewer con código entra → SDP/ICE OK, `srcObject` recibido, contador 1, comentarios y corazones bidireccionales, blackout de privacidad, host cierra → viewer navega a /lives. Remix Dúo y Stitch publicados end-to-end.


## Phase 67: Glass global + Mapa OSM fallback + Reels TikTok-class + Lives WebRTC (privados anti-captura) + Cámara Pro (2026-06)

**Pedido del usuario (español):** (A) efecto translúcido del menú "Crear" aplicado a TODA la app; (B) el mapa falla al conectar con Google; (C) Reels fluidos, modernos, swipe vertical, historial, algoritmo justo + funciones TikTok incluyendo lives; (D) lives PRIVADOS con código que solo comparte el dueño, protegidos contra capturas; (E) filtros profesionales.

**Implementado:**
- **Glass global** (`index.css` sección "BRUNO GLASS"): variables `--glass-*`; selectores aplican `hsl(var(--card)/.58)` + `blur(28px) saturate(180%)` a headers sticky/fixed, `bg-background/xx`, `bg-card/xx`, `.glass-card`, dialogs/sheets/drawer, popover/menus, `.bg-card` sólido (blur suave 18px), pill input. Backdrops → veil frosted. Excluidos: `.reels-stage`, `.live-stage`, video/img/canvas, `.no-glass`. `BrunoPublishMenu` corregido a `hsl(var(--card)/0.6)` (color-mix con HSL era inválido).
- **Mapa**: causa raíz = `BillingNotEnabledMapError` (proyecto Google sin facturación — acción del usuario). `MapPage` detecta fallo (gm_authFailure + hook console.error + timeout 9s sin tiles) y cambia a `OsmFallbackMap.jsx` (react-leaflet, tiles OSM tintados a paleta BRUNO, pins PIUP con popup "Ver tarjeta", recenter, mismo header). Persistido en sessionStorage. Label `map-engine-label` = "Mapa libre + PIUP".
- **Reels** (`pages/ReelsPage.jsx` reescrito + `components/reels/{useReelsFeed.js, ReelItem.jsx, ReelSheets.jsx}`): tabs Siguiendo/Para ti/En vivo; scroll snap con IntersectionObserver; render ventana ±2 (solo cercanos montan `<video>`, preload auto para vecinos); feed infinito con `exclude` + `seed`; gestos tap/doble-tap like/long-press/swipe L→perfil R→back; barra de progreso con seek; like/follow/save optimistas; comentarios, compartir (nativo/copiar/WhatsApp) e historial en bottom-sheets glass; teclado ↑↓/m en desktop.
- **Algoritmo** (`posts_feed.py` `get_recommended_videos`): +boost videos sub-expuestos `1+3/(1+views/20)`, +boost creadores pequeños `1+1/(1+followers/50)`, jitter con seed, sin dos reels consecutivos del mismo autor, `mode=following`, `exclude=`, hydrate con `is_liked/is_bookmarked/is_following`. Nuevo `GET /api/posts/history/videos`.
- **Lives WebRTC** (`routers/lives.py` reescrito): `POST /api/lives` acepta `is_private` + `anti_capture` → genera `access_code` (6 chars); `GET /lives/{id}` oculta el código salvo host y expone `requires_code/is_host`; `join` exige código (403); `by-code/{code}`; `rotate-code` (host); `mine/active`; `heart`. **WS `/api/lives/{id}/ws?token&code`**: welcome/viewer_joined/left/host_online/offline, relay offer/answer/ice, comentarios/regalos/corazones en tiempo real; código incorrecto → `{type:error,code:4003}` + close 4003.
  Frontend: `components/live/useLiveRTC.js` (host: 1 RTCPeerConnection por espectador; viewer: recibe offer), `LiveOverlay.jsx` (chat flotante, corazones, regalos, top bar), `StartLivePage.jsx` (setup → EN VIVO, panel de código copiar/compartir/renovar, flip/mute), `LiveViewerPage.jsx` (gate de código, `/lives/join?code=`, video remoto, tap para sonido).
- **Anti-captura** (`components/live/PrivacyShield.jsx` + `native/privacyScreen.js` + `@capacitor-community/privacy-screen@6.1.0`): nativo Android FLAG_SECURE (bloquea capturas/grabación), iOS oculta al ir a background; web: marca de agua forense móvil con identidad del espectador, blackout al perder foco/visibilidad, PrintScreen/⌘⇧3-5 → blackout + clipboard sobrescrito, sin PiP/descarga/contextmenu/selección. **Límite honesto:** navegadores web no pueden bloquear capturas del SO al 100%; la marca de agua hace trazable cualquier filtración. En app nativa Android sí se bloquea.
- **Cámara Pro** (`BrunoQuickCamera.jsx`): 22 filtros (+Teal&Orange, Golden Hour, Pastel, Cyberpunk, Retro VHS, Frost, Mono Azul, Film 35mm), slider Beauty (suavizado), Timer 3s/10s con cuenta regresiva, cuadrícula, linterna (si el hardware lo soporta). **Filtros/beauty/espejo ahora se hornean en el VIDEO grabado** vía canvas.captureStream (antes solo se veían en preview). Bitrate 6 Mbps.

**Testing (iteration_72):** backend 16/16 PASS (`backend/tests/test_iteration72_reels_lives.py`), frontend todos los flujos críticos PASS en 390x844 y 1920x800. Limitaciones de entorno: Chrome headless no decodifica H.264 (botón Reintentar), Google Maps sin billing (→ OSM siempre). **Pendiente de verificación en dispositivos reales:** flujo WebRTC host→viewer con cámara real (2 dispositivos), bloqueo FLAG_SECURE en build Android.

**Pasos para el usuario (Google Maps):** Google Cloud Console → Facturación → vincular cuenta al proyecto de la key → habilitar "Maps JavaScript API". Hay US$200/mes gratis. Mientras tanto la app usa OSM automáticamente.

**Backlog derivado:** SFU (LiveKit) si un live supera ~15 espectadores simultáneos (mesh P2P actual); TURN server para redes restrictivas; "Usar este sonido" desde reel → cámara; dúo/stitch; velocidad de grabación.


## Phase 66: Nav pill middle position + Publish menu iOS-26 + Camera video fixes (2026-02-23)

**Bugs reportados por el usuario (español):**
1. Header FeedPage interfería con notch del dispositivo (batería, wifi, señal)
2. Cámara: no permite subir videos, accesos incompletos
3. Pill de navegación quedó demasiado alto tras phase 65 — buscar punto medio + más transparente en idle
4. Botón `+` central muy pronunciado (naranja fuerte) → estilo elegante como otros iconos
5. Menú de publicación gordo/naranja → minimalista, translúcido, estilo iOS 26

**Fixes verificados (iteration_66 → 70, todo 100%):**

- **Safe-area global (index.css)** — regla `header.sticky.top-0, header.fixed, .sticky.top-0, .fixed.top-0` recibe `padding-top: max(var(--sticky-header-pt, 0px), env(safe-area-inset-top, 0px))`. Opt-out con `data-no-safe-top`. FeedPage `<header>` con inline reforzado.
- **Cámara video** (BrunoCameraPage): `startRecording` prueba 5 mime types (webm/vp9, vp8, webm, mp4/h264, mp4) — fallback iOS/Safari; `handlePublish` usa la extensión correcta; `useEffect` reinicia stream al cambiar mode; error banner amigable con estados NotAllowed/NotFound/NotReadable; accept filter corregido (`mode !== "photo"` en lugar del bug `mode === "video"` que nunca matcheaba).
- **Pill posición media** (MobileBottomNav): bottom pasó de +12px → +6px minimizado; +20px → +16px expandido.
- **Idle más transparente**: opacity-40 → **opacity-20** + blur-[0.5px] → **blur-[1px]**; puntos naranja también se atenúan (`bg-foreground/30`, sin pulse en idle).
- **Google Maps compat**: `isolation: isolate` en el `<nav>` y el div minimizado — previene stacking-context bleed cuando la nav coexiste con el mapa (z-9999 sostenido).
- **Create button rediseñado**: sin gradient, contorno sutil `border-foreground/25`, icon en `text-foreground/70`, label "Crear" al mismo tamaño que otros items. Ya NO destaca visualmente sobre los demás.
- **BrunoPublishMenu iOS-26**: backdrop-filter `blur(28px) saturate(180%)`, borderRadius 28px, background translucent (`color-mix(in oklab, var(--card) 60%, transparent)`), inset x-3 bottom-3, maxWidth 480px centrado. Tipos en grid 2col compacto sin blobs decorativos, iconos monocromo. z-index 10500 (por encima del nav 9999) para tapability completa.

**Testing agent progression:**
- iter_65: 3/5 → 2 bugs (idle loop + child-minimize sync)
- iter_66: 5/5 fixed
- iter_67: 7/7 (safe-area + camera fixes) — solo warning cosmético sobre absolute.top-0 (fuera del selector, ok)
- iter_68: 100% (header inline explícito)
- iter_69: 6.5/7 (publish menu z-index bug)
- iter_70: **7/7 PASS** — z-index 10500 resuelve todo

## Phase 65: Nav pill + burbujas AI/Chat rediseño touch-first (2026-02-23)

**Bug reportado por el usuario (español):** el pill de navegación se minimizaba solo, dejando las burbujas AI + Chat flotando desalineadas; estaba muy pegado al borde inferior del móvil (interferencia con el gesture home del OS); no ofrecía descanso visual (no se opacaba en idle); el flujo touch se sentía anticuado.

**Fixes aplicados (5 archivos):**
- `contexts/NavScrollContext.jsx` — nuevo estado compartido `idle` + `bumpIdle()` con timer de 2.5s. Callback estable (dep=[], usa setIdle(false) sin leer state para evitar loop). Threshold touch bajado 35→22px. **Eliminado listener `bruno:child-minimized`** para que minimizar AI o chat individual NO fuerce al pill a minimizarse (coordinación one-way: pill→hijos).
- `components/MobileBottomNav.jsx` — pill minimizado subido a `bottom: env(safe-area) + 12px`; expanded a `+ 20px`; hitbox invisible 10x20px de padding; idle-fade con `opacity-40 + blur-[0.5px]`; `WebkitTapHighlightColor: transparent`.
- `components/FloatingBubbles.jsx` — AI bubble reposicionada a `right: calc(50% + 76px)` y `bottom: env(safe-area) + 8px` (mismo nivel visual que el pill); active:scale-90 en tap; idle-fade coordinado.
- `components/FloatingChatBubble.jsx` — Chat bubble simétrica: `left: calc(50% + 76px)`; idle-fade coordinado.

**Resultado visual** (viewport 390x844, iPhone 12/13/14):
```
                    ─── ─── ───    ← todos en y=808 (a 8px del borde)
       (·)    ‖═══════════‖    (·)
      AI 28   nav-pill 128    Chat 28
   right +76px  centered    left +76px
        gap 12          gap 12
```

**Verificado por testing_agent (iteration_66):**
- **5/5 fixes PASS** + regresión 100%
- Idle-fade: opacity-40 sostenida 10 muestras × 500ms (sin loop)
- Minimización individual AI/Chat NO afecta el pill
- Regresión completa de navegación (5 tabs), chat individual, BRUNO IA

**Iteración previa (65):** 3/5 → identificó 2 bugs corregidos en iter_66.

## Phase 64: Conversión a app NATIVA (Capacitor 7 + FCM/APNs) (2026-02-23)

**Alcance:** convertir la web app en aplicación nativa iOS + Android para
publicar en App Store y Google Play, manteniendo un único codebase.

**Frontend — Capacitor 7 integrado:**
- Instalados: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- 11 plugins nativos: camera, geolocation, push-notifications, share,
  splash-screen, status-bar, haptics, app, filesystem, preferences, network
- `capacitor.config.ts` con bundle id `com.brunocard.app`, splash naranja BRUNO
- Nueva carpeta `/app/frontend/src/native/`:
  - `capacitor.js` — detección de plataforma (isNative/isIOS/isAndroid)
  - `useNativePush.js` — solicita permiso, registra FCM/APNs, POSTea el token a `/api/mobile/devices/register`, escucha `pushNotificationReceived` + `pushNotificationActionPerformed`
  - `nativeApis.js` — takePhoto/getCurrentLocation/shareContent/triggerHaptic con fallback web-safe
  - `NativeBootstrap.jsx` — montado en App.js, integra push + status-bar + splash-hide

**Backend — envío nativo (FCM + APNs via Firebase):**
- Nuevo `/app/backend/utils/native_push.py` (~130 líneas):
  - Inicialización lazy de firebase-admin con cache tri-estado
  - Lee `FIREBASE_SERVICE_ACCOUNT_JSON` (path o JSON inline)
  - **Fallback graceful:** si no está configurada, log warning y no crashea
  - Envía `messaging.Message` con `AndroidNotification` + `APNSPayload`
  - Prune automático de tokens UNREGISTERED / INVALID_ARGUMENT
- `routers/push_notifications.py` — `send_push_notification()` ahora llama `send_native_push()` tras web push
- Añadido `firebase-admin==6.5.0` a requirements.txt

**Documentación:**
- `/app/NATIVE_BUILD_GUIDE.md` — guía exhaustiva de 12 secciones:
  1. Estado actual del código  2. Crear cuentas ($99 Apple + $25 Google)
  3. Descargar código  4. Setup Mac/Xcode/Android Studio
  5. `cap add ios/android`  6. Iconos + splash automáticos
  7. Firebase Cloud Messaging setup (google-services.json, GoogleService-Info.plist, service account backend)
  8. APNs (.p8 key + Firebase upload)
  9. Compilar iOS/Android en dispositivo real
  10. Publicar en App Store  11. Publicar en Google Play  12. Troubleshooting

**Bug fix colateral:**
- `LocationMessagePreview.jsx` — eliminado `eslint-disable jsx-a11y/img-redundant-alt` inválido y cambiado alt="map preview" → "Ubicación en el mapa" (era bloqueador de compilación tras `yarn add`)

**Verificado (iteration_63):**
- **100% (30/30 nuevos + 53 regresión)**
- `/api/mobile/devices/register`: 200 con token/platform correctos, valida `platform in {ios,android,expo,huawei}` (400 en inválido)
- `/api/mobile/devices` list: token redactado, ordenado por last_used_at
- `/api/push/test`: 200 SIN Firebase configurado (fallback graceful confirmado)
- Regresión de cards, user_data, calls, feed, stories, i18n, piup, plans: intacta

**Estado tras Phase 64:**
- Frontend: web app + native scaffolding listo, requiere `yarn cap:add:ios` + `yarn cap:add:android` en Mac del usuario
- Backend: envía a web push + native FCM/APNs desde el mismo endpoint
- User necesita: Apple Developer ($99), Google Play ($25), Firebase project (gratis), Xcode + Android Studio en su Mac. Guía lo lleva paso a paso.

## Phase 63: Cards + user-data + subscriptions extraction (2026-02-18)

**P2 — Backend refactor: three more routers extracted**
- `routers/cards.py` (NEW, ~290 lines): all 9 endpoints of `/api/cards/*` + `/api/public/cards` + `/api/cards/{id}/qr` (branded QR generation via PIL). Uses `utils.database`, `utils.security`, `models.user`. Models `Card/CardCreate/CardUpdate/SocialLink/ContactInfo/ReorderRequest` self-contained.
- `routers/user_data.py` (NEW, ~275 lines): `/api/user/saved-data` GET+PUT, `/api/user/addresses` POST+DELETE, `/api/user/social-links` POST, `/api/plans` GET, `/api/user/subscription` GET, `/api/subscribe/{plan_id}` POST (Stripe subscription checkout). Includes `seed_subscription_plans()` helper.
- Also removed `seed_subscription_plans()` dead-code block from `server.py` (moved to router).

**server.py progression (this session):**
- Phase 62: 3201 → 3033 (-168, video_calls extracted)
- Phase 63: 3033 → 2552 (-481, cards + user_data + subscriptions + dead-code cleanup)
- Total this session: **-649 lines (-20%)**

**Regression verified via curl:**
```
auth/me: 200          profile: 200          cards: 200
public/cards: 200     cards/explore: 200    feed/for-you: 200
recommended-videos: 200  stories/located: 200  notifications: 200
chats: 200            i18n/countries: 200   piup/catalog: 200
plans: 200            user/saved-data: 200  user/subscription: 200
subscribe/free: 400 (expected — free plan rejected)
calls/start: 404 (expected — bad chat_id)
POST user/addresses: 200 with new address returned
GET/POST/PUT/DELETE cards: all working incl. QR generation
```

## Phase 62: Video calls extraction + Regression (2026-02-18)

**Backend refactor: video calls extracted**
- New `/app/backend/routers/video_calls.py` — clean module using `utils.ws_manager`, `utils.database`, `utils.security`. Jitsi Meet URLs (https://meet.jit.si/{room}) with `prejoinPageEnabled=false` + `startWithVideoMuted` per call_type. Push notifications fan-out to offline participants. Try/except guards around WS + push so transient failures never break the request.
- `server.py` reduced 3201 → 3033 lines (-168, ~5%). Old inline endpoints removed.

**Verified (iteration_60)**
- 16/17 backend tests PASS (94%); only SKIPPED test is upload-video happy path (Cloudinary rejects synthetic mp4 in test env — code review confirmed contract is correct).
- `/api/calls/start|answer|decline|end` all transition status + emit WS events correctly.
- `/api/posts/recommended-videos` algorithmic ranking works for auth + anon.
- `/api/location/share` chat-message side-effect: `is_deleted: False` present so message renders in chat threads.
- Auth, cards, stories, AI regression: all green.

**Known non-blocking limitations**
- Headless Chrome in Playwright doesn't decode H.264 (`canPlayType` returns empty), so Reels show "No se pudo cargar este video" in automated screenshots. Real iOS/Android/Desktop browsers DO support H.264 — works for end users.
- Map `BillingNotEnabledMapError` is environmental (production API key billing).

## Remaining Backlog (post-63)
- `server.py` 2552 → target ~1800: still inline = auth (~120 lines: register/login/me/refresh/logout/google), payments/Stripe checkout (~110 lines), profile GET+PUT + change-password (~65 lines), albums-legacy (~90 lines), orders+store-legacy (~200 lines), seed_store_products (~330 lines big function). Next candidates: auth (safer via `integration_playbook_expert_v2`), store products/orders (isolated).
- Frontend: `MyProfilePage.jsx` (1041 lines) + `FeedPage.jsx` (883 lines) breakdown.
- End-to-end manual verification of WebRTC video calls on real mobile devices.
- PWA install prompt polish on obscure Android browsers.

---

# Original PRD (pre-Phase 62)

## Original Problem Statement
Build a comprehensive social networking platform called "BRUNO" with digital business cards, social feeds, stories, marketplace, and advanced social features.

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI + Framer Motion
- **Backend:** FastAPI + MongoDB (modular routers)
- **Auth:** JWT + Google OAuth (Emergent-managed) + AES-GCM encrypted token storage
- **Storage:** Cloudinary, **AI:** OpenAI GPT-5.2 (Emergent LLM Key)
- **Maps:** Leaflet, **Payments:** Stripe, **External Sales:** DEAL (Hybrid API/Webhook)

## Implemented Features

### Core Social Features (Phase 17-35)
- Posts, Feed, Stories, Reels, Live Streams, Chat, Maps
- Card Analytics, Stripe Payments, NFC Integration
- Floating Nav, AI Chat, Satellite Bubble System
- Persistent Sessions (30-day web, 365-day mobile)
- Story Editor, Universal Minimization, PiP, View Modes
- Premium Templates, Multi-Locations, Drag-to-Reorder


### Phase 48: Profile/Settings Repair + Chat Camera Fix (2026-05-17)

**Settings menu — items reparados** (todos navegaban a home antes):
- `/edit-profile` → nuevo `EditProfilePage.jsx`
- `/change-password` → nuevo `ChangePasswordPage.jsx`
- `/settings/blocked` → nuevo `BlockedUsersPage.jsx`
- Ruta `/settings` añadida (faltaba en App.js — por eso todo redirigía)

**`EditProfilePage`** — editor completo:
- 6 campos editables: nombre, bio, ubicación, profesión, empresa, sitio web (con maxLength)
- Avatar con botón cámara naranja flotante → bottom-sheet menu con 4 opciones:
  1. Ver foto de perfil (modal full-screen con backdrop)
  2. Ver historia (navega a /my-profile?tab=stories)
  3. Cambiar con cámara Bruno (abre BrunoQuickCamera modo foto)
  4. Elegir de la galería (file picker tradicional)
- Upload via `/api/upload/image`, persiste en `/api/profile` PUT
- Loading + spinner durante upload, toast Bruno success/error

**`ChangePasswordPage`** — flujo completo:
- 3 campos con eye-toggle (current/new/confirm)
- Validación: min 8 chars, requiere mayúscula o número, confirm debe coincidir
- Strength meter de 4 niveles (rojo→ámbar→amarillo→verde→verde fuerte)
- Backend nuevo endpoint POST `/api/auth/change-password` con verificación de current_password vía bcrypt

**`BlockedUsersPage`** — listado y unblock:
- GET `/api/users/me/blocked` (endpoint ya existía)
- POST `/api/users/{id}/block` (toggle)
- Empty state limpio + toast feedback al desbloquear

**Chat camera fix**:
- `ChatAttachmentMenu` ya no usa `<input type="file" capture="environment">` para Camera/Video
- Ahora invoca `useBrunoCamera().open({ mode, onCapture })` → la misma cámara pro global
- File picker reservado sólo para Galería y Documento

🧪 **Verificación end-to-end:**
- Settings renderiza con los 3 items ✓
- Editar perfil carga datos del usuario y muestra menú de 4 opciones al tocar cámara ✓
- Change password page navega correctamente ✓
- Blocked users empty state visible ✓
- Attach Camera del chat abre BRUNO Camera HD (no file picker) ✓



### Phase 47: Audio Waveform + Typing Dots (2026-05-17)
**BrunoAudioWaveform** (`/components/bruno/BrunoAudioWaveform.jsx`) — WhatsApp-style voice notes:
- 32 barras con alturas deterministas (hash del URL → siempre igual para el mismo audio)
- Color naranja Bruno en propias, blanco en burbujas ajenas
- Barra actual pulsa verticalmente (`scaleY` 1→1.6→1 loop) durante reproducción
- Tap en cualquier barra → seek a esa posición
- Timer dinámico: muestra tiempo total cuando pausado, restante cuando reproduciendo
- Reemplaza al viejo `AudioPlayer` del ChatPage

**TypingDots** (`/components/bruno/TypingDots.jsx`):
- 3 puntos con `y: [0,-3,0]` + `opacity: [0.4,1,0.4]` con delays escalonados (0/180/360ms)
- Reemplaza al texto plano `escribiendo<animate-pulse>...` en la cabecera del chat
- Acepta `label` prop ("escribiendo", o el nombre del usuario)

🧪 Verificado visualmente: waveform Bruno renderiza con barras blancas en burbuja propia (color naranja), play/pause funcional.



### Phase 46: Camera Unification + Circular Video Notes (2026-05-17)

**Camera unified across the app** via `BrunoCameraProvider` (`/contexts/BrunoCameraContext.jsx`):
- Single global BrunoQuickCamera instance mounted at app root
- `useBrunoCamera().open({ onCapture, mode })` from anywhere → opens the same pro camera
- Nav `+` button replaced: now opens BrunoQuickCamera with auto-publish-to-story `onCapture`
- Removed duplicate `QuickStoryFAB`
- Removed `/camera` page nav (still accessible via route)

**BrunoQuickCamera Pro upgrades:**
- 4K → QHD → FHD → HD resolution fallback chain via `getUserMedia` constraints
- Native aspect-ratio container (reads `video.videoWidth/Height`)
- Pinch/slider zoom using `track.applyConstraints({ advanced: [{ zoom }] })` when supported
- Music module (`MusicPicker.jsx`): 8 royalty-free tracks, 9 categories, search, volume slider, trim start/end, applied to recording (played alongside video)
- Resolution badge in header

**Pill input reorg:**
- Camera button moved OUT of pill, sits next to mic (Instagram-style)
- Hides when typing (mic→send swap unchanged)

**Circular Video Messages** (`CircularVideoMessage.jsx`) — Telegram-style video notes:
- 180px circle with progress ring (orange Bruno color)
- Auto-play loop muted when scrolled into view (IntersectionObserver, threshold 0.4)
- Tap → unmute first, second tap → play/pause
- Bottom-right corner badge with mute/play state
- Backend accepts `message_type: "video_note"` without schema changes
- ChatPage's camera capture: video → directly sent as video_note with optional music metadata; photo → staged as pendingMedia



### Phase 44: Story Viewer + Chat Reactions + Profile FAB (2026-05-17)

**BrunoStoryViewer** (`/components/bruno/BrunoStoryViewer.jsx`) — Instagram-style:
- Tap left/right para navegar, **press-and-hold para pausar** (220ms threshold), tap-center vacío
- **Swipe-down to dismiss** con drag-Y de framer-motion (opacity + scale transforms)
- **Quick reactions**: 6 emojis (❤️😂😮😢🔥👏) con burst animation que vuela hacia arriba
- **Reply DM** in-line: enviar respuesta como mensaje al chat con el autor (crea chat si no existe)
- Progress bars Instagram-style, mute toggle (video), prev/next desktop, view-count para stories propias
- Reemplazó al `StoryViewer` legacy en `Stories.jsx` (1 línea cambiada)

**MessageReactionsBubble** (`/components/bruno/MessageReactionsBubble.jsx`):
- Wrap de cada burbuja de chat con long-press / right-click → popover de reacciones
- 6 emojis quick-react + botón "Responder" (separado por divider)
- Outside-click dismiss, animación spring
- Display de reacciones agregadas debajo del bubble (`{emoji}{count}`)
- Integrado en ChatPage con `handleReactMessage` (POST `/chats/{id}/messages/{mid}/react?emoji=`) y `handleSetReply` para activar el reply banner del pill input
- `reply_to` se persiste en `messageData` cuando se envía

**QuickStoryButton inline** en MyProfilePage:
- Variante `icon` añadida al lado de "Editar perfil" para impulsar creación desde el perfil



### Phase 43: Quick Story (Capture → Publish 1-tap) (2026-05-17)
**Goal:** Engagement diario tipo Instagram/TikTok — capturar y publicar story en un solo flujo.

**Components added:**
- `QuickStoryButton.jsx` — botón con 3 variantes (floating/inline/icon) que abre BrunoQuickCamera. Tras capturar, monta `CaptionOverlay` con preview + caption (200 chars) + visibility (public/followers/private) + tap único "Publicar Story · 24h".
- `QuickStoryFAB.jsx` — wrapper global que monta el FAB sólo para usuarios autenticados y se oculta en rutas donde estorbaría (login, chat, camera, welcome, public card pages, lives, reels, qr, etc.).
- Integrado en `App.js` como overlay global.

**Pipeline:**
1. Tap FAB → BrunoQuickCamera con filtros TikTok-style
2. Capturar (foto/video) → CaptionOverlay con preview filtrado
3. Tap "Publicar" → POST `/api/upload/image|chat-file` → POST `/api/stories/` con caption + visibility → toast Bruno publish + auto-cierre
4. Story expira en 24h (manejado por backend)

**Tests verificados:**
- FAB visible en /feed, oculto en /chat /welcome
- Camera modal abre desde FAB
- Pipeline backend (upload + create story) probado vía curl → Story creada con `expires_at` +24h ✓



### Phase 42: Pro Camera + Pill Chat Input (2026-05-17)
**Goal:** Modernizar el chat con identidad Bruno y cámara TikTok-style.

**BrunoQuickCamera** (`/components/bruno/BrunoQuickCamera.jsx`):
- Modal full-screen con stream `getUserMedia` + filtros CSS en tiempo real (14 presets: Beauty, Glow, Cálido, Sunset, Vintage, Drama, B&N, Cinema, Neon, Dreamy, Noir, Fade, etc.).
- Foto/Video con switch, shutter blanco animado, recording timer rojo, espejado opcional.
- Captura → preview → enviar (devuelve File al callback `onCapture`).
- Header con logo Bruno + flip cámara delantera/trasera.

**BrunoPillInput** (`/components/bruno/BrunoPillInput.jsx`):
- Input estilo "pill" coherente con la nav Bruno. Glow naranja al focus, glass-blur, auto-resize 1→6 líneas.
- Botón `+` naranja externo para adjuntos, cámara interna que se desliza/oculta al escribir, sticker/emoji, mic↔send que rota con AnimatePresence.
- Banner de respuesta dinámico arriba de la pill (expand/collapse).

**ChatPage integración:**
- Reemplazado el `<form>` legacy por `<BrunoPillInput>` + `<BrunoQuickCamera>` modal.
- Captura desde cámara → sube como adjunto via `handleFileSelect`.
- Toast Bruno tras capturar.

**Tests visuales:** pill renderiza, textarea funcional, botones mic/send swap al escribir, modal cámara abre y cierra, capturas en `/tmp/chat-direct.png`, `/tmp/chat-pill-typing.png`, `/tmp/chat-camera-open.png`.



### Phase 41: Onboarding /welcome + P1/P2 UI System rollout (2026-05-17)
**New page `/welcome`** — 4-step interactive onboarding showcasing the Bruno UI:
- Step 1 Intro: mascot animation + Native-Ready chip
- Step 2 Features: 4 feature chips + 2 ExpandableCards (cards & DEAL)
- Step 3 Interact: 4 demo buttons triggering brunoToast variants (follow/publish/like/loading)
- Step 4 Ready: success state + CTAs to "Create card" or "Explore"
- Skip flow with BrunoModal confirmation
- Persisted via localStorage `bruno_welcome_seen`

**P1: Toast migration** — `ActivateNFCPage` and `NFCManagerPage` now use `brunoToast` (drop-in via `as toast` import alias, no call-site changes).

**P2: Dashboard delete confirm** — replaced native `window.confirm` with `<BrunoModal variant="danger">` including loading state, branded design, and follow-up `brunoToast.success/error` for the result. No more raw `alert()`.

**Toaster mounted** in `App.js` (was missing — toasts didn't render before this phase).



### Phase 39: Mobile-Native API Surface (2026-05-17)
**Goal:** Backend ready for React Native / Flutter consumption.

**Push Notifications (FCM/APNs/Expo)**
- POST /api/mobile/devices/register — store device tokens with platform metadata (idempotent by user+token)
- GET /api/mobile/devices — list active devices (token redacted)
- DELETE /api/mobile/devices/{id} — soft-unregister, flips push flag when no devices remain
- Collection: mobile_devices

**Biometric Auth (FaceID / Fingerprint)**
- Public-key challenge/response on top of JWT. Supports ed25519, ecdsa-p256, rsa-2048.
- POST /api/mobile/biometric/enroll — register device public key (authenticated)
- POST /api/mobile/biometric/challenge — request one-time challenge (public, 120s TTL)
- POST /api/mobile/biometric/verify — sign challenge → returns access + refresh token pair
- POST /api/mobile/auth/refresh — refresh-token rotation (old token revoked)
- POST /api/mobile/auth/logout — revoke refresh token
- GET / DELETE /api/mobile/biometric/credentials — list/revoke
- Collections: biometric_credentials, biometric_challenges, refresh_tokens

**Offline Sync**
- GET /api/mobile/sync/manifest — per-collection last_modified + count
- GET /api/mobile/sync/cards|store|deal-orders — delta sync with `since` + cursor pagination
- GET /api/mobile/sync/profile — user snapshot
- GET /api/mobile/sync/bootstrap — one-shot hydration for first install
- POST /api/mobile/sync/push — apply offline changes (create/update/delete) with last-write-wins
- GET /api/mobile/config — public app config (VAPID key, feature flags, endpoint catalog)

**DEAL Push Notifications Wiring (Phase 38 P0 → completed)**
- Webhook /api/deal/webhook now fires `_notify_partner_commission` and `_notify_buyer_payment`
- Partners get instant push on commission earned; buyers get paid/failed/refunded notifications

**Tests:** /app/backend/tests/test_mobile_native.py — 21/21 passing (push registration, biometric flow with Ed25519 signatures, replay protection, refresh rotation, delta sync, offline push).


### Phase 37: DEAL Integration (2026-05-17)
- Outbound: POST /api/deal/send-order (cliente, producto, precio, partner_id, referral_code, origen: Bruno)
- Inbound: POST /api/deal/webhook (HMAC-SHA256 verified, updates status, registers commission, activates service)
- Frontend: Comprar/Solicitar Servicio buttons, DEAL toggle on product creation

### Phase 38: Partner Dashboard + Full Refactoring (2026-05-17)

**New Feature: DEAL Partner Dashboard**
- Page at /partner-dashboard with summary stats (total earned, orders, volume, conversion rate)
- Monthly revenue chart, top products, recent commissions, recent orders
- Backend: GET /api/deal/partner/dashboard aggregates from deal_orders + deal_commissions

**P1: Enhanced Push Notifications for Mobile**
- NotificationPayload extended: image, actions (max 2), vibrate patterns, renotify, silent, requireInteraction
- Service Worker v6: handles rich notifications with action buttons (reply, dismiss, accept call)
- Context-aware defaults: messages get renotify=true, calls get requireInteraction=true

**P2: server.py Refactoring (5417 → 4311 lines, -20%)**
- Extracted 1215 lines to routers/posts_feed.py (posts, feed, chats, users, notifications, settings)
- Models duplicated in router to avoid circular imports
- All endpoints verified working post-extraction

**P2: CreateCardPage.jsx Breakdown (1666 → 1294 lines, -22%)**
- Extracted CurriculumFields.jsx (226 lines): experience, education, skills, languages, documents, references

**P2: Frontend Security - Encrypted Token Storage**
- Created secureStorage.js: AES-GCM encryption via Web Crypto API
- AuthContext.js rewritten: tokens encrypted before localStorage, auto-migrates old plaintext tokens
- Fallback to in-memory storage if Web Crypto unavailable

**P2: Hook Dependencies Fixed**
- ViewCardPage.jsx: fetchCard wrapped in useCallback
- StorePage.jsx: fetchProducts + fetchUserData wrapped in useCallback
- FeedPage.jsx: verified correct useCallback pattern

**P2: Array Index Keys Fixed (83/86)**
- Fixed across EditCardPage, ViewCardPage, FeedPage, StorePage, HelpPage, PricingPage, NFCManagerPage, SocialLinkSelector, MarketplacePage, and 15+ other files
- Remaining 3 are skeleton loading indicators (acceptable use)

**P2: Backend Complexity Refactored**
- analytics.py: get_card_analytics split into _compute_view_metrics helper
- deal_integration.py: webhook split into _update_order_status, _register_commission, _activate_product
- moderation.py: Fixed mutable default argument
- lives.py: Fixed 4 bare excepts → Exception
- notifications.py: Removed unused variable

**Console Statements Cleaned: 151 → 0**
- All console.log/error/warn/info removed from production code across 46 files

**Testing: 100% pass rate (iterations 52-55)**

## Key API Endpoints
- POST /api/deal/send-order, POST /api/deal/webhook
- GET /api/deal/partner/dashboard, GET /api/deal/orders, GET /api/deal/commissions
- GET /api/posts, GET /api/feed/for-you (now in posts_feed.py)
- GET /api/chats, POST /api/chats/{id}/messages (now in posts_feed.py)
- PUT /api/cards/reorder, POST /api/auth/login, POST /api/auth/refresh

## Environment Variables
```
DEAL_API_URL=         # DEAL API base URL (placeholder)
DEAL_API_KEY=         # API key for DEAL auth (placeholder)
DEAL_WEBHOOK_SECRET=  # HMAC-SHA256 shared secret
```

## Remaining Backlog
- server.py now 3695 lines — further extraction possible: AI/Stripe/cards/auth
- Type hints coverage (20.2% → target 60%)
- ProfileSpecificFields.jsx (>1000 lines) needs breakdown
- FeedPage.jsx (882 lines) needs breakdown

## Phase 49: Tri-Track Refactor & Push Polish (2026-05-18)

**P2 Backend — `server.py` 4334 → 3695 lines (-639, ~14%)**
- Extracted uploads to `routers/uploads.py` (218 lines): /upload/{image,audio,file,chat-file,avatar,banner} + DELETE
- Extracted NFC to `routers/nfc.py` (461 lines): activate, resolve, go (302 redirect), my-cards, update-card, configure-product, lock, resolve-product, product-schemas
- New routers use `utils/database`, `utils/security`, `models/user` (consistent with prior refactors)
- All endpoints verified via curl (200/422/302 as expected)

**P2 Frontend — `EditCardPage.jsx` 1080 → 799 lines (-281, ~26%)**
- Replaced inline curriculum block (290 lines) with existing `<CurriculumFields/>` component
- Added `references` to fallback custom_fields default
- Removed unused lucide-react icon imports (Plus, Trash2, Briefcase, GraduationCap, Award, Languages, FileText)

**P1 Mobile Push Notifications — richer presentations**
- `routers/push_notifications.py` helpers now accept context IDs + avatars for deep-linking:
  - `notify_new_message(chat_id, sender_avatar)` → tag per chat for grouping
  - `notify_new_follower(follower_id, follower_avatar)` → deep-links to follower's profile
  - `notify_new_like(post_id, image_url)` → rich preview when liked content has media
  - `notify_new_comment(post_id, commenter_avatar)` → reply action deep-links to post
  - NEW `notify_story_reaction(story_id, emoji, reactor_avatar)` — story engagement push
  - NEW `notify_incoming_call(call_id, caller_avatar, video)` — requireInteraction + persistent
- Fixed `requireInteraction: True` hard-coded for ALL notifications → now only true for calls
- Service worker bumped to v7 with action handlers for `view_story`, `follower`, `comment_`, and contextual deep-link routing per `data.kind`

## Phase 50: NFC Scan Push Notifications (2026-05-18)

**Feature: "Tu tarjeta cobro vida"** — el dueno recibe una push enriquecida cada vez que alguien escanea su NFC.

- `routers/push_notifications.py` → nuevo helper `notify_nfc_scan(user_id, card_id, card_title, card_image, nfc_id)`:
  - Title: "Tu tarjeta cobro vida"
  - `image`: banner_url o avatar_url de la card → preview rico en movil
  - Action unica: "Ver analitica" → deep-link a `/c/{card_id}/analytics`
  - Tag `nfc_scan_{nfc_id}` → notificaciones se reemplazan en lugar de apilarse
- `routers/nfc.py` → `_fire_nfc_scan_push` con `asyncio.create_task` (fire-and-forget) cableado en `/nfc/go/{id}` y `/nfc/resolve/{id}`
- `public/sw.js` → v8: handler para action `view_analytics` + matcher para tags `nfc_scan_`

## Phase 51: PIUP Manager — Modulo NFC completo (2026-05-18)

**Backend `routers/piup.py` (350 lineas):**
- 19 productos PIUP en catalogo (Hogar 5, Restaurantes 3, Oficinas 10, Mascotas 1)
- Tabla de tamanos C/U/R x 1..7 (1=1x1cm, 2=3x3cm, 3=5x5cm, 4=7x7cm, R5=3x5, R6=4x7, R7=ID 85x55)
- 9 colores; endpoints: catalog, sizes, my-tags, request-physical, orders, activate-by-qr

**Frontend `PiupManagerPage` con 3 tabs (`/piup`):**
- Mis Tags: badge fisico/digital + botones contextuales Solicitar/Renovar
- Activar PIUP: escaner QR con `jsQR` (1280px env-facing camera), parse URL/plain, fallback manual
- Tienda PIUP: filtros categoria + forma + grid de 19 productos + configurador modal con StylePills

**Real-time:** `activate-by-qr` dispara WS event `piup_activated`. QR + NFC ambos resuelven a `/c/{card_id}` (unificado).

## Phase 64: 7-fix Batch — Audio, Video Notes, Mapa, Galería, Llamadas (2026-05-25)

**🐛 Bug 1: Audio notes no reproducían**
- **Causa raíz**: `audio.play()` no awaited; Cloudinary servía `.webm` que Safari/iOS no reproducen
- **Fix**: `AudioPlayer` ahora:
  - Inyecta transformación Cloudinary `f_mp3` para servir MP3 cross-browser
  - Fallback automático al webm original si MP3 falla
  - `await audio.play()` con try/catch
  - Muestra "No se pudo reproducir" si todas las fuentes fallan
  - `data-testid="audio-player"` + `audio-player-play` para testing

**✨ Feature 2: Video Notes circulares (estilo Telegram)**
- Nuevo `VideoNoteRecorder.jsx`: preview circular 260px con anillo de progreso, máx 30s, hold-to-record
- Trigger: **long-press 600ms en el botón cámara del pill input** → abre el grabador
- Renderiza vía componente existente `CircularVideoMessage.jsx` (180px bubble)
- Upload via `/api/upload/chat-file`, mensaje con `message_type="video_note"`

**🐛 Bug 3: Mapa no se movía**
- **Causa raíz**: `<Map>` recibía `center={center}` (controlado) + el `setCenter` por geolocalización snap-back constantemente
- **Fix**: usar SOLO `defaultCenter` + `mapRef` capturado via `MapInstanceCapture` + `map.panTo()` programático para recenter/geolocalización
- Plus: `clickableIcons={false}` para que clicks no se los robe Google POIs nativos

**🎯 Feature 4: Filtro mapa solo items con dirección**
- `MapProfilesBar` ahora aplica `hasLocation(it)` — solo entran items con `lat+lng` válidos (number, no NaN)
- Aplica a users, PIUPs, cards y stories: si no tiene coordenadas, NO aparece en la barra inferior

**🐛 Bug 5: Icono Galería en cámara no funcionaba**
- El `<button>` no tenía `onClick`. Ahora abre `InternalGalleryPicker`
- `data-testid="camera-gallery-btn"`

**✨ Feature 6: Galería interna animada**
- Nuevo `InternalGalleryPicker.jsx`: 
  - Auto-abre el file picker nativo al montarse
  - Después muestra grid animado 3 cols con thumbnails, video detection, badge de orden, botón eliminar
  - "Añadir más" tile siempre visible
  - Multi-select, confirma con botón "Usar selección"
  - Object URLs liberadas al cerrar (no memory leak)
- Integrado en BrunoCameraPage; reemplaza el opener nativo crudo

**✨ Feature 7: Llamadas / Videollamadas funcionales**
- **Antes**: backend usaba `https://bruno-demo.daily.co/{room}` (dominio ficticio → llamadas rotas)
- **Ahora**: `https://meet.jit.si/{room}` — Jitsi Meet público y gratuito con STUN+TURN incluidos
- `VideoCallModal` completamente reescrito:
  - Pantalla "Llamando…" para outgoing (avatar + Loader + cancelar)
  - Pantalla "{name} te está llamando" para incoming (rings pulsantes, accept/decline)
  - In-call: iframe Jitsi con `allow="camera; microphone; ..."` + hangup button
- Funciona sin API keys ni configuración adicional ✅

**Mejoras adicionales del batch**
- `FloatingChatBubble` ahora se oculta cuando el nav está minimizado (chats se minimizan junto con la nav)
- Reels feed ahora detecta video URLs por extensión + `media[]` array (no solo `media_url`)
- PWA install prompt con detección iOS + persistencia de dismissal
- Manifest enhanced con shortcuts (Feed, Mapa, Chats, Perfil), `display_override`, screenshots, lang=es

**Verificado E2E**: chat opens at first click ✅, map renders + draggable ✅, video call btn present ✅, pill-camera-btn supports long-press ✅, audio player has fallback URL ✅

## Phase 63: Chat Bugs + Nav Hairline Bar (2026-05-25)**🐛 Bug 1: Chat no abría al primer click**
- **Causa raíz**: el avatar del chat-item era un `<Link to="/profile/...">` con `stopPropagation`. El click de Playwright/usuario caía sobre el Link (centro del row), navegaba al perfil, y el `onClick` del row nunca disparaba
- **Fix**: avatar y nombre del usuario ahora son `<div>`/`<span>` sin navegación. Cualquier tap en el row abre el chat. La navegación al perfil queda accesible desde el header de `ChatView`
- **Bonus fix**: `fetchChats` ya no depende de `chatId` (eliminada race condition que re-fetcheaba en cada cambio de URL). Un `useEffect` separado sincroniza `selectedChat` desde el URL param

**🐛 Bug 2: Input distorsionaba al abrir teclado**
- **Causa raíz**: `BrunoPillInput` llamaba `scrollIntoView({ block: "end" })` en focus + `motion.div layout` re-layout-animaba al cambiar tamaño. Combinado con la resize del `visualViewport`, el contenido del chat "se expandía y desaparecía"
- **Fix**: removido `scrollIntoView` (el padre ya tiene `height: var(--app-vh)` que ajusta naturalmente). Removido prop `layout` de la pill (solo CSS-anim de boxShadow). Resultado: focus solo activa el ring naranja, sin saltos

**✨ Nav Pill rediseñada como barra hairline**
- Estado minimizado: ahora es una **barra finísima** (`h-[3px]`) flush al borde inferior, con dos puntos naranja pulsantes y handle central. Ocupa solo ~14px de la pantalla (antes 64px)
- Auto-minimize más agresivo: `scrollY > lastY + 8` (antes +30) y solo se expande con upward scroll >48px (antes >20) → el nav desaparece en cuanto el usuario empieza a manipular
- **Gesture global swipe-up-from-bottom-edge**: detecta touchstart en los últimos 24px del viewport + swipe vertical >24px → expande el nav. Funciona desde CUALQUIER parte de la app sin tener que tocar la barra
- Route change a `/` o `/feed` (Inicio) fuerza expand (regla UX del usuario)
- Otras rutas conservan el estado previo del usuario (no se re-expande automáticamente)
- `--nav-reserve` ahora 14px en minimizado (antes 64px), liberando esa franja para el contenido real

**Verificado E2E**: chat abre al primer click ✅ · input no distorsiona en focus ✅ · nav-expand-btn aparece como hairline ✅

## Phase 62: Likes Refinement — Separar "Received" vs "Given" (2026-05-25)**Cambio semántico**: la stat "Likes" en el perfil ahora muestra los likes que el usuario RECIBE en sus publicaciones (no los que el usuario da). Los likes que el usuario ha dado ahora viven como un álbum virtual "Me gusta" en la pestaña Albums.

**Backend**:
- Nuevo endpoint `GET /api/users/me/likes-received` → posts del usuario actual, agrupados por LIKER (quien dio like), con la lista de cuáles posts del usuario likeó esa persona. Excluye self-likes
- Endpoint anterior `GET /api/users/me/liked-posts` se mantiene para alimentar el álbum virtual "Me gusta"

**Frontend**:
- `LikesModal` (header "Te dieron Like"): ahora consume `likes-received`. Empty state: "Aún nadie te ha dado like"
- Nuevo `MyLikedPostsModal` (header "Me gusta"): consume `liked-posts` (igual que antes)
- `MyProfilePage`:
  - Stat "Likes" usa `likesCount` desde `likes-received` (refleja lo recibido)
  - Pestaña Albums ahora siempre muestra una grid; el **primer card** es el álbum auto "Me gusta" (gradiente rosa→naranja→rose con icono Heart, badge AUTO, contador de posts), siempre presente aunque no haya álbumes propios
  - Si no hay álbumes propios, se renderiza un placeholder "+" para crear el primero (al lado del Me gusta)
- Carga paralela de ambos counts (`Promise.all`) en `fetchLikesCount`

**Verificado E2E**:
- Stat Likes muestra 2 (likes recibidos de Andru Mieles) ✅
- Modal "Te dieron Like" agrupa por liker ✅
- Albums tab muestra card "Me gusta" con badge AUTO ✅
- Modal "Me gusta" muestra 2 publicaciones · 2 perfiles (lo que YO he likeado) ✅

## Phase 61: Bug Fix Likes/Comentarios + Pestaña "Likes" en Perfil (2026-05-25)**🐛 Bug Crítico Corregido — Like no funcionaba**
- **Causa raíz**: el hook `useReactionTrigger` solo conectaba `onMouseDown`/`onTouchStart` a la `motion.button`, mientras que `onMouseUp`/`onTouchEnd` solo se montaban globalmente CUANDO el bubble estaba abierto. Resultado: en taps cortos (sin long-press) **nunca se disparaba `onTap`**, los likes no se incrementaban ni la petición se enviaba.
- **Fix**: el botón ahora es un `<button>` nativo con `onClick={handleLike}` directo, y el hook expone `longPressFired.current` que el `onClick` consulta para suprimir el tap cuando se completó el long-press (evita doble-fire). Hook handlers locales `onMouseUp`/`onTouchEnd` ahora también cancelan el timer pendiente.
- **Verificado**: `POST /api/posts/{id}/like` se dispara correctamente. Antes click: count=2 → Después click: count=3 (optimistic update + reconciliación server).
- Comentarios optimistas ahora también actualizan badge `commentsCount` localmente
- Repost optimista actualiza `sharesCount`
- `handleShare` muestra toast "Link copiado" / "Compartido" (antes silent fail en desktop)
- `handleRepost` y errores rollback con toast (antes `alert()`)

**✨ Nueva pestaña "Likes" en perfil (junto a Siguiendo)**
- Nuevo endpoint: `GET /api/users/me/liked-posts` → devuelve `{total_likes, groups: [{user, posts, count}]}` agrupado por autor
- Nueva ruta en `routers/posts_feed.py`, ordenada por timestamp de like más reciente
- Nuevo componente `LikesModal.jsx`:
  - Modal bottom-sheet con header "Tus likes — N publicaciones · M perfiles"
  - Grupos colapsables por autor (avatar con BrunoAvatar, badge naranja con count)
  - Miniatura de cada post (media thumb 56x56, contenido truncado, contadores)
  - Click en post navega a `/post/{id}`
  - Primeros 2 grupos abiertos por defecto
- `MyProfilePage`: cuarta stat `Likes` (count en naranja) entre "Siguiendo" y el divisor → abre `LikesModal`
- Conteo se carga en paralelo con perfil/posts/cards (`fetchLikesCount`)

**Verificado E2E**: login → /feed → click like → count incrementa + API request enviada; perfil → click Likes → modal abre con 1 publicación / 1 perfil

## Phase 60: Code Quality Cleanup (2026-05-25)

**Circular Import Broken** — `server.py` ↔ routers
- NUEVO `utils/ws_manager.py`: extrae `ConnectionManager` + instancia `ws_manager` a su propio módulo
- `server.py`, `routers/stories.py`, `routers/piup.py`, `utils/notification_realtime.py` ahora importan `from utils.ws_manager import ws_manager` (top-level)
- Eliminadas todas las `from server import ws_manager` (lazy imports anti-pattern)

**Lint cleanup — backend**
- F811: eliminados `UserProfile` / `UserProfileUpdate` duplicados al inicio (dead code)
- F821 `ai_chat_sessions` undefined: agregado dict module-level + lazy `from emergentintegrations.llm.chat import LlmChat, UserMessage` dentro del endpoint `/api/ai/chat`
- E722 bare `except`: convertidos a `except Exception` en map_manager broadcast
- `ruff check server.py` ahora pasa limpio (de 11 errores a 0)

**Hardcoded credentials → env vars** (en tests)
- `tests/test_mobile_native.py`, `test_iteration56_features.py`, `test_iteration55_refactoring.py`, `test_code_quality_cleanup.py`: credentials ahora `os.environ.get("TEST_USER_EMAIL", "newtest@bruno.com")` con default

**Frontend cleanup**
- Array index keys reemplazados por composite keys (content+index) en `PostCard.RenderContent`, `ChatPage` mention parser, `BrunoStoryViewer` progress bars
- Empty catch blocks en `secureStorage.js`: ahora loguean `console.warn` con mensaje del error (crypto unavailable o decrypt failed)

**False positives confirmados** (no requirieron cambios):
- `is None` en `utils/security.py` líneas 71/75/91/98/114/118 — es el idiom recomendado por PEP 8 (no anti-pattern)
- Translations `password: "Contraseña"` en `LanguageContext.js` — son labels, no secrets
- Missing hook deps en `ImageEditor`, `ViewCardPage`, `UserProfilePage` — todas las dependencias están listadas correctamente; eslint pasa limpio en los 3 archivos

## Phase 59: 6-point UX Batch — Reactions, Auth, Camera Menu, Map BRUNO Palette, Stripe Webhook, OG Meta-Cards (2026-05-25)

**P0 — Avatares + Camera/Publication Selector**
- `PostCard.jsx`: avatar reemplazado por `<BrunoAvatar>` (anillo de story automático global, glow naranja cuando hay historia activa)
- `FeedPage.jsx`: sección "Personas sugeridas" usa `<BrunoAvatar>` también
- NUEVO `BrunoPublishMenu` (`components/bruno/BrunoPublishMenu.jsx`): bottom-sheet con 2 pasos
  - Step 1: 4 tipos (Historia · Reel · Publicación · Estado) con iconos+gradientes
  - Step 2: 3 fuentes (Cámara Bruno · Galería · Carpeta privada) — solo para Story/Reel
  - Fast-path: Publicación/Estado saltan directo a navegación (no se muestra step 2)
- `MobileBottomNav` reemplaza la cámara directa con el menú: nav `+` → menú → ruteo por tipo+fuente

**P1 — Long-press Reactions + Optimistic UI + Auth**
- NUEVO `ReactionBubble` (`components/bruno/ReactionBubble.jsx`):
  - Hook `useReactionTrigger({ onTap, onReact })` que adjunta handlers a cualquier botón
  - Press 1000ms → bubble flotante fixed-position con 6 emojis (👍❤️😂😮😢😡)
  - Drag/hover sobre emoji → escala 1.5x + label visible
  - Release con emoji activo → fire onReact, sin emoji → dismiss
  - Tap corto (<1s) → fire onTap (like normal)
  - Haptic vibration al aparecer (navigator.vibrate)
- `PostCard.handleLike` ahora es 100% optimistic: flip UI inmediato → server → rollback en error
- `PostCard.handleComment` ahora es 100% optimistic: comentario aparece con tempId antes de respuesta del backend
- `PostCard.handleShare` usa la nueva URL de meta-card (`/api/share/p/{id}`) para previews ricos en WhatsApp/Twitter/Telegram

**Auth UI Updates** (`LoginPage.jsx` + `RegisterPage.jsx`):
- Eye/EyeOff toggle en cada campo password (cambia input type entre `password` y `text`)
- LoginPage: checkbox "Recordar mi correo" (persiste email a `localStorage.bruno_remembered_email`)
- LoginPage: checkbox "Mantener sesión activa" (persiste a `localStorage.bruno_keep_session_active`, enviado al backend como `keep_session_active`)
- Restore de email recordado al montar LoginPage

**P2 — Map BRUNO Palette + Stripe Webhook + OG Meta-Cards**
- `MapStyleSocial.jsx` rewrite: paleta predominantemente naranja+beige
  - Roads: peach (#FFE2C2) / orange highways (#FFB37A → #FF8C42), bordes naranja oscuro
  - Landscape: beige profundo (#FFE6C7, #F5D6A2)
  - Administrative labels: naranja oscuro (#9A3412, #B45309, #7C2D12) negrita
  - POI commercial: muted -65% saturation para que los PIUP pins ganen siempre la atención
- `routers/piup.py` → nuevo endpoint `POST /api/piup/webhook/stripe`:
  - Verifica firma via `emergentintegrations.StripeCheckout.handle_webhook`
  - Marca `piup_orders` como `paid` cuando llega evento
  - Dispara WS event `piup_payment_received` al user_id del pedido (real-time refresh)
  - 503 si `STRIPE_API_KEY` no configurada, 400 si firma inválida
- NUEVO `routers/share_og.py` (Open Graph meta-cards):
  - `GET /api/share/c/{card_id}` — tarjeta Bruno
  - `GET /api/share/u/{user_id}` — perfil usuario
  - `GET /api/share/p/{post_id}` — publicación
  - HTML estética con paleta BRUNO (orange #FF6B35, beige #FFF1DF)
  - OG tags (`og:type`, `og:title`, `og:description`, `og:image`, `og:url`)
  - Twitter Card `summary_large_image`
  - Auto-redirect via `<meta http-equiv="refresh">` + JS fallback
  - 404 con HTML estética para recursos faltantes
  - Wired en `server.py` via `api_router.include_router(share_og_router)`

**Test results (iteration 56)**:
- Backend: 11/11 (100%) — OG endpoints, Stripe webhook validation, login w/ extra fields, like/react/comment regression
- Frontend: 100% post-fix (publish menu fast-path para post/status aplicada)



**Cambios .env**:
- `REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyDlkbZe-6pdqN-Xejx0oaSH47GDB9Ky9eI`
- `REACT_APP_GOOGLE_MAPS_ID=DEMO_MAP_ID`

**Fix posicion FAB**:
- Los botones "+" reclamar PIUP y recenter ahora se posicionan dinamicamente arriba del pill bar (`bottom: calc(var(--nav-reserve) + 200px)` y `z-[60]`) para nunca quedar tapados.

**Verificado visualmente con screenshots mobile (390x844):**
1. Mapa hibrido Bogota: 
   - Capa Google con calles (Av El Dorado, Carreras, Calles)
   - Barrios: KENNEDY, GALAN, LOS MARTIRES, SANTA FE, LA CANDELARIA
   - Hospitales visibles destacados: Hospital Universitario Mayor, Hospital Militar Central, Sociedad de Cirugia
   - Centros comerciales, parques, universidades
   - 1 pin PIUP naranja brand "Mi negocio" cerca LOS MARTIRES
2. Modal "Reclamar punto":
   - Selector de tarjeta funcional
   - 9 categorias con iconos+colores BRUNO
   - Coords auto-rellenadas
   - Boton "Publicar pin en el mapa" prominente

## Phase 57: Avatares burbuja + Sync global de Stories (2026-05-24)

**Bug fix critico**: `StoryRing` no aplicaba `rounded-full` cuando `hasActive=false`, devolviendo un `<div>` cuadrado. Resultado visible: foto de perfil se veia cuadrada en EditProfile. Ambos branches del componente ahora aplican `rounded-full overflow-hidden`.

**Mejoras estetica burbuja iluminada** (`StoryRing.jsx`):
- Radial glow exterior animado (opacity 0.55 ↔ 0.95, scale 1 ↔ 1.18, 2.4s loop) con `blur(6px)`
- Highlight glossy interno (gradient blanco 45% top-left) con `mixBlendMode: screen` para efecto burbuja
- Anillo conic gradient naranja→rosa→purpura preservado

**Componente reutilizable nuevo `BrunoAvatar`**:
- Wrapper universal: `<BrunoAvatar userId src name size>`
- Auto-detecta activeMap via `useStoryActivity()`
- Tap abre BrunoStoryViewer con stories del usuario via `/stories/user/{id}`
- Fallback con inicial cuando no hay avatar_url
- Centralizado: cambios al ring/glow se aplican automaticamente en todas las apariciones

**Sync global via context + WebSocket**:
- `StoryActivityProvider` (`contexts/StoryActivityContext.jsx`): un solo `activeMap` compartido por toda la app
- `registerUserIds(ids)` permite a cualquier lista registrar quien debe ser rastreado
- `markUserActive(uid)` para updates instantaneos sin esperar refresh
- Listener WS: evento `story_published` → marca al publisher como activo en TODOS los avatares
- Listener WS: evento `story_expired` → quita ring
- Safety refresh cada 90 segundos
- Backend `routers/stories.py` → `_broadcast_story_published(user_id, story_id)` notifica al publisher + todos sus followers (consulta `db.follows`)

**Aplicacion en pantallas**:
- `EditProfilePage`: avatar 112px con BrunoAvatar (era `<div className="rounded-full">` con bug)
- `MyProfilePage`: avatar 96px con BrunoAvatar (reemplaza implementacion manual con StoryRing + useActiveStories)
- `ChatPage.ChatList`: avatares 48px de cada conversacion + `useEffect` que registra los IDs en context

**Verificado screenshot mobile (390x844)**:
- Edit Profile: burbuja naranja perfecta con glow gradient visible
- My Profile: anillo + cover de coleccion "Demos" visibles  
- Chat List: avatar "T" circular con indicador verde online — listo para iluminarse cuando ese usuario publique

## Phase 56: Map Pill Bar — PIUP Cards + Located Stories (2026-05-24)

**Backend:**
- `routers/stories.py` → `StoryCreate.location` field opcional `{lat, lng, name, address}`
- `routers/stories.py` → `GET /api/stories/located` — historias 24h con ubicacion (bounding box opcional)
- `routers/map_pins.py` → `GET /api/map-pins/cards-located` — tarjetas Bruno con direccion guardada
- Verificado: 1 PIUP + 2 cards located + 1 story located via curl

**Frontend `MapProfilesBar.jsx` reescrito (337 lineas):**
- Self-fetch paralelo: `/map-pins` + `/map-pins/cards-located` + `/stories/located` cada 60s
- 4 filtros: Todos / PIUP / Stories / En vivo
- Bubble distintivos:
  - PIUP → ring naranja + badge MapPin
  - Story → ring fucsia + badge Play + place_name subtitulo
  - Card → ring neutro + badge segun card_type
  - User live → ring esmeralda animado
- Header dinamico con badges PIUP / Stories / LIVE
- Story bubble tap → BrunoStoryViewer inline
- Card/PIUP tap → navigate `/c/{card_id}`
- Renderiza en NoApiKeyFallback para verificacion sin Google key

**Verificado screenshot mobile**:
- Filtro PIUP muestra 3 elementos
- Filtro Stories muestra 1 con anillo fucsia + "Bogota Centro"
- Filtro Todos muestra 4

## Phase 55: Mapa Hibrido Google Maps + PIUP (2026-05-24)

**Pendiente:** activar con `REACT_APP_GOOGLE_MAPS_API_KEY` (user accion).

**Backend `routers/map_pins.py` (312 lineas):**
- 9 categorias (commerce, restaurant, service, health, education, office, personal, event, other)
- Endpoints: `POST /claim` (idempotente), `DELETE /{id}`, `GET /mine`, `GET /` (bounding box), `GET /{id}`, `PATCH /{id}`, `GET /categories`

**Frontend:**
- `MapPage.jsx` migrado de Leaflet a `@vis.gl/react-google-maps@1.8.3`
- `MapStyleSocial.jsx` — JSON style Snapchat-like (cream/orange, calles fuertes, hospitales/gobierno destacados)
- `MapPinClaimModal.jsx` — bottom-sheet con selector de tarjeta + categoria + coords + titulo
- `AdvancedMarker` con `<BrunoPin>` custom (circulo naranja con emoji + tail)
- InfoWindow con avatar/banner + botones "Ver tarjeta" y "Como llegar"
- Toggle Layers (mostrar/ocultar PIUP layer)
- FAB "+" para reclamar pin
- `MapPageLegacy.jsx` backup de la version Leaflet



**Logo oficial** (perro con VR goggles, naranja `#FF7F00`, fondo cream):
- Descargado desde `customer-assets.emergentagent.com/.../LBPP1.png` y guardado como `/bruno-official.png` (~97 KB)

**Archivos reemplazados** (el contenido del archivo cambia, las refs en codigo NO):
- `/bruno-mascot.png` → nuevo logo
- `/bruno-icon.png` → nuevo logo
- `/bruno-badge.png` → nuevo logo (creado para push notifications)
- `/mascots/bruno-icon.png` → nuevo logo (defensivo)

**Sin tocar** (logo wordmark "BRUNO" para el nav superior izquierdo):
- `/bruno-logo.png` → mantiene su diseño original con el nombre BRUNO escrito
- Refs en `Dashboard.jsx`, `FeedPage.jsx`, `LandingPage.jsx`, `HelpPage.jsx`, `PricingPage.jsx`, `ContactPage.jsx` se mantienen

**Refactor selectivo**:
- `BrunoMascot.jsx`: reemplazo `bruno-mascot.webp` → `bruno-mascot.png?v=8` (5 ocurrencias)
- `BrunoMascot.jsx`: reemplazo `/mascots/bruno-logo.png` → `/mascots/bruno-icon.png?v=8` (2 ocurrencias)

**Index.html**:
- 4 links de favicon agregados: `icon` (32x32, 192x192), `shortcut icon`, `apple-touch-icon` — todos a `/bruno-mascot.png?v=8`

**Manifest.json** (PWA):
- Reescrito con 3 icon entries (192/512 any, 192 maskable) apuntando a `/bruno-mascot.png?v=8`
- `theme_color: "#FF6B35"` conservado (naranja BRUNO)

**Verificacion**:
- Screenshot Login: card con nuevo logo mascot visible
- Screenshot Feed: top-left mantiene wordmark "BRUNO" original sin cambios
- `document.querySelectorAll('link[rel*="icon"]')` devuelve 4 entradas con la nueva URL

## Phase 53: Stripe PIUP + Story Reactions Push + Highlights + Story Rings (2026-05-20)

### Backend
- **Stripe checkout PIUP** (`routers/piup.py`):
  - `POST /api/piup/checkout` — crea orden en `piup_orders` con status `pending_payment`, dispara `StripeCheckout.create_checkout_session()` con metadata `{user_id, order_id, product_id}`, devuelve `checkout_url`
  - `GET /api/piup/checkout/status/{session_id}` — polling de estado tras redirect; actualiza `piup_orders` con `payment_status: paid` cuando Stripe lo confirma
  - Fallback elegante: si `STRIPE_API_KEY` no configurado → 503 + orden guardada con `payment_status: manual`
  - Verificado curl: devuelve URL real de Stripe `cs_test_a1zGWhqmQIGsQPKJVSC68...`
- **Push de reaccion a historia** (`routers/stories.py`):
  - `POST /stories/{id}/react` ahora dispara `notify_story_reaction(user_id, reactor_name, emoji, story_id, avatar)` como fire-and-forget si no es el propio dueno
- **Saved Stories / Highlights** (`routers/stories.py`):
  - `POST /stories/{id}/save` — guarda en coleccion `story_highlights` con collection name (idempotente con upsert)
  - `DELETE /stories/{id}/save` — quita del highlights
  - `GET /stories/highlights/{user_id}` — publica colecciones agrupadas con cover/count/items
  - `PATCH /stories/highlights/{id}` — renombrar coleccion / cambiar cover
  - `DELETE /stories/highlights/{id}` — eliminar item individual
  - `GET /stories/active-users?user_ids=...` — devuelve mapa user_id→count de historias no expiradas (para anillo)

### Frontend
- **`<StoryRing>`** (`components/bruno/StoryRing.jsx`) — wrapper para avatares con anillo conic-gradient (naranja→rosa→purpura) cuando hay historia activa, gris cuando ya vista. Tap dispara `onOpen`.
- **`useActiveStories`** (`hooks/useActiveStories.js`) — hook que consulta `/active-users` para una lista de IDs y expone `openStories(uid)` que carga + abre BrunoStoryViewer.
- **`<HighlightsSection>`** (`components/bruno/HighlightsSection.jsx`) — seccion Instagram-style en perfil:
  - Scroll horizontal de coleccion covers con gradiente conico purpura→rosa→naranja
  - Botón "+ Nueva" (owner) que solicita nombre de coleccion y guarda la story mas reciente
  - Disclosure "Gestionar destacadas" con boton eliminar por item
  - Click en coleccion → abre BrunoStoryViewer con items de la coleccion (incluso despues de 24h)
- **`MyProfilePage`** integrado:
  - Avatar envuelto en `<StoryRing hasActive={...} size={96}>` que abre BrunoStoryViewer real
  - `<HighlightsSection isOwner>` entre PointsWidget y tabs
  - BrunoStoryViewer montado al final del componente
- **`PiupProductConfigurator`** — `submit` ahora intenta `/piup/checkout` primero (redirige a Stripe), fallback elegante a `/piup/request-physical` si Stripe devuelve 503

### Verificacion
- curl: Stripe checkout 200 con URL real, active-users {user_id: 1}, save → "Demos" coleccion, get highlights total_items: 1
- screenshot: anillo gradient visible, "Historias destacadas — 1 guardadas", coleccion "Demos · 1 story" + boton "+ Nueva"

## Phase 52: Correcciones criticas - Cámara/Video, Foto Perfil, Stories (2026-05-20)

**Bug 1: Subir videos al Feed fallaba silenciosamente**
- `CreatePost.jsx`: ahora detecta `file.type.startsWith("video/")` y enruta videos a `/upload/chat-file` (Cloudinary `resource_type=video`). Antes se enviaba todo a `/upload/image` con transformaciones que solo aplican a imágenes.
- Botones "Imagen" y "Video" ahora resetean correctamente el atributo `accept` del input.
- `routers/uploads.py` → `/upload/image` ahora detecta `content_type` y:
  - Si video: usa `resource_type="video"` sin transformaciones
  - Si imagen: aplica transformaciones (1200x1200 limit, quality auto:good)
- Verificado vía curl: video mp4 sube con resource_type=video, format=mp4, duration=1.0s

**Bug 2: Foto de perfil no persistía al salir sin Guardar**
- `EditProfilePage.uploadAvatar`: ahora llama `PUT /api/profile` inmediatamente después del upload con `{...profile, avatar_url: url}` para fijar el cambio en DB sin requerir click en "Guardar"
- Si el auto-save falla, fallback al comportamiento anterior con toast informativo
- Verificado: upload → PUT /profile → GET /profile devuelve nuevo avatar_url persistido

**Bug 3: "Ver historia" no abria nada**
- `EditProfilePage`: el botón `avatar-menu-stories` navegaba a `/my-profile?tab=stories` (ruta sin handler). Ahora:
  - Llama `GET /api/stories/user/{user.id}` directamente
  - Si hay stories, abre `<BrunoStoryViewer>` inline con el data correcto
  - Si no hay stories, toast informativo "No tienes historias activas"
- Loading state con `Loader2` reemplazando el icono Sparkles mientras carga
- Verificado vía screenshot: menu abre → click "Ver historia" → viewer aparece con video, header del usuario, barra de progreso, reacciones y botón Responder funcionando

**Backend (`routers/piup.py`, 350 lineas):**
- Catalogo completo de **19 productos PIUP** seedeados in-memory con campos: id, name, category, schema_id (link a NFC schema), styles (codigos C/U/R + 1..7), base_price
- Tabla de tamanos: 1=1x1cm, 2=3x3cm, 3=5x5cm, 4=7x7cm, 5=R3x5cm, 6=R4x7cm, 7=R ID (85x55mm)
- 9 colores disponibles (negro, blanco, naranja, dorado, plateado, azul, verde, rojo, holografico)
- 4 categorias: Hogar (5), Restaurantes y comercios (3), Oficinas (10), Mascotas (1)
- **Endpoints:**
  - `GET /api/piup/catalog` — productos con filtros opcionales `?category=` y `?style=`
  - `GET /api/piup/sizes` — tabla de tamanos + formas + colores
  - `GET /api/piup/my-tags` — JOIN cards + nfc_cards con summary (physical/digital_only)
  - `POST /api/piup/request-physical` — crea orden en `piup_orders` con validacion de estilo permitido
  - `GET /api/piup/orders` — historial de pedidos
  - `POST /api/piup/activate-by-qr` — vincula NFC ↔ card, dispara WS event `piup_activated`

**Frontend (`pages/PiupManagerPage.jsx` + `components/piup/*.jsx`):**
- `PiupManagerPage` (ruta `/piup`) — header con conteos (fisicos/digitales) y 3 tabs animados con `motion.div` layoutId
- **MisTagsTab**: grid de tarjetas con badge "PIUP fisico" o "Solo digital", botones "Solicitar PIUP" / "Renovar" / "Ver", CTA a Activar
- **ActivarPiupTab**: escaner QR con `jsQR` + camera environment (1280px), parse de URL/plain payload, fallback manual; flujo 3 pasos (Escanear → Elegir tarjeta → Confirmar); ring + scanline animados
- **TiendaPiupTab**: filtros por categoria + forma (C/U/R), grid de 19 productos
- **PiupProductCard** + **PiupProductConfigurator**: configurador modal con StylePills (forma+tamano), color picker (9), card link select, qty stepper, total dinamico

**Real-time (Phase 3):**
- `activate-by-qr` dispara `asyncio.create_task(_broadcast_activation())` → `ws_manager.send_personal_message({"type":"piup_activated",...})`
- `PiupManagerPage` se suscribe via `useRealtimeNotifications().subscribe()` y refresca `my-tags` automaticamente
- QR del producto fisico + NFC chip ambos resuelven a la misma URL `/c/{card_id}` (unificacion); endpoint NFC `/api/nfc/go/{nfc_id}` redirige al mismo destino que el QR generado por `/api/cards/{card_id}/qr`

**Dependencias:**
- `jsqr@1.4.0` agregado para escaner QR client-side

**Verificacion:**
- Backend curl: catalog (19 productos), my-tags (summary correcto 1 fisico/2 digital), request-physical valida estilo + crea orden, activate-by-qr retorna redirect_url + nfc_endpoint
- Frontend screenshots: 3 tabs funcionando, configurador modal abre al hacer click en producto

## Remaining Backlog (post-51)
- server.py: extraer AI routes, Cards, Stripe (~1500 lineas)
- FeedPage.jsx (882) + MyProfilePage.jsx (953) breakdown
- Cablear `notify_story_reaction` en BrunoStoryViewer + `notify_incoming_call` en `/calls/start`
- ProfileSpecificFields.jsx (>1000 lineas) breakdown
- Integrar pago Stripe en flujo "Solicitar PIUP" (actualmente crea orden pendiente sin checkout)
- Generar QR del PIUP fisico apuntando a `/api/nfc/go/{nfc_id}` (consistencia QR ↔ NFC en print-on-demand)

**Feature: "Tu tarjeta cobro vida"** — el dueño recibe una push enriquecida cada vez que alguien escanea su NFC.

**Implementación:**
- `routers/push_notifications.py` → nuevo helper `notify_nfc_scan(user_id, card_id, card_title, card_image, nfc_id)`:
  - Title: "Tu tarjeta cobro vida"
  - Body: `«{card_title}»`
  - `image`: banner_url o avatar_url de la card → preview rico en móvil
  - Action única: "Ver analitica" → deep-link a `/c/{card_id}/analytics`
  - Tag `nfc_scan_{nfc_id}` → notificaciones se reemplazan en lugar de apilarse (anti-spam)
- `routers/nfc.py` → helper interno `_fire_nfc_scan_push` con `asyncio.create_task` (fire-and-forget) cableado en:
  - `GET /nfc/go/{nfc_id}` (302 redirect — entry primario)
  - `GET /nfc/resolve/{nfc_id}` (JSON)
  - Nunca bloquea el redirect del usuario que escanea; errores se loguean como warning
- `public/sw.js` → v8: handler para action `view_analytics` + matcher para tags `nfc_scan_`
- Subscripciones expiradas (410 Gone) se limpian automáticamente vía la lógica existente de `send_push_notification`

**Verificación end-to-end:**
- Activar NFC: 200 ✓
- `/nfc/resolve/{id}`: 200 con card data ✓
- `/nfc/go/{id}`: 302 → redirect a `/c/{card_id}` ✓
- Logs muestran que el push se dispara correctamente (410 Gone solo porque la sub de testing esta vencida — el código limpia automáticamente)


### Phase 57: Camera/Audio/Stories Polish (2026-02-15)

**P0 Bugfixes**
- `BrunoCameraPage.startCamera()` no longer forces `1080×1920` — uses device-native sensor + applies `zoom:min` via `applyConstraints` when supported. Fixes "unnecessary zoom" reported by user.
- Chrome voice-note playback: `useAudioRecorder` now picks a supported `MediaRecorder` mimeType (opus webm → mp4 → ogg) and tags the blob; `handleSendAudio` saves the correct file extension. `BrunoAudioWaveform` renders `<audio>` with a prioritized multi-`<source>` chain (mp3 → original codec → on-the-fly Cloudinary `f_mp3` transform) and calls `load()` on source change → Chrome plays reliably.

**New: In-app Gallery permission + Swipe-up**
- First-time tap on `camera-gallery-btn` shows an orange pulse dot and persists `localStorage["bruno-gallery-granted"]="1"`.
- Vertical swipe-up gesture on the viewfinder (dy>70px, dx<60px, <600ms) opens `InternalGalleryPicker` (in-app). Swipe-up from the right-sidebar "Stickers" zone opens the interactive panel instead.

**New: Camera Interactive Panel (live mode)**
- Right-sidebar `Sticker` button + swipe-up gesture opens a bottom-sheet (`camera-interactive-panel`) with 4 tabs:
  - **Stickers** (existing emoji presets)
  - **Emojis** (32 common emojis)
  - **Pregunta** — free-text question becomes an `overlay-question-<id>` on the viewfinder
  - **Encuesta** — question + 2-4 options renders an `overlay-poll-<id>` overlay
- Panel has `pb-[calc(5rem+safe-area)]` so CTAs clear the global MobileBottomNav on small viewports.
- `handlePublish`: if any interactive sticker present, posts to `/api/stories` (with `poll_id` from `/api/social/polls` when applicable) instead of `/api/posts`.

**Stories editor — multi-image + animated publish**
- `StoryEditor` file input gains `multiple`. Selected files upload in parallel and queue as `extraSlides`.
- Thumbnail strip (`story-slides-strip`) renders below the canvas with per-slide remove + "+" to add more.
- Publish loops over slides and posts each as a sequential `/api/stories`. Overlays/poll attached to the FIRST slide only.
- Animated overlay (`story-publish-animation`): spinning send icon during upload → green check + "¡Historia publicada!" → auto-closes.

**Files touched**
- `/app/frontend/src/pages/BrunoCameraPage.jsx`
- `/app/frontend/src/pages/ChatPage.jsx`
- `/app/frontend/src/components/bruno/BrunoAudioWaveform.jsx`
- `/app/frontend/src/components/StoryEditor.jsx`

**Test status**: `iteration_57.json` — 85% pass. Only HIGH issue (panel CTA occluded by bottom nav) fixed in same iteration via extra bottom padding. Live Chrome audio playback could not be exercised by the agent (no pre-existing audio messages in test account) — code path verified at static level.



## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key), Stripe, Daily.co, Cloudinary, Leaflet
- Emergent Google Auth, DEAL App (Hybrid API/Webhook)

### Phase 58: Story Analytics + P2 Refactor (2026-02-15)

**User-requested enhancement — Story Analytics**
- New endpoints in `routers/stories.py`:
  - `POST /api/stories/{id}/answer` — viewer submits a free-text answer to a story's question overlay; dedupes per user; notifies owner via WS `story_answer`.
  - `GET /api/stories/{id}/insights` — owner-only: views_count, reactions_count, reactions_by_emoji, answers list (with name + avatar), poll results.
  - `GET /api/stories/{id}/public-insights` — aggregate-only view for any user: answers_count, poll results, no PII.
- New `StoryInsightsModal.jsx` — animated bottom-sheet with: 3-counter grid (Vistas/Reacciones/Respuestas) for owners, animated poll bars (% + votes), per-emoji reaction chips, answer list with avatars.
- `BrunoStoryViewer` now fetches public-insights on story change and shows an `Insights` / `X respuestas · Ver resultados` button above the quick-reactions row that opens the modal (pausing the story timer).

**P2 — Backend refactor: AI router extraction**
- New `/app/backend/routers/ai.py` (~410 lines) containing:
  - `BRUNO_SYSTEM_MESSAGE`, `ai_chat_sessions` cache, `_search_public_cards_for_ai` helper
  - Routes: `POST /api/ai/chat`, `GET/DELETE /api/ai/history`, `POST /api/ai/generate-card`, `POST /api/ai/recommend`, `GET /api/ai/share-card/{id}`
- `server.py` reduced **3663 → 3175** lines (-488).

**P2 — Frontend refactor: ChatPage**
- `ChatPage.jsx` reduced **1672 → 1161** lines (-511).
- New modules:
  - `/app/frontend/src/hooks/useAudioRecorder.js` (93 lines)
  - `/app/frontend/src/components/chat/AudioPlayer.jsx` (137 lines, with multi-source mp3/webm/m4a fallback + Cloudinary `f_mp3` on-the-fly transform)
  - `/app/frontend/src/components/chat/FileAttachment.jsx`
  - `/app/frontend/src/components/chat/ChatList.jsx`
  - `/app/frontend/src/components/chat/NewChatModal.jsx`
- Behaviour preserved; no breaking testid changes.

**Test status — `iteration_58.json`**
- Backend: **13/13 pytest cases PASS** (creating both author + viewer, posting answers, querying insights, AI extraction).
- Frontend: full smoke pass — Story insights button + modal, chat flows, camera interactive panel.
- Phase 57 HIGH UX issue (camera panel CTA occlusion) confirmed FIXED (12px clearance from bottom nav).
- Non-blocking: pre-existing React duplicate-key warnings on /feed + empty `<img src>` warnings (orthogonal to this phase).


### Phase 59: Circular minimize · Drag-to-minimize · Location sharing · Calls live (2026-02-15)

**🎨 UX micro-changes**
- Minimized chat bubbles ↦ **circular avatar only** (no label, hover-reveal ✕). Applied to FloatingChatBubble + BRUNO IA chat.
- New `useDragToMinimize` hook (`/app/frontend/src/hooks/useDragToMinimize.js`) — wraps any element to support pull-down-to-minimize via touch *and* mouse. Spring transform with opacity fade.
- Wired to: `FloatingChatBubble` header, `FloatingBubbles` AI chat (`AIChatWindow`), `BrunoMascot` header.

**🤖 BRUNO IA**
- `FloatingBubbles.AIChatWindow` extracted into its own subcomponent with Minimize2 button, circular minimized state and drag-to-minimize.
- `BrunoMascot.jsx` (unused legacy) modernized too: hits real `/api/ai/chat`, parses `[ACTION:...]` and `[CARD:...]` tokens, minimize button.

**🗺️ Map**
- `/api/map-pins/cards-located` now filters cards: only `business/empresarial/empresa/negocio/lugares/servicios/oferta_trabajo/solicitud_servicio` OR cards with explicit `location.is_public_address=true`.
- Fixed first-pan UX: when geolocation resolves before the map mounts, pan is queued via `pendingUserCenterRef` and applied as soon as `MapInstanceCapture` exposes the map.
- New `SharedLocationsLayer` renders AdvancedMarkers for every active share, with speed-based icon (`<1 m/s` = standing dot, `<3 m/s` = 🚶, else 🚗) and live WS updates.

**📍 Location sharing (NEW)**
- Backend `routers/location_share.py` — collection `location_shares`:
  - `POST /api/location/share` (start, fixed or live, configurable duration + interval)
  - `POST /api/location/share/{id}/update` (sharer-only periodic ping)
  - `POST /api/location/share/{id}/stop`
  - `GET /api/location/shares/active`
  - `GET /api/location/share/{id}`
- WS broadcasts: `location_share_started`, `location_share_update`, `location_share_stopped`.
- Frontend `LocationShareSheet.jsx` (bottom-sheet) with mode selector (fixed/live), duration grid `[5m, 15m, 1h, 4h, 12h]`, interval grid `[5s, 10s, 30s, 60s]`. Live mode spawns a `watchPosition` + interval ping (`startLiveTracker`).
- Hook into `FloatingChatBubble` header (MapPin button → opens sheet) and a chat-system-message of `message_type='location_share'` shows in the conversation thread.

**📞 Calls live**
- New global `CallOrchestrator.jsx` mounted in `App.js`. Listens on WS `incoming_call` / `call_ended` events and the `window.bruno:start-call` custom event. Wires to `/api/calls/start|answer|decline|end` + renders the existing `VideoCallModal`.
- Chat bubble header gains Phone + Video buttons that dispatch `bruno:start-call`.

**Test status — `iteration_59.json`**
- Backend: **10/11 pass** (91%). Minor: chat message inserted by location-share router missed `is_deleted: false` → would be hidden by `/chats/{id}/messages`. **Fixed**.
- Frontend: critical UI flows all pass (chat bubble, call buttons exposed, location sheet renders, circular minimized).
- Known limitation: Playwright synthetic mouse drag doesn't always fire `onMinimize` after release. Hook now also triggers on `dy>120` regardless of velocity to be friendly to slow drags.
- Google Maps shows `BillingNotEnabledMapError` on the preview environment — environmental (production API key needs billing enabled), not a code issue.



### Phase 60: Global expansion · Multi-currency · Regional Compliance · Pre-deploy (2026-02-15)

**Closing-up of previous phase**
- `LocationMessagePreview.jsx` — chat bubble renders interactive Google-static-map snippet for `location_share` messages, with live countdown for live shares.
- `UserProfilePage` action bar gains MapPin (compartir ubicación), Phone, Video buttons next to Mail. Mounts `<LocationShareSheet>` inline. Calls dispatch `bruno:start-call`.
- `FloatingBubbles` AI minimize pill is now a **circular 28×28 button** matching the other minimized tray items (was a wider rounded-pill).

**🌍 New: Global Multi-Currency + Regional i18n** *(Fase A — Deploy-ready)*
- Backend `routers/i18n.py` — 35 countries (27 EU + 8 others) with currency/locale/tax-kind/default-rate metadata.
  - `GET /api/i18n/detect` → user-profile → CF-IPCountry header → X-Country-Code → Accept-Language → US fallback.
  - `GET /api/i18n/countries` — exhaustive list with `eu_codes` array.
  - `GET /api/i18n/currencies` — primary list + FX rates (USD as base).
  - `GET /api/i18n/rates?base=...` — full FX matrix (refreshed daily from exchangerate.host, fallback table on failure).
  - `POST /api/i18n/preference` — saves preferred_currency/country/locale onto user_profile.
  - `GET /api/i18n/compliance?country=XX` — returns the legal framework (RGPD/CCPA/Ley 1581/UK GDPR/generic).
- `utils/fx.py`-style helper inline: 24-hour FX cache in collection `fx_rates`.
- **EU coverage**: AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE — each with its native locale (`de-AT`, `fi-FI`, `pl-PL`, ...). Compliance auto-routes to GDPR for the 27.
- **USA**: CCPA/CPRA framework. **Colombia**: Ley 1581 (Habeas Data).
- **Stripe checkout**: now converts USD-base prices to user's currency at session creation. Falls back gracefully if FX call fails.

**Frontend i18n**
- `I18nProvider.jsx` — global context. Auto-detects on boot, caches in `localStorage["bruno-i18n"]`. Exposes `formatPrice(amount, fromCurrency?)`, `convert()`, `setPreference()`, `compliance`, `isEU`.
- `CurrencySelector.jsx` — dropdown with two tabs (País / Moneda). Lists EU + Otros separately. Live FX rate display.
- Mounted in `App.js` (wraps everything except AuthProvider).
- Added to `SettingsPage` under "Región y moneda" + expanded language buttons (ES/EN/PT/FR/DE/IT).

**Pending — Fase B (next session)**
- 🛡️ Cookie consent banner with framework-specific text (GDPR vs CCPA vs Ley 1581)
- 🛡️ Versioned T&C / Privacy per jurisdiction
- 💰 Stripe Tax integration (auto-VAT/sales-tax/IVA on checkout sessions)
- 🇨🇴 DIAN electronic invoicing (Siigo/Alegra)
- 🌐 Full UI translation (currently UI is ES-only; only the locale string flips for number/currency formatting)



### Phase 61: Cross-platform video + Reels modernos (2026-02-15)

**🎬 Reels TikTok/Instagram-style** (`/app/frontend/src/pages/ReelsPage.jsx` rewrite)
- **Auto-play** via `IntersectionObserver` (75% visible) — más confiable que onScroll
- **Gestos completos**:
  - Swipe ↑ / ↓ → siguiente / anterior (native scroll-snap)
  - Swipe ← → ir al perfil del autor en `/profile/:id/reels`
  - Swipe → → volver atrás
  - **Doble-tap** → like con animación heart-burst (`@keyframes pingOnce`)
  - **Long-press** → pausar mientras se mantiene
  - Tap simple → play/pause toggle
- **Modos**:
  - `/reels` → orden aleatorio + video-first (algorítmico)
  - `/profile/:userId/reels` → solo de ese usuario, cronológico desc
- **Historial**: stack en `historyRef` de IDs vistos en la sesión, soporta deep-link `?id=`
- **Mute global**: una sola toggle aplica a todos los reels (estado global)

**📹 Compatibilidad cross-platform (P0)**
- Backend `routers/uploads.py`: subidas de video ahora generan **eager derivatives**:
  - MP4 H.264+AAC 720p 1500kbps (universal — iOS/Android/Windows/Mac)
  - Poster JPG auto-generado en `start_offset:auto`
  - URL `f_auto,q_auto` para que Cloudinary elija el codec por device
- Frontend `<video>` ahora usa multi-`<source>`:
  1. `mp4_url` explícito (Cloudinary eager)
  2. `f_auto` (adaptativo)
  3. URL original (fallback)
- `playsInline` + `muted` + `preload="metadata"` aplicado globalmente (iOS Safari autoplay policy)
- Retry mute-on-fail si autoplay falla (Chrome/Safari policy)
- `poster` image para preview rápido sin descargar el video completo

**🤖 BRUNO IA pill — minimiza con la barra**
- Cuando el nav pill minimiza, el chat AI window también auto-minimiza (efecto reactivo en `FloatingBubbles`)
- La burbuja queda circular 28×28 igual que los demás items

**Verificación**
- ✅ `/reels` monta limpio, zero console errors
- ✅ Test cuenta sin reels muestra empty state correcto
- ✅ Build webpack compila sin errores (después de quitar attrs JSX no-estándar `webkit-playsinline`/`x-webkit-airplay` que rompían el plugin `visual-edits`)

**Listo para redeploy**



### Phase 62: Sync minimize · PWA cross-device · Video migration (2026-02-15)

**🔗 Minimize sincronizado**
- `NavScrollContext` ahora emite `window.bruno:minimize-all` cuando el nav pill minimiza, y escucha `bruno:child-minimized` para reaccionar a minimizados iniciados por chat o AI.
- `FloatingBubbles` (AI chat) — auto-minimiza al recibir el evento; emite `child-minimized` cuando el usuario lo minimiza manualmente.
- `FloatingChatBubble` (chats de usuarios) — quitamos el `if (minimized) return null` que ocultaba todo. Ahora los chats abiertos se vuelven burbujas circulares cuando el nav minimiza, mismo behavior que el AI. Ping `child-minimized` cuando el usuario minimiza un chat.
- Regla: minimizar uno → minimizan todos. Expandir uno → solo expande ese (UX-friendly como pidió el usuario).

**📱 PWAInstallPrompt — funcional en iOS/Android/Windows**
- Layout compacto de **una sola fila** en pantallas ≥360px (avatar + texto + botón + ✕). Cabe perfecto en iPhone SE / Android pequeño.
- Posicionado en `bottom: calc(5.5rem + safe-area)` para no chocar con el bottom-nav.
- **iOS Safari**: instrucciones step-by-step con el ícono real ▲-en-caja de Compartir + warning si el navegador es Chrome iOS (que no puede instalar PWA).
- **Android Chrome**: usa `beforeinstallprompt`. Si no llega en 15s, muestra instrucciones manuales como fallback.
- Botón "Cómo" expande/colapsa panel de instrucciones (no satura la UI).
- Detecta y oculta automáticamente si la app ya está en modo standalone.

**🎞️ Migración de videos existentes**
- Nuevo router `/app/backend/routers/admin_maintenance.py`:
  - `POST /api/admin/migrate-videos` (admin-only, background task) — itera todos los videos en Cloudinary y aplica el mismo eager-transcode (MP4 H.264+AAC 720p + poster JPG) que las nuevas subidas. Actualiza `posts.media.$.mp4_url` y `poster_url`.
  - `GET /api/admin/jobs` — lista los jobs y su progreso.
- Uso: `curl -X POST $API/api/admin/migrate-videos -H "Authorization: Bearer $ADMIN" -d 'prefix=bruno&limit=1000'`

**Verificación**
- ✅ Backend health 200, admin endpoint protegido (403 sin auth)
- ✅ Frontend smoke clean, sin errores de consola
- ✅ Nav pill + AI + chat se ven sincronizados en pantalla



### Phase 63: Unified Minimize — Pill + Normal Chat + Bruno IA as ONE unit (2026-02-15) 🔴 PRIORITY FIX

**El problema reportado**
- El chat normal (esquina inferior derecha) seguía siendo un círculo GRANDE (40×40) aunque el nav minimizara.
- El AI chat aparecía como bubble pequeño pero "atascado" en su esquina del pill bar.
- No había sincronización visual real entre los tres elementos.

**La solución implementada**
Los tres elementos (nav pill + chat normal + AI chat) ahora son **una sola unidad cohesiva** que comparten el mismo estado `minimized` vía `NavScrollContext`:

| Elemento | EXPANDED state | MINIMIZED state |
|---|---|---|
| Nav pill | Barra completa centrada | Hairline thin de 24×6 |
| AI bubble | Botón violeta 40×40 en `left-3` arriba del pill | Círculo violeta **28×28** a 60px del centro (izquierda) |
| Chat bubble | Botón naranja 40×40 en `right-3` arriba del pill | Círculo naranja **28×28** a 60px del centro (derecha) |

**Cambios técnicos** (`FloatingChatBubble.jsx`, `FloatingBubbles.jsx`)
- Chat bubble: nuevo render minimizado `chat-bubble-btn-minimized` (w-7 h-7) **simétrico** al AI bubble en `right: calc(50% - 60px)`.
- Tap en cualquier bubble minimizado → expande TODO (`setMinimized(false)` + abre ese específico).
- AI: cuando el nav minimiza, se fuerza `setShowAIChat(false)` + `setAiMinimized(false)` para que NO coexistan la bubble grande y la pequeña.
- Chat: cuando el nav minimiza, se cierra `isOpen`, `showNewChat`, y se fuerza `openChats.minimized=true`.
- Suprimimos popup de ChatList, modal NewChat y ChatListPopup mientras el nav esté minimizado.

**Flujo de eventos sincronizado**
- `nav scroll` → `setMinimized(true)` → emite `bruno:minimize-all` → AI + chat colapsan a tiny bubbles
- `AI Minimize button` → emite `bruno:child-minimized` → nav minimiza → chat colapsa
- `Chat Minimize button` → emite `bruno:child-minimized` → nav minimiza → AI colapsa
- `Tap en cualquier mini bubble` → expande el nav + abre ese elemento (no fuerza expandir los otros — UX cómoda)

**Verificación**
- ✅ Backend health 200
- ✅ Zero console errors
- ✅ Lint clean (los warnings restantes son pre-existentes, no de esta fase)
- ✅ Visualmente: las tres burbujas ahora viven en la misma fila a la altura del pill (28×28 cada una, simétricas)



### Phase 64: 🔴 CRITICAL — Video pipeline end-to-end FIXED (2026-02-15)

**Lo que estaba roto**
- `eager_async=False` en `/upload/image` bloqueaba la request hasta que Cloudinary transcodifique → timeouts en uploads grandes
- `/upload/chat-file` no aplicaba transcoding ni devolvía `mp4_url`/`poster_url`/`f_auto_url`
- El modelo `PostMedia` no aceptaba los campos nuevos → se perdían al guardar el post
- `PostCard.jsx` usaba `<video src={url}>` sin multi-source ni poster
- `CreatePost.jsx` no propagaba los nuevos campos al post

**La solución (5 layers)**

1. **`/api/upload/image` (uploads.py)**:
   - `cloudinary.uploader.upload_large` con chunks 6MB para videos >10MB (no más OOM / timeout proxy)
   - `eager_async=True` → response inmediata, transcoding en background
   - Detección de video por `content-type` OR extensión (mobiles tipean octet-stream)
   - **URLs sintetizadas** (no esperan derivatives): `mp4_url`, `poster_url`, `f_auto_url` construidas vía transform URLs de Cloudinary

2. **`/api/upload/chat-file` (uploads.py)**: misma lógica que `/upload/image` para videos. Devuelve `mp4_url`/`poster_url`/`f_auto_url`. URL efectiva = MP4 derivative (para playback inmediato).

3. **`routers/posts_feed.py` PostMedia**: añadidos campos `mp4_url`, `f_auto_url`, `poster_url`, `original_url` + `extra="allow"` → no se pierden al persistir/leer.

4. **`CreatePost.jsx`**: propaga `mp4_url`, `f_auto_url`, `poster_url`, `original_url` al objeto media del post.

5. **`PostCard.jsx`**: `<video>` ahora con multi-`<source>` (MP4 → f_auto → original) + `playsInline` + `preload="metadata"` + `poster` para preview instantáneo.

**Verificación end-to-end (probado vía curl con un MP4 real de 9MB)**:
- ✅ POST `/api/upload/image` → 200 con `url`, `mp4_url`, `poster_url`, `f_auto_url`
- ✅ POST `/api/posts` → 200 guarda los 4 campos en `media[0]`
- ✅ GET MP4 derivative → 200 · 723KB · `video/mp4;codecs=avc1` (H.264 universal)
- ✅ GET poster JPG → 200 · 20KB · `image/jpeg`
- ✅ Frontend smoke: feed loads clean, zero console errors

**Compatibilidad**
- iOS Safari (iPhone/iPad): ✅ — H.264 + AAC + `playsInline`
- Android Chrome: ✅ — todos los códecs MP4
- Windows/Mac Chrome/Edge/Firefox: ✅
- Safari macOS: ✅
- Cualquier dispositivo legacy: cae al `f_auto` que Cloudinary adapta on-the-fly




## 2026-06 — Fix: subida de video desde la fototeca del celular (iteration_77)
**Causa raíz**: `cloudinary.uploader.upload_large(bytes)` trataba los bytes como ruta de archivo → 500 `embedded null byte` en TODO video > 10 MB (cualquier video de celular). El post nunca se creaba.
**Fix**:
- `routers/uploads.py`: helper `_upload_video` (BytesIO + `run_in_threadpool`), compartido por `/upload/image` y `/upload/chat-file`. 413 en español para videos > 100 MB (límite Cloudinary). Detección de imagen/video por extensión cuando el MIME viene vacío (iOS .MOV / octet-stream).
- `lib/media.js`: `isVideoFile`, `videoTooLarge` usados en MobileBottomNav, CreatePost, QuickStoryButton, InternalGalleryPicker, StoryEditor, BrunoCameraPage, ChatAttachmentMenu.
- `MobileBottomNav.jsx`: toast con % de progreso real de subida, `timeout: 0`, error con detalle del backend.
- `ReelItem.jsx` / `FeedVideo.jsx`: auto-reintento con backoff (Cloudinary responde 423 mientras transcodifica) + cadena de fuentes mp4 → f_auto → original. Estado "Procesando video…".
- `useReelsFeed.js`: normaliza `f_auto_url` y `original_url`.
- Lint bloqueante `NDEFReader` → `window.NDEFReader` en `ActivateNFCPage.jsx`.
**Testing**: 14/14 backend + flujo frontend Crear → Reel → galería verificado (iteration_77). Nota: Chromium headless no decodifica H.264; la reproducción se valida vía HTTP 206 video/mp4.

## 2026-06 — Rediseño de navegación: sin "Inicio", Reels = feed único (iteration_78)
- Eliminado botón **Inicio** del nav. `/`, `/feed` y `*` → `Navigate` a `/reels`. `FeedPage.jsx` eliminado.
- Nav: Reels · Tienda · Crear · Mapa · Alertas · Perfil.
- **Reels muestra todo**: `GET /posts/recommended-videos?kind=all` (videos ×2.2, imágenes ×1.5 de boost). `normalizeReel` añade `kind` (video|image|text). `ReelTextCard.jsx` renderiza posts de solo texto a pantalla completa (fondo por hash del id, link "Ver tarjeta compartida" si `card_id`). En texto/imagen se ocultan mute, remix, sonido y barra de progreso.
- **Explorar tarjetas** → `CardsExplorer.jsx` (extraído del viejo Inicio). En `MapPage` pestañas "Mapa | Explorar" (`map-tab-explore`) → panel deslizable `map-explore-panel` (`/map?explore=1`). También enlace en ajustes del Perfil.
- **Idioma** → toggle en panel de ajustes del Perfil (`profile-language-toggle`), junto a "Sitio Web BRUNO".
- **/compose** (`ComposePage.jsx`, protegida): composer de publicación (texto/media/tarjeta). Menú Crear → "Publicación" navega aquí; al publicar → `/reels?id=<id>`.
- Testing: iteration_78 100% backend + frontend.

## 2026-06 — Fix: likes duplicados / inconsistentes entre Reels y Perfil
**Causa raíz**: el feed de Reels (`_hydrate_video_posts`) y la afinidad del algoritmo leían `db.post_likes` (colección vacía) mientras `toggle_like` escribía en `db.likes` → Reels siempre mostraba `is_liked=false`, el usuario volvía a dar like y el contador se desincronizaba.
**Fix** (`routers/posts_feed.py`): todo lee `db.likes`; `toggle_like` ahora borra duplicados y devuelve/persiste el conteo autoritativo (likers distintos, `$set`, no `$inc`); `/users/{id}/posts` añade `is_bookmarked` y consulta en lote. `ReelsPage.handleLike` sincroniza estado con la respuesta del servidor. Se reconciliaron `likes_count` de 10 posts con drift.

## 2026-06 — 4 features Reels (iteration_79, 100% backend+frontend)
- **Carrusel de fotos**: `reels/ReelCarousel.jsx` — swipe horizontal propio (no dispara swipe L/R del reel), contador N/M, dots, flechas en desktop.
- **Lista de likes**: `GET /posts/{id}/likes` (likers únicos + is_following/is_me). `ReelLikersSheet` en `ReelSheets.jsx`; `Rail` en ReelItem separa icono (like) de etiqueta (`reel-likes-count` → abre sheet), con botón Seguir.
- **Tour de bienvenida**: `WelcomeTour.jsx` reescrito a 5 pasos (Reels, Mapa+Explorar, Crear/Cámara, Perfil, Listo); cada paso navega a su pantalla (`target`) y resalta el botón del nav (`highlight` → `tour-spotlight`); modal anclado arriba. Reiniciable desde Perfil → ajustes → "Tour de bienvenida" (`profile-start-tour`). Auto-inicia para cuentas creadas hace <1h.
- **Estilos de texto**: `lib/textStyles.js` (8 fondos, 5 tipografías; Google Fonts en index.html). `TextStylePicker.jsx` en CreatePost (botón paleta, solo sin media). Post guarda `text_style {bg,font}`; `ReelTextCard` lo aplica.

## 2026-06 — 4 features más (iteration_80, 100% backend+frontend)
- **Historias en Reels**: `reels/ReelsStoriesStrip.jsx` (usa `/stories/feed`, `BrunoStoryViewer`); visible solo en el primer reel (activeIndex===0), no en "En vivo"/perfil. "Tu historia" → /camera.
- **Explorar cerca**: `CardsExplorer` chip `cards-filter-nearby` → geolocalización, haversine, orden por distancia y badge `card-distance` (m/km). Vacío: "Ninguna tarjeta cercana tiene ubicación todavía".
- **Compartir reel por chat**: `ReelShareSheet` recibe `token`, lista `GET /chats` y envía `POST /chats/{id}/messages` con `message_type:"reel"` + attachment `{type:'reel', post_id, poster_url, caption, author_name, kind}` (campos añadidos a `MessageAttachment`). `ChatPage` renderiza tarjeta `chat-reel-<postId>` → `/reels?id=`.
- **Pegatinas de texto**: `text_style` gana `align` (center|left) y `emoji`. `TextStylePicker` con alineación + 16 emojis; `ReelTextCard` renderiza emoji grande y alineación.
- Fix: `useReelsFeed.loadMore` con guard por ref + dedupe → sin keys duplicadas.

## 2026-06 — Auditoría Reels + Chat + Llamadas (iteration_81, 100%)
- Nuevo `DELETE /posts/{post_id}/comments/{comment_id}` (autor del comentario o dueño del post; recalcula `comments_count`). Papelera en `ReelCommentsSheet` (props `currentUserId`, `onDeleted`).
- Botón "Más" (`reel-more-btn`) → `ReelOptionsSheet`: dueño → Eliminar publicación (confirmación, `DELETE /posts/{id}`, `removeReel`); otros → Reportar / No me interesa.
- `ReelSoundSheet`: botón play/pause (`reel-sound-preview-btn`) que reproduce `sound.url`.
- Chat flotante: minimizar = cerrar ventana y volver al listado (ordenado por `last_message_at`); nav-minimize cierra ventanas (sin burbujas). `fetchChats` hoisted a `useCallback`.
- Llamadas: `video_calls.py` usa **Daily.co** si `DAILY_API_KEY` está en backend/.env (sala privada 2h + token por participante, `room_url?t=token` en el iframe existente); si no, fallback Jitsi (meet.jit.si exige login del anfitrión desde 2023 → causa de "no hace llamadas" en producción). `answer` devuelve `room_url` con token del receptor; `ChatPage`/`CallOrchestrator` lo usan.
- **PENDIENTE USUARIO**: pegar `DAILY_API_KEY` (dashboard.daily.co → Developers) en backend/.env de producción y redesplegar.

## 2026-06 — Timbre, historial borrable, editar publicación (iteration_82, 100%)
- `VideoCallModal`: `useRingtone` (WebAudio sintetizado + `navigator.vibrate` patrón) mientras suena; botones Aceptar/Rechazar 96px con etiquetas; "Sonando…"; auto-rechazo a 45s.
- Historial: `DELETE /posts/history/videos[?post_id=]`. `ReelHistorySheet`: X por item, swipe horizontal quita item, "Limpiar" con confirmación.
- Editar: `PUT /posts/{id}` (dueño; content/hashtags/text_style solo sin media/visibility, `edited_at`). `ReelEditSheet` (textarea + `TextStylePicker` si es texto) desde `ReelOptionsSheet` → `reel-edit-btn`; `patchReel` actualiza in place.
- Pendiente usuario: `DAILY_API_KEY` para llamadas reales.

## 2026-06 — Daily activo, historial de llamadas, programar publicación, No molestar, botón atrás (iteration_83 + fixes)
- **Daily.co ACTIVO** (`DAILY_API_KEY` en backend/.env preview; el usuario debe ponerla en producción). Nombres de sala únicos `bruno-{chat8}-{hex10}`.
- **Historial de llamadas**: `video_calls._log_call_message` inserta mensaje `message_type:"call"` (`is_deleted:false`) al terminar/rechazar/perder/DND, con `attachments[0]={type:'call', call_type, status, duration_sec}`; `end` marca `missed` si nunca se contestó. `ChatPage` renderiza píldora centrada `chat-call-<id>` con "Volver a llamar".
- **No molestar**: `utils/dnd.py is_dnd_active`; `GET/PUT /api/auth/me/dnd` (en server.py, no en routers/auth.py); `send_push_notification` omite en DND; `calls/start` devuelve `{dnd:true}` y registra perdida. UI `DndSettings.jsx` en ajustes del perfil.
- **Programar publicación**: `PostCreate.scheduled_at`; se guarda `visibility:"scheduled"` + `scheduled_visibility`; `POST /api/cron/publish-scheduled` (Bearer `WEBHOOK_CRON_SECRET`) → `.emergent/crons.yml` cada 15 min; `GET /posts/scheduled/mine`. UI: botón calendario en CreatePost, badge "Programado" en perfil (Posts y Reels), `/my-profile?tab=posts`.
- **Botón atrás global**: `FloatingBackButton.jsx` en rutas sin nav (/lives/:id, /camera, /website, /bruno, /chat/:id) si no hay control propio VISIBLE en el tercio superior.
- Fix: `Clock` faltaba en imports de MyProfilePage (crash en badge).

## 2026-06 — Llamadas grupales, recordatorio programado, silencio por chat, llamadas perdidas (iteration_84 + fixes)
- **Silencio por chat**: `POST /chats/{id}/mute` (toggle `muted_by`), `is_muted` en GET /chats; `send_message` omite notificaciones/push a silenciados; `calls/start` trata silenciado como DND (perdida). UI: `chat-mute-btn` en header, `chat-muted-icon-<id>` en lista flotante.
- **Llamadas perdidas hoy**: `GET /calls/missed/today` (24h, filtra por `started_at`); `MissedCallsToday.jsx` en /notifications con "Devolver" → `/chat/:id?call=audio|video`; ChatPage captura `?call=` en `autoCallRef` (padre) → prop `autoCall` → auto-marca (fix StrictMode: marcar `autoDialed` dentro del timeout).
- **Recordatorio programado**: cron crea notificación `scheduled_published` + push; plantilla y URL en `notification_realtime.py`; icono/enlace en NotificationsPage.
- **Grupal**: header de chat muestra nombre de grupo/"N participantes"; el fan-out de `incoming_call` ya llega a todos (sala Daily máx 8). API de creación de grupos aún es 1:1 (pendiente).
- Fix: `find_one` con proyección vacía era falsy → usar `is None`.
- ⚠️ Daily.co: la cuenta del usuario muestra "Missing payment method" → debe agregar tarjeta en dashboard.daily.co para que las salas conecten.

## 2026-06 — Rebranding corporativo BRUNO (iteration_91, 100% frontend)
- Paleta oficial: #ffffff (fondo) · #f9f1ea (superficies/cards) · #ff6a00 (acción/primary) · #474747 (texto y modo oscuro). Variables en `src/index.css` (`:root` y `.dark`, incl. `--reels-bg`).
- Modo claro principal; modo oscuro en gris corporativo (fondo #333, cards #474747, texto crema). Nunca negro puro.
- `tailwind.config.js` sobreescribe escalas `orange/pink/zinc/gray/stone/neutral/purple/violet/fuchsia` con tonos de marca → toda la app hereda la paleta sin tocar cada clase.
- Assets: `public/brand/` (icon-{orange,white,gray,cream}.png, logo-h-*.png, logo-v-*.png). `bruno-logo.png`/`bruno-mascot.png`/`bruno-icon.png` reemplazados por versiones transparentes. Nuevo `bruno-app-icon-*.png` (PWA/manifest), `favicon-256.png`. theme-color naranja/gris.
- Componentes: `components/bruno/BrunoLogo.jsx` (`BrunoLogo`, `BrunoHeaderMark` — data-testid brand-header-mark), `components/bruno/BrunoEmpty.jsx`. Máscara CSS `.bruno-mark` (currentColor) via `--brand-mark-url` en index.html.
- Oso en cabeceras (Marketplace, Mi perfil, Notificaciones, Configuración), estados vacíos (Reels, Notificaciones, Chat) y avatar por defecto (`BrunoAvatar` → `[data-testid=avatar-fallback] .bruno-mark`).
- Reels: fondo `.reels-surface` adaptativo (crema/gris); scrims en gris #474747 y `.reel-chrome` drop-shadow para legibilidad.
- Pendiente (no elegido por el usuario): iconos nativos Capacitor (Android/iOS) con el nuevo icono; login/registro ya usan el oso transparente.

## 2026-06 — Pantalla de carga con personaje + icono de app (iteration_92, 100% frontend)
- `components/bruno/BrunoLoader.jsx`: loader corporativo con las 3 poses del personaje (`/brand/mascot-{wave,laptop,walk}.webp`) rotando en cada carga (sessionStorage `bruno_loader_pose`), fondo alterno tema (crema/gris) ↔ naranja, barra 0→92% (rAF) y al desmontar clon fantasma que salta a 100% y se desvanece (`data-testid=bruno-loader-finish`). Props: `message`, `fullScreen` (portal en body, z-10000), `className`.
- Aplicado en ProtectedRoute (arranque "Iniciando BRUNO…") y en los `if (loading)` de ~22 páginas; inline (`fullScreen={false}`) en Marketplace (productos) y Reels. `BrunoLoading` (BrunoMascot) ahora delega en BrunoLoader.
- Icono de app: imagen oficial del oso sobre crema → `favicon.ico`, `favicon-256.png`, `apple-touch-icon.png`, `bruno-app-icon{,-512,-192}.png` (manifest v=11). Para nativo: `frontend/resources/{icon,icon-foreground,icon-background,splash,splash-dark}.png` + script `yarn cap:assets` (@capacitor/assets) — el usuario debe ejecutarlo tras `cap add` en su máquina.

## 2026-06 — Controles de reproducción modernos en Reels (auto-test, sin testing agent)
- `components/reels/ReelPlaybackControls.jsx`: burbujas de vidrio ultra transparentes (sin color: `bg-white/[0.06]` + blur + borde blanco) con −10 s · Play/Pausa · +10 s y el icono de sonido centrado debajo. Indicador de salto (`reel-seek-hint-left/right`).
- `ReelItem.jsx`: tap simple (diferido 260 ms) = play/pausa + muestra controles 2,5 s; doble tap lateral (30 % de cada borde) = ±10 s; doble tap centro = like (corazón). Se eliminó el botón de mute superior derecho (ahora bajo el play). testids: reel-playback-controls, reel-play-toggle, reel-seek-back, reel-seek-fwd, reel-mute-toggle, reel-paused-glyph.
- Nota: el preview headless no decodifica mp4 (duration NaN); el salto real de 10 s hay que validarlo en dispositivo.

## 2026-06 — Reels: tiempo + velocidad · Loader con frases · Tarjetas con marca (iteration_93)
- ReelItem: pill de tiempo `m:ss / m:ss` (`reel-time-bar`) centrada sobre la barra mientras los controles están visibles; burbuja de velocidad 1x→1.5x→2x (`reel-rate-toggle`, persiste por reel via rateRef); mantener pulsado (≥380 ms) el 30 % derecho = 2x temporal con pill `reel-boost-pill` (touch y mouse); al soltar vuelve a la velocidad elegida.
- BrunoLoader: 15 frases simpáticas en burbuja (`bruno-loader-phrase`), nunca repite la anterior (sessionStorage `bruno_loader_phrase`).
- Tarjetas: sello "Hecho con BRUNO" dentro de la tarjeta (`card-brand-seal`, oso con máscara currentColor), avatar fallback con el oso, footer con logotipo (`card-footer-brand`); CreateCardPage: presets de color de marca (`brand-color-presets`, `preset-<hex>`) y defaults crema #F9F1EA / gris #474747.
- Auditoría de iconos: el botón Compartir de Mi perfil no tenía acción → `handleShareProfile` (navigator.share o copia enlace + toast). Resto de iconos en Reels/Tarjetas/Marketplace/Chat verificados con handler o Link.
- Nota: testing agent no pudo validar velocidad/tiempo porque el primer reel del dataset era texto; verificado manualmente por el agente con un reel de video (rate 1.5, boost 2x, pill de tiempo).

## 2026-06 — Scrub preview · velocidad persistente · tarjeta modo oscuro · saludo por hora (auto-test)
- `components/reels/ReelScrubPreview.jsx`: miniatura al arrastrar la barra (touch: scrub sin buscar hasta soltar; desktop: hover). Video oculto crossOrigin → canvas; portada debajo como respaldo y fallback si CORS bloquea (`reel-scrub-preview`, `reel-scrub-time`, `reel-scrub-canvas`).
- Velocidad: `localStorage bruno_reel_rate` (1/1.5/2) aplicada a todos los reels al montar y al cambiar.
- `ThemeProvider` ahora persiste (`localStorage bruno_theme`), expone `resolved` y escucha cambios del sistema. ViewCardPage: botón sol/luna (`card-theme-toggle`), `data-card-theme`; en oscuro las tarjetas claras (luminancia > 0.72) pasan a gris #474747 con texto crema; las oscuras/naranjas se mantienen.
- BrunoLoader: saludo por hora (`greetingByHour`: días 5–12h, tardes 12–19h, noches) en la burbuja (`bruno-loader-greeting`).
- Limitación de preview headless: mp4 no decodifica → canvas vacío; validar fotograma real en dispositivo.

## 2026-06 — Tema en Ajustes · frases por sección · imagen compartible de tarjeta (auto-test)
- SettingsPage › Apariencia: selector Claro/Oscuro/Sistema (`theme-light|dark|system`) conectado a `useTheme().setTheme` (persistente) además de guardar en preferencias backend.
- BrunoLoader: `SECTION_PHRASES` por ruta (chat, tienda/marketplace, mapa, reels, perfil, tarjetas, notificaciones, ajustes); fallback a frases generales.
- `lib/cardShareImage.js`: `renderCardImage` (Canvas 1080×1920: fondo crema/gris, tarjeta con color propio, avatar u oso, título/subtítulo/descr., QR, URL, sello "Hecho con BRUNO", logotipo) y `shareCardImage` (Web Share con archivo → fallback descarga). Botón "Imagen para redes" (`card-share-image-btn`) en ViewCardPage.

## 2026-06 — Minimizar reel (3 modos) · compartir rápido · burbuja chat glass · imagen 1:1 · pose favorita · imagen de perfil (auto-test)
- `components/reels/ReelMinimizeMenu.jsx`: al tocar PiP → menú glass: Ventana flotante (PictureInPicture.jsx arrastrable, sigue reproduciendo), Sobre otras apps (PiP nativo `requestPictureInPicture`/webkit; permanece en la página), A la barra (pastilla sin video). `ReelsPage.handleMinimize(reel, mode)`.
- ReelShareSheet: 8 métodos rápidos con color (Compartir…, Copiar, WhatsApp, Telegram, X, Facebook, Correo, SMS), texto "· vía BRUNO", fila de marca (`reel-share-brand`, `reel-share-quick`).
- FloatingChatBubble: botón con el mismo glass de la barra de navegación (bg-background/85 + blur + border-border/40), icono naranja.
- `lib/cardShareImage.js`: `format: "story"|"square"` (1080×1080), QR generado en cliente con `qrcode` si no viene del backend, `footer_text`. ViewCardPage: botones "Historia 9:16" y "Cuadrada 1:1" (`card-share-square-btn`). MyProfilePage: `profile-share-image-btn` genera la imagen del perfil (avatar, @usuario, bio, QR al perfil, sello).
- BrunoLoader: `POSE_PREF_KEY` (`bruno_loader_pose_pref`: auto|wave|laptop|walk) + selector en Ajustes › Apariencia (`pose-<id>`).
- Dependencia nueva: `qrcode@1.5.4`.

## 2026-06 — Marca de agua en video · plantilla editable · portada de reel (auto-test)
- Backend `routers/reel_share.py`: `GET /api/reels/{post_id}/download` → si el video está en nuestro Cloudinary inyecta overlay `l_bruno_watermark` (sube `brand/icon-white.png` como `bruno_watermark` la primera vez) y devuelve `{url, watermarked, filename}`; si no, URL original con `watermarked:false`.
- Frontend `lib/videoWatermark.js`: fallback en cliente (canvas + MediaRecorder, mp4 si el navegador lo soporta, si no webm) con progreso. ReelShareSheet: opciones "Video + sello" (`reel-share-download`) y "Portada IG" (`reel-share-image`).
- `components/bruno/ShareImageSheet.jsx`: plantilla editable (formato 9:16/1:1, 8 colores + personalizado, frase ≤120) antes de generar; usada en ViewCardPage (`card-share-image-btn`), MyProfilePage (`profile-share-image-btn`) y portada de reel. `renderCardImage` acepta `bgColor`/`phrase`; `renderReelCover` + `shareBlob` en cardShareImage.js.
- Limitación: la marca de agua en cliente no se pudo ejecutar en el navegador headless (no decodifica mp4); overlay Cloudinary probado solo por lógica (videos de prueba no están en nuestro cloud).

## 2026-06 — Historia BRUNO desde la imagen · sello Premium · historial (auto-test)
- `ShareImageSheet` reescrito: prop `render()` devuelve `{blob,name,text,link}`; botones "Generar y compartir" y "Publicar como historia BRUNO" (`share-story-btn`: sube a `/upload/image?folder=bruno/stories` y `POST /stories/` con link). Sección "Recientes" (`share-history*`) desde IndexedDB (`lib/shareHistory.js`, máx. 12) con re-compartir / publicar / quitar.
- Sello personalizado Premium: Ajustes › Apariencia (`custom-seal*`): sube logo a Cloudinary, guarda `custom_seal_url` en preferencias (backend 403 si tier free) y en localStorage (`bruno_custom_seal`). Se dibuja junto a "Hecho con BRUNO" en tarjeta/perfil/portada (`drawSeal`), en el watermark de cliente y como overlay Cloudinary (`?seal=` → `l_<public_id>` g_south_west) en `/reels/{id}/download`.
- Callers actualizados: ViewCardPage (`renderShareImage`), MyProfilePage (`renderProfileImage`), ReelShareSheet (`renderCover`).
