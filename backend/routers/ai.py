"""AI routes - BRUNO IA assistant, card generation, recommendations."""
import os
import sys
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile, File, APIRouter, HTTPException, Depends
from pydantic import BaseModel

sys.path.insert(0, "/app/backend")

from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from utils.ws_manager import ws_manager
from models.user import User


router = APIRouter(prefix="/ai", tags=["ai"])

# In-memory session cache so repeat /ai/chat calls reuse the same LlmChat object.
ai_chat_sessions: dict = {}


BRUNO_SYSTEM_MESSAGE = """Eres BRUNO IA, asistente inteligente de BRUNO APP - red social de tarjetas digitales profesionales.

## Estilo de Comunicación
- **Directo al punto**: Respuestas cortas y útiles
- **Amistoso pero eficiente**: Sin rodeos
- **Accionable**: Sugiere pasos concretos
- **Español por defecto**: Responde en el idioma del usuario

## Formato de Respuestas
- Máximo 2-3 líneas para preguntas simples
- Usa bullets solo cuando sean necesarios
- NO uses emojis excesivos (máximo 1 por respuesta)
- Evita: "¡Hola!", "¡Claro que sí!", "Con mucho gusto"
- Ir directo a la respuesta útil

## ACCIONES ESPECIALES - Formato de Botones
Cuando sea útil dirigir al usuario a algún lugar de la app o mostrar resultados, incluye botones de acción usando este formato exacto al FINAL de tu respuesta:

[ACTION:route:/feed|Ir al Feed]
[ACTION:route:/map|Ver en Mapa]
[ACTION:route:/cards/new|Crear Tarjeta]
[ACTION:route:/marketplace|Ir a Tienda]
[ACTION:search:restaurante mexicano|Buscar Restaurantes Mexicanos]
[ACTION:route:/reels|Ver Reels]
[ACTION:route:/camera|Crear Historia]

Para mostrar tarjetas encontradas, usa:
[CARD:card_id|Nombre de la Tarjeta|tipo|ciudad]

## REGLAS DE BOTONES
- Incluye botones SOLO cuando la acción sea relevante
- Máximo 3 botones por respuesta
- Si el usuario pregunta dónde encontrar algo → incluye botón de búsqueda
- Si el usuario quiere crear algo → incluye botón de ruta

## Capacidades ACTIVAS
1. **Búsqueda de tarjetas**: Tienes acceso a las tarjetas públicas de BRUNO. Si buscan un servicio/producto, revisa el CONTEXTO DE TARJETAS que se te proporciona y recomienda las relevantes.
2. **Crear tarjetas**: Guía paso a paso, incluye botón [ACTION:route:/cards/new|Crear Tarjeta]
3. **Navegación rápida**: Incluye botones de acción para dirigir al usuario
4. **Resolver problemas**: Soluciones directas

## Tipos de Tarjetas
Personal | Empresarial | Negocio | Servicios | Lugares | Guardian | Curriculum | Mascotas | Oferta de Trabajo | Búsqueda de Personal | Solicitud de Servicio

## Funciones de la App
Feed, Stories, Reels, Chat, Mapa, Tienda PIUP, Marketplace, Lives, Llamadas, Puntos, NFC

## Ejemplos

Usuario: "¿Dónde encuentro restaurantes de comida mexicana?"
Respuesta: Busco en el directorio de BRUNO tarjetas de restaurantes mexicanos.
[Si hay resultados en el contexto, listarlos con [CARD:...]]
[ACTION:search:restaurante mexicano|Buscar Restaurantes Mexicanos]
[ACTION:route:/map|Ver en Mapa]

Usuario: "Quiero crear una tarjeta para mi negocio"
Respuesta: Para tu negocio te recomiendo el tipo "Negocio" o "Empresarial". Te llevo al creador:
[ACTION:route:/cards/new|Crear Tarjeta]

## Cuando no sepas algo
Di: "No tengo esa info. Contacta soporte@bruno.app"

## CONTEXTO DE TARJETAS PÚBLICAS
El sistema te proporcionará tarjetas relevantes como contexto adicional. Úsalas para dar recomendaciones reales."""


