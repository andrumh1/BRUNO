"""Open Graph meta-cards for external sharing.

When a Bruno user shares a link to their card/post/profile on
WhatsApp/Twitter/Telegram/etc the social network's crawler fetches the URL
and reads the <meta property="og:*"> tags to render a preview card.

Bruno SPA cannot serve those tags directly (React renders client-side), so
we expose dedicated HTML endpoints that:

  1. Return a tiny HTML page with brand-aligned OG/Twitter meta tags
  2. Auto-redirect real visitors (browsers) to the actual SPA route
  3. Stay 100% scrapable by crawlers (they read meta and stop)

These endpoints are the canonical shareable URLs - the share button in the
app copies these instead of the raw SPA path.
"""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from typing import Optional
import html
import sys

sys.path.insert(0, '/app/backend')
from utils.database import db

router = APIRouter(prefix="/share", tags=["share"])

# Brand palette (matches BRUNO design)
BRAND_ORANGE = "#FF6B35"
BRAND_BEIGE = "#FFF1DF"


def _esc(value: Optional[str]) -> str:
    if not value:
        return ""
    return html.escape(str(value), quote=True)


def _build_html(
    *,
    title: str,
    description: str,
    image_url: str,
    redirect_url: str,
    site_name: str = "BRUNO",
    card_kind: str = "summary_large_image",
) -> str:
    """Return a tiny HTML page tuned for social crawlers + auto-redirect."""
    t = _esc(title)
    d = _esc(description)
    img = _esc(image_url)
    redir = _esc(redirect_url)
    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{t} · BRUNO</title>

  <!-- Open Graph -->
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="{_esc(site_name)}" />
  <meta property="og:title" content="{t}" />
  <meta property="og:description" content="{d}" />
  <meta property="og:image" content="{img}" />
  <meta property="og:image:secure_url" content="{img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="{redir}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="{_esc(card_kind)}" />
  <meta name="twitter:title" content="{t}" />
  <meta name="twitter:description" content="{d}" />
  <meta name="twitter:image" content="{img}" />

  <!-- Brand color -->
  <meta name="theme-color" content="{BRAND_ORANGE}" />

  <!-- Auto-redirect real browsers -->
  <meta http-equiv="refresh" content="0;url={redir}" />
  <link rel="canonical" href="{redir}" />

  <style>
    html, body {{ margin: 0; padding: 0; background: {BRAND_BEIGE}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #2a1d12; }}
    .wrap {{ min-height: 100vh; display: grid; place-items: center; padding: 24px; }}
    .card {{ width: min(420px, 100%); background: #fff; border-radius: 24px; padding: 22px; box-shadow: 0 24px 50px -16px rgba(255, 107, 53, 0.45); border: 1px solid rgba(255, 107, 53, 0.18); text-align: center; }}
    .img {{ width: 96px; height: 96px; margin: 0 auto 12px; border-radius: 50%; object-fit: cover; border: 4px solid {BRAND_ORANGE}; box-shadow: 0 8px 22px -6px rgba(255, 107, 53, 0.55); }}
    h1 {{ font-size: 22px; margin: 8px 0 4px; }}
    p {{ color: #5b4a36; font-size: 14px; line-height: 1.4; margin: 0 0 16px; }}
    a.cta {{ display: inline-block; background: {BRAND_ORANGE}; color: white; text-decoration: none; font-weight: 700; padding: 12px 22px; border-radius: 999px; box-shadow: 0 10px 24px -8px rgba(255, 107, 53, 0.55); }}
    .pill {{ display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: {BRAND_ORANGE}; color: white; padding: 4px 10px; border-radius: 999px; margin-bottom: 10px; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="pill">BRUNO · Identidad digital</div>
      {f'<img class="img" src="{img}" alt="{t}" />' if img else ''}
      <h1>{t}</h1>
      <p>{d}</p>
      <a class="cta" href="{redir}">Abrir en BRUNO</a>
    </div>
  </div>
  <script>setTimeout(function () {{ window.location.replace("{redir}"); }}, 300);</script>
</body>
</html>"""


def _frontend_origin(request: Request) -> str:
    """Best-effort frontend origin (the SPA host). Falls back to FRONTEND_URL env."""
    import os
    env = os.environ.get("FRONTEND_URL")
    if env:
        return env.rstrip("/")
    # Strip /api/share/* from the request URL → use the host part
    return str(request.base_url).rstrip("/")


@router.get("/c/{card_id}", response_class=HTMLResponse)
async def share_card(card_id: str, request: Request):
    """Open Graph page for a Bruno card."""
    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    origin = _frontend_origin(request)

    if not card:
        return HTMLResponse(_build_html(
            title="Tarjeta no encontrada",
            description="Esta tarjeta de BRUNO ya no esta disponible.",
            image_url=f"{origin}/bruno-mascot.png",
            redirect_url=f"{origin}/",
        ), status_code=404)

    title = card.get("title") or card.get("display_name") or "Tarjeta BRUNO"
    description = (
        card.get("bio")
        or card.get("description")
        or f"Conoce a {title} en BRUNO — tarjeta digital interactiva."
    )
    image_url = card.get("banner_url") or card.get("avatar_url") or f"{origin}/bruno-mascot.png"
    redirect_url = f"{origin}/c/{card_id}"

    return HTMLResponse(_build_html(
        title=title,
        description=description[:240],
        image_url=image_url,
        redirect_url=redirect_url,
    ))


@router.get("/u/{user_id}", response_class=HTMLResponse)
async def share_user(user_id: str, request: Request):
    """Open Graph page for a Bruno user profile."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    origin = _frontend_origin(request)

    if not user:
        return HTMLResponse(_build_html(
            title="Usuario no encontrado",
            description="Este perfil de BRUNO ya no esta disponible.",
            image_url=f"{origin}/bruno-mascot.png",
            redirect_url=f"{origin}/",
        ), status_code=404)

    title = user.get("display_name") or user.get("username") or "Perfil BRUNO"
    description = user.get("bio") or f"Sigue a {title} en BRUNO."
    image_url = user.get("avatar_url") or f"{origin}/bruno-mascot.png"
    redirect_url = f"{origin}/profile/{user_id}"

    return HTMLResponse(_build_html(
        title=title,
        description=description[:240],
        image_url=image_url,
        redirect_url=redirect_url,
    ))


@router.get("/p/{post_id}", response_class=HTMLResponse)
async def share_post(post_id: str, request: Request):
    """Open Graph page for a Bruno post."""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    origin = _frontend_origin(request)

    if not post:
        return HTMLResponse(_build_html(
            title="Publicacion no encontrada",
            description="Esta publicacion de BRUNO ya no esta disponible.",
            image_url=f"{origin}/bruno-mascot.png",
            redirect_url=f"{origin}/feed",
        ), status_code=404)

    # Resolve author for nice title
    author = await db.users.find_one({"id": post.get("user_id")}, {"_id": 0, "password": 0})
    author_name = (author or {}).get("display_name") or (author or {}).get("username") or "Usuario BRUNO"

    title = f"{author_name} en BRUNO"
    content = (post.get("content") or "").strip()
    description = content[:240] if content else "Mira esta publicacion en BRUNO."

    image_url = None
    media = post.get("media") or []
    if isinstance(media, list) and media:
        first = media[0]
        if isinstance(first, dict):
            image_url = first.get("url") or first.get("secure_url")
    if not image_url:
        image_url = (author or {}).get("avatar_url") or f"{origin}/bruno-mascot.png"

    redirect_url = f"{origin}/post/{post_id}"

    return HTMLResponse(_build_html(
        title=title,
        description=description,
        image_url=image_url,
        redirect_url=redirect_url,
    ))