class AIMessageInput(BaseModel):
    message: str
    session_id: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    model: Optional[str] = None          # ChatGPT model id (see CHATGPT_MODELS)


# ChatGPT models available to end users (served through the Emergent universal key)
CHATGPT_MODELS = [
    {"id": "gpt-5.4", "name": "ChatGPT 5.4", "tag": "Recomendado", "description": "Equilibrio ideal entre velocidad y calidad"},
    {"id": "gpt-5.4-mini", "name": "ChatGPT 5.4 Mini", "tag": "Rápido", "description": "Respuestas instantáneas para tareas cotidianas"},
    {"id": "gpt-5.5", "name": "ChatGPT 5.5", "tag": "Avanzado", "description": "Razonamiento profundo para tareas complejas"},
    {"id": "gpt-4o", "name": "GPT-4o", "tag": "Clásico", "description": "Modelo multimodal clásico"},
]
DEFAULT_CHATGPT_MODEL = "gpt-5.4"
_ALLOWED_MODELS = {m["id"] for m in CHATGPT_MODELS}


def _resolve_model(requested: Optional[str]) -> str:
    return requested if requested in _ALLOWED_MODELS else DEFAULT_CHATGPT_MODEL


def _get_chat(session_id: str, model: str):
    """Reuse the cached LlmChat for the session; rebuild it when the user switches model."""
    from emergentintegrations.llm.chat import LlmChat
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    cached = ai_chat_sessions.get(session_id)
    if cached is None or getattr(cached, "_bruno_model", None) != model:
        chat = LlmChat(api_key=api_key, session_id=session_id, system_message=BRUNO_SYSTEM_MESSAGE).with_model("openai", model)
        chat._bruno_model = model
        ai_chat_sessions[session_id] = chat
    return ai_chat_sessions[session_id]


async def _image_content_from_attachment(url: Optional[str], mime: Optional[str]):
    """Turn an attached image (hosted URL or data URL) into ImageContent so ChatGPT can SEE it."""
    if not url or not (mime or "").startswith("image"):
        return None
    import base64
    from emergentintegrations.llm.chat import ImageContent
    try:
        if url.startswith("data:"):
            return ImageContent(image_base64=url.split(",", 1)[1])
        import httpx
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url)
            r.raise_for_status()
            if len(r.content) > 12 * 1024 * 1024:
                return None
            return ImageContent(image_base64=base64.b64encode(r.content).decode())
    except Exception as e:
        logging.warning(f"vision attachment skipped: {e}")
        return None


VISION_HINT = (
    "\n\n[IMAGEN ADJUNTA] Analiza la imagen real que ves. Si el usuario pide convertirla en publicación "
    "(o no especifica), responde con una descripción breve y luego propone un caption atractivo en español con 3-6 hashtags, "
    "y termina EXACTAMENTE con una línea: [PUBLISH:<caption con hashtags>] para que la app pueda publicarla con un toque."
)


async def _build_enriched_message(input_data: "AIMessageInput"):
    cards_context = await _search_public_cards_for_ai(input_data.message) or []
    enriched_message = input_data.message
    if cards_context:
        cards_info = "\n".join([
            f"- [{c.get('id','?')}] {c.get('title','')} ({c.get('card_type','')}) - {c.get('subtitle','')} - {(c.get('description','') or '')[:80]}"
            for c in cards_context if c
        ])
        enriched_message += f"\n\n[CONTEXTO DE TARJETAS ENCONTRADAS]\n{cards_info}"
    if input_data.attachment_url:
        enriched_message += f"\n\n[ARCHIVO ADJUNTO: {input_data.attachment_type or 'file'} - {input_data.attachment_url}]"
        if (input_data.attachment_type or "").startswith("image"):
            enriched_message += VISION_HINT
    return enriched_message, cards_context


def _user_message(text: str, image):
    from emergentintegrations.llm.chat import UserMessage
    return UserMessage(text=text, file_contents=[image]) if image else UserMessage(text=text)


class SpeakInput(BaseModel):
    text: str
    voice: Optional[str] = "nova"
    speed: Optional[float] = 1.0


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Voice → text with OpenAI whisper-1 (Emergent universal key)."""
    from emergentintegrations.llm.openai import OpenAISpeechToText
    import tempfile
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio demasiado grande (máx 25 MB)")
    ext = "webm" if "webm" in (file.content_type or "") else "mp4" if "mp4" in (file.content_type or "") else "wav" if "wav" in (file.content_type or "") else "webm"
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(data); path = tmp.name
    try:
        stt = OpenAISpeechToText(api_key=api_key)
        with open(path, "rb") as f:
            res = await stt.transcribe(file=f, model="whisper-1", response_format="json", language="es")
        return {"text": getattr(res, "text", "") or ""}
    except Exception as e:
        logging.error(f"STT error: {e}")
        raise HTTPException(status_code=500, detail="No se pudo transcribir el audio")
    finally:
        try: os.remove(path)
        except Exception: pass


@router.post("/speak")
async def speak_text(body: SpeakInput, current_user: User = Depends(get_current_user)):
    """Text → voice (OpenAI tts-1) — returns MP3 bytes."""
    from emergentintegrations.llm.openai import OpenAITextToSpeech
    from fastapi.responses import Response
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    import re as _re
    clean = _re.sub(r"\[(ACTION|CARD|PUBLISH):[^\]]*\]", "", body.text).strip()[:1500]
    if not clean:
        raise HTTPException(status_code=400, detail="Texto vacío")
    voice = body.voice if body.voice in ("alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer") else "nova"
    try:
        tts = OpenAITextToSpeech(api_key=api_key)
        audio = await tts.generate_speech(text=clean, model="tts-1", voice=voice, speed=max(0.5, min(2.0, body.speed or 1.0)), response_format="mp3")
        return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
    except Exception as e:
        logging.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail="No se pudo generar la voz")


class AIMessageResponse(BaseModel):
    response: str
    session_id: str
    cards_context: Optional[list] = None
    model: Optional[str] = None


@router.get("/models")
async def list_chatgpt_models():
    """ChatGPT models the user can pick for BRUNO IA."""
    return {"default": DEFAULT_CHATGPT_MODEL, "models": CHATGPT_MODELS}


class AICardGenerateInput(BaseModel):
    description: str


class AICardGenerateResponse(BaseModel):
    card_type: str
    suggested_fields: dict
    message: str


class AIRecommendationInput(BaseModel):
    query: str
    type: str = "all"


async def _search_public_cards_for_ai(query: str, limit: int = 5):
    """Search public cards to give Bruno AI context about available services"""
    search_words = query.lower().split()
    search_regex = "|".join(search_words)
    pipeline = [
        {"$match": {
            "is_public": {"$ne": False},
            "$or": [
                {"title": {"$regex": search_regex, "$options": "i"}},
                {"subtitle": {"$regex": search_regex, "$options": "i"}},
                {"description": {"$regex": search_regex, "$options": "i"}},
                {"card_type": {"$regex": search_regex, "$options": "i"}},
            ]
        }},
        {"$project": {"_id": 0, "id": 1, "title": 1, "subtitle": 1, "card_type": 1,
                       "description": {"$substrCP": ["$description", 0, 100]},
                       "contact_info": 1, "location": 1}},
        {"$limit": limit}
    ]
    cards = []
    async for card in db.cards.aggregate(pipeline):
        cards.append(card)
    return cards


@router.post("/chat", response_model=AIMessageResponse)
async def chat_with_bruno_ai(
    input_data: AIMessageInput,
    current_user: User = Depends(get_current_user)
):
    """Chat with BRUNO AI assistant - with public card knowledge and action buttons"""
    try:
        session_id = input_data.session_id or f"bruno_ai_{current_user.id}_{str(uuid.uuid4())[:8]}"
        model = _resolve_model(input_data.model)
        chat = _get_chat(session_id, model)
        enriched_message, cards_context = await _build_enriched_message(input_data)
        image = await _image_content_from_attachment(input_data.attachment_url, input_data.attachment_type)
        response = await chat.send_message(_user_message(enriched_message, image))

        conversation_doc = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "user_id": current_user.id,
            "model": model,
            "user_message": input_data.message,
            "ai_response": response,
            "attachment_url": input_data.attachment_url,
            "cards_context": [c.get("id") for c in cards_context if c] if cards_context else [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ai_conversations.insert_one(conversation_doc)
        try:
            from utils import search_sync
            await search_sync.index_ai_conversation(conversation_doc)
        except Exception:
            pass

        cards_for_response = [
            {"id": c.get("id", ""), "title": c.get("title", ""), "card_type": c.get("card_type", ""),
             "subtitle": c.get("subtitle", ""), "city": (c.get("location") or {}).get("city", "")}
            for c in cards_context if c
        ] if cards_context else None

        return AIMessageResponse(response=response, session_id=session_id, cards_context=cards_for_response, model=model)

    except Exception as e:
        logging.error(f"AI Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing AI request: {str(e)}")


@router.post("/chat/stream")
async def chat_with_bruno_ai_stream(
    input_data: AIMessageInput,
    current_user: User = Depends(get_current_user)
):
    """Streaming (SSE) variant: tokens arrive word by word. Events: meta · delta · done · error."""
    from fastapi.responses import StreamingResponse
    from emergentintegrations.llm.chat import TextDelta, StreamDone
    import json as _json

    session_id = input_data.session_id or f"bruno_ai_{current_user.id}_{str(uuid.uuid4())[:8]}"
    model = _resolve_model(input_data.model)
    chat = _get_chat(session_id, model)
    enriched_message, cards_context = await _build_enriched_message(input_data)
    image = await _image_content_from_attachment(input_data.attachment_url, input_data.attachment_type)
    cards_for_response = [
        {"id": c.get("id", ""), "title": c.get("title", ""), "card_type": c.get("card_type", ""),
         "subtitle": c.get("subtitle", ""), "city": (c.get("location") or {}).get("city", "")}
        for c in cards_context if c
    ]

    async def event_generator():
        full = []
        yield f"data: {_json.dumps({'type': 'meta', 'session_id': session_id, 'model': model, 'cards_context': cards_for_response})}\n\n"
        try:
            async for ev in chat.stream_message(_user_message(enriched_message, image)):
                if isinstance(ev, TextDelta):
                    full.append(ev.content)
                    yield f"data: {_json.dumps({'type': 'delta', 'content': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            text = "".join(full)
            conv_doc = {
                "id": str(uuid.uuid4()),
                "session_id": session_id, "user_id": current_user.id, "model": model,
                "user_message": input_data.message, "ai_response": text,
                "attachment_url": input_data.attachment_url,
                "cards_context": [c.get("id") for c in cards_context if c],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.ai_conversations.insert_one(conv_doc)
            try:
                from utils import search_sync
                await search_sync.index_ai_conversation(conv_doc)
            except Exception:
                pass
            yield f"data: {_json.dumps({'type': 'done', 'response': text})}\n\n"
        except Exception as e:
            logging.error(f"AI stream error: {e}")
            yield f"data: {_json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/history")
async def get_ai_chat_history(
    session_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get AI conversation history"""
    query = {"user_id": current_user.id}
    if session_id:
        query["session_id"] = session_id
    conversations = await db.ai_conversations.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return conversations


@router.delete("/history")
async def clear_ai_chat_history(
    session_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Clear AI conversation history"""
    query = {"user_id": current_user.id}
    if session_id:
        query["session_id"] = session_id
        if session_id in ai_chat_sessions:
            del ai_chat_sessions[session_id]
    result = await db.ai_conversations.delete_many(query)
    return {"deleted_count": result.deleted_count}


@router.post("/generate-card", response_model=AICardGenerateResponse)
async def ai_generate_card(
    input_data: AICardGenerateInput,
    current_user: User = Depends(get_current_user)
):
    """Generate card data based on natural language description"""
    description = input_data.description.lower()
    card_type = "personal"
    if any(word in description for word in ["empleo", "trabajo", "oferta", "vacante", "contratar"]):
        if any(word in description for word in ["busco", "necesito", "quiero"]):
            card_type = "busqueda_personal" if "personal" in description or "empleado" in description else "solicitud_servicio"
        else:
            card_type = "oferta_trabajo"
    elif any(word in description for word in ["empresa", "corporativo", "compañía"]):
        card_type = "empresarial"
    elif any(word in description for word in ["tienda", "negocio", "vendo", "venta", "local"]):
        card_type = "negocio"
    elif any(word in description for word in ["servicio", "freelance", "profesional", "ofrezco"]):
        card_type = "servicios"
    elif any(word in description for word in ["restaurante", "café", "bar", "lugar", "ubicación"]):
        card_type = "lugares"
    elif any(word in description for word in ["mascota", "perro", "gato", "pet"]):
        card_type = "mascotas"
    elif any(word in description for word in ["curriculum", "cv", "experiencia", "habilidades"]):
        card_type = "curriculum"

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        generation_prompt = f"""Genera los datos para una tarjeta digital tipo "{card_type}" basándote en esta descripción: "{input_data.description}"

Responde SOLO en JSON válido con estos campos según el tipo:

Para servicios/personal/empresarial/negocio:
{{"title": "nombre", "subtitle": "profesión/eslogan", "description": "descripción corta", "services": ["servicio1", "servicio2"], "suggested_color": "#hexcolor"}}

Para oferta_trabajo/busqueda_personal:
{{"title": "título del puesto", "subtitle": "empresa/sector", "description": "descripción", "salary_min": 0, "salary_max": 0, "contract_type": "full-time/part-time/freelance", "remote_option": "remote/hybrid/on-site", "requirements": ["req1", "req2"], "suggested_color": "#hexcolor"}}

Para solicitud_servicio:
{{"title": "servicio que busca", "subtitle": "urgencia", "description": "detalles", "budget_min": 0, "budget_max": 0, "requirements": ["req1"], "suggested_color": "#hexcolor"}}

Usa colores profesionales. Si hay ubicación mencionada, inclúyela. Responde SOLO JSON."""

        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"card_gen_{current_user.id}_{uuid.uuid4()}",
            system_message="Eres un generador de datos para tarjetas digitales. Respondes SOLO en JSON válido."
        ).with_model("openai", "gpt-4o")

        user_message = UserMessage(text=generation_prompt)
        ai_response = await chat.send_message(user_message)

        response_text = ai_response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        response_text = response_text.strip()

        suggested_fields = json.loads(response_text)
        suggested_fields["card_type"] = card_type
        suggested_fields["is_public"] = True
        suggested_fields["show_in_feed"] = True

        return AICardGenerateResponse(
            card_type=card_type,
            suggested_fields=suggested_fields,
            message=f"Tarjeta tipo '{card_type}' generada. Revisa y ajusta los campos antes de crear."
        )

    except Exception as e:
        logging.error(f"AI Card Generation error: {str(e)}")
        return AICardGenerateResponse(
            card_type=card_type,
            suggested_fields={
                "title": input_data.description[:50],
                "subtitle": "",
                "description": input_data.description,
                "card_type": card_type,
                "suggested_color": "#FF5A00"
            },
            message=f"Tarjeta tipo '{card_type}' creada con datos básicos. Completa los campos."
        )


@router.post("/recommend")
async def get_ai_recommendations(
    input_data: AIRecommendationInput,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get AI-powered recommendations for cards, posts, or reels based on search query"""
    results = {"cards": [], "posts": [], "query": input_data.query, "message": ""}
    search_terms = input_data.query.lower().split()

    if input_data.type in ["cards", "all"]:
        card_query = {
            "is_public": True,
            "$or": [
                {"title": {"$regex": input_data.query, "$options": "i"}},
                {"subtitle": {"$regex": input_data.query, "$options": "i"}},
                {"description": {"$regex": input_data.query, "$options": "i"}},
                {"card_type": {"$regex": input_data.query, "$options": "i"}}
            ]
        }
        cards = await db.cards.find(card_query, {"_id": 0}).sort("views", -1).limit(10).to_list(10)
        for card in cards:
            user = await db.users.find_one({"id": card["user_id"]}, {"_id": 0, "hashed_password": 0})
            if user:
                card["user"] = {
                    "id": user["id"],
                    "name": user.get("name", ""),
                    "avatar_url": user.get("avatar_url")
                }
        results["cards"] = cards

    if input_data.type in ["posts", "all"]:
        post_query = {
            "visibility": "public",
            "$or": [
                {"content": {"$regex": input_data.query, "$options": "i"}},
                {"hashtags": {"$in": search_terms}}
            ]
        }
        posts = await db.posts.find(post_query, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
        for post in posts:
            user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
            profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
            if user:
                post["user"] = {
                    "id": user["id"],
                    "name": user.get("name", ""),
                    "display_name": profile.get("display_name") if profile else user.get("name", ""),
                    "avatar_url": profile.get("avatar_url") if profile else user.get("avatar_url")
                }
        results["posts"] = posts

    total_results = len(results["cards"]) + len(results["posts"])
    if total_results > 0:
        if results["cards"]:
            results["message"] = f"Encontré {len(results['cards'])} tarjetas relacionadas con '{input_data.query}'. ¿Te interesa alguna en particular?"
        else:
            results["message"] = f"Encontré {len(results['posts'])} publicaciones relacionadas con '{input_data.query}'."
    else:
        results["message"] = f"No encontré resultados para '{input_data.query}'. Prueba con términos diferentes o publica una solicitud en el feed."

    return results


@router.get("/share-card/{card_id}")
async def share_card_recommendation(
    card_id: str,
    target_user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Share a recommended card with a user via chat"""
    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    chat = await db.chats.find_one({
        "type": "direct",
        "participants": {"$all": [current_user.id, target_user_id]}
    })

    if not chat:
        chat_id = str(uuid.uuid4())
        chat_doc = {
            "id": chat_id,
            "type": "direct",
            "participants": [current_user.id, target_user_id],
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.chats.insert_one(chat_doc)
    else:
        chat_id = chat["id"]

    message_doc = {
        "id": str(uuid.uuid4()),
        "chat_id": chat_id,
        "sender_id": current_user.id,
        "content": "Te comparto esta tarjeta que puede interesarte:",
        "message_type": "card",
        "attachments": [{
            "type": "card",
            "card_id": card["id"],
            "card_title": card.get("title", ""),
            "card_subtitle": card.get("subtitle", ""),
            "card_type": card.get("card_type", ""),
            "primary_color": card.get("background_color", "#FF6B35"),
            "secondary_color": card.get("text_color", "#FFFFFF")
        }],
        "is_read": False,
        "read_by": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await db.messages.insert_one(message_doc)

    await db.chats.update_one(
        {"id": chat_id},
        {"$set": {
            "last_message_id": message_doc["id"],
            "last_message_at": message_doc["created_at"],
            "updated_at": message_doc["created_at"]
        }}
    )

    try:
        await ws_manager.send_personal_message({
            "type": "new_message",
            "message": {**message_doc},
            "chat_id": chat_id
        }, target_user_id)
    except Exception:
        pass

    return {"status": "sent", "chat_id": chat_id, "message_id": message_doc["id"]}
