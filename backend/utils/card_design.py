"""Card design v2: default design, legacy template → design migration (non-destructive)."""
import copy

DESIGN_VERSION = 2

DEFAULT_DESIGN = {
    "version": DESIGN_VERSION,
    "preset": "custom",
    "layout": {"align": "left", "spacing": "medium", "radius": 24, "header": "classic"},
    "background": {"type": "color", "color": "#F9F1EA", "color2": "#FF6A00", "angle": 135, "imageUrl": None, "overlay": 45, "blur": 0, "brightness": 100},
    "colors": {"text": "#474747", "accent": "#FF6A00"},
    "typography": {"family": "modern", "titleSize": 2, "weight": 700, "letterSpacing": 0},
    "banner": {"enabled": True, "height": "md", "style": "image"},
    "avatar": {"enabled": True, "shape": "rounded", "position": "overlap", "size": 96},
    "hero": {"height": "lg", "fade": 70, "focusX": 50, "focusY": 30, "zoom": 100, "social": True},
    "buttons": {"style": "solid", "radius": 16, "size": "md", "stack": False},
    "socialStyle": "icons",
    "glass": {"enabled": False, "opacity": 50, "blur": 40},
    "effects": {"depth": "soft", "glow": False, "reflection": True},
    "animations": {"enabled": False},
    "components": {"banner": True, "avatar": True, "bio": True, "contact": True, "social": True, "gallery": True, "location": True, "typeFields": True, "qr": False, "cta": False, "links": True, "featured": True, "pro": True, "purposeContacts": True},
    "componentOrder": ["bio", "contact", "social", "links", "featured", "pro", "purposeContacts", "gallery", "location", "typeFields", "qr", "cta"],
    "cta": {"label": "", "url": ""},
}

# Preset overrides (mirror of frontend/src/lib/cardDesign.js PRESETS)
PRESETS = {
    "classic": {"preset": "classic", "layout": {"align": "center"}, "banner": {"enabled": False}, "avatar": {"shape": "circle", "position": "center", "size": 112}, "buttons": {"style": "solid", "radius": 999}},
    "minimal": {"preset": "minimal", "layout": {"align": "left", "spacing": "airy", "radius": 16}, "banner": {"enabled": False}, "avatar": {"shape": "circle", "position": "left", "size": 72}, "typography": {"family": "minimal", "titleSize": 1, "weight": 600}, "buttons": {"style": "minimal", "radius": 12, "size": "sm"}, "socialStyle": "icons", "effects": {"depth": "flat", "reflection": False}},
    "modern": {"preset": "modern", "banner": {"enabled": True, "height": "md"}, "avatar": {"shape": "rounded", "position": "overlap", "size": 96}, "typography": {"family": "modern"}, "buttons": {"style": "solid", "radius": 16}, "effects": {"depth": "soft"}},
    "glass": {"preset": "glass", "background": {"type": "gradient", "color": "#FF6A00", "color2": "#474747", "angle": 135}, "colors": {"text": "#FFFFFF"}, "avatar": {"shape": "circle", "position": "overlap", "size": 96}, "buttons": {"style": "bubble", "radius": 999}, "socialStyle": "bubbles", "glass": {"enabled": True, "opacity": 75, "blur": 70}, "effects": {"depth": "floating", "reflection": True, "glow": True}},
    "formal": {"preset": "formal", "layout": {"align": "left", "spacing": "medium", "radius": 12}, "background": {"type": "color", "color": "#FFFFFF"}, "colors": {"text": "#2B2B2B", "accent": "#B8860B"}, "typography": {"family": "elegant", "titleSize": 2, "weight": 600, "letterSpacing": 0.5}, "banner": {"enabled": True, "height": "sm", "style": "color"}, "avatar": {"shape": "rounded", "position": "left", "size": 88}, "buttons": {"style": "outline", "radius": 8}, "socialStyle": "iconsNames", "effects": {"depth": "flat", "reflection": False}},
    "photo": {"preset": "photo", "background": {"type": "fullimage", "overlay": 55}, "colors": {"text": "#FFFFFF"}, "banner": {"enabled": False}, "avatar": {"shape": "circle", "position": "center", "size": 104}, "layout": {"align": "center"}, "buttons": {"style": "glass", "radius": 999}, "glass": {"enabled": True, "opacity": 70, "blur": 50}, "effects": {"depth": "deep"}},
    # Showcase presets (glamour / noir / editorial / spotlight) — new stable ids, never applied to legacy cards automatically.
    "glamour": {"preset": "glamour", "layout": {"align": "left", "radius": 28, "header": "hero"}, "background": {"type": "color", "color": "#0B0B0D", "color2": "#1C1A1F"}, "colors": {"text": "#FFFFFF", "accent": "#E9C2A6"}, "typography": {"family": "modern", "titleSize": 3, "weight": 800, "letterSpacing": -0.5}, "banner": {"enabled": False}, "hero": {"height": "xl", "fade": 72, "social": True}, "buttons": {"style": "glass", "radius": 999, "size": "lg", "stack": True}, "glass": {"enabled": True, "opacity": 72, "blur": 60}, "effects": {"depth": "deep"}},
    "noir": {"preset": "noir", "layout": {"align": "center", "spacing": "airy", "header": "portrait"}, "background": {"type": "fullimage", "color": "#0A0A0A", "color2": "#2C2C2E", "overlay": 72, "blur": 10, "brightness": 80}, "colors": {"text": "#F4F4F4", "accent": "#F4F4F4"}, "typography": {"family": "minimal", "weight": 500, "letterSpacing": 1.5}, "banner": {"enabled": False}, "avatar": {"shape": "circle", "position": "center", "size": 132}, "buttons": {"style": "outline", "radius": 999}, "socialStyle": "outline", "effects": {"depth": "flat", "reflection": False}},
    "editorial": {"preset": "editorial", "layout": {"align": "left", "radius": 8, "header": "editorial"}, "background": {"type": "color", "color": "#F4EFE6", "color2": "#E8D3A8"}, "colors": {"text": "#141414", "accent": "#141414"}, "typography": {"family": "display", "bodyFamily": "minimal", "titleSize": 4, "weight": 500, "letterSpacing": 1}, "banner": {"enabled": False}, "buttons": {"style": "solid", "radius": 4, "size": "lg", "stack": True}, "socialStyle": "iconsNames", "effects": {"depth": "flat", "reflection": False}},
    "spotlight": {"preset": "spotlight", "layout": {"align": "left", "radius": 28, "header": "hero"}, "background": {"type": "color", "color": "#121114", "color2": "#2A1B10"}, "colors": {"text": "#FFFFFF", "accent": "#FF6A00"}, "typography": {"family": "creative", "titleSize": 3, "weight": 800, "letterSpacing": -0.5}, "banner": {"enabled": False}, "hero": {"height": "lg", "fade": 68, "social": False}, "buttons": {"style": "bubble", "radius": 999}, "socialStyle": "brand", "glass": {"enabled": True, "opacity": 68, "blur": 50}, "effects": {"depth": "floating", "glow": True}},
    "animated": {"preset": "animated", "background": {"type": "animated", "color": "#FF6A00", "color2": "#7C3AED", "angle": 135}, "colors": {"text": "#FFFFFF"}, "banner": {"enabled": False}, "avatar": {"shape": "bubble", "position": "center", "size": 104}, "layout": {"align": "center"}, "buttons": {"style": "glass", "radius": 999}, "glass": {"enabled": True, "opacity": 65, "blur": 40}, "animations": {"enabled": True}, "effects": {"depth": "floating", "glow": True}},
}

LEGACY_MAP = [
    ("premium_glass", "glass"), ("modern_glass", "glass"), ("glass", "glass"),
    ("premium_fullimg", "photo"), ("fullimg", "photo"),
    ("premium_animated", "animated"), ("animated", "animated"),
    ("premium_formal", "formal"), ("elegant", "formal"), ("formal", "formal"),
    ("full_banner_bubble", "modern"), ("edge_actions", "modern"),
    ("minimal", "minimal"), ("friend", "minimal"), ("clean", "minimal"),
    ("modern", "modern"), ("pro", "modern"), ("showcase", "modern"), ("tour", "modern"), ("bold", "modern"), ("promo", "modern"), ("gallery", "modern"), ("portfolio", "modern"), ("blocks", "modern"),
    ("classic", "classic"), ("default", "classic"),
]


def _deep_merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def legacy_preset(template_id: str) -> str:
    t = (template_id or "default").lower()
    for key, preset in LEGACY_MAP:
        if key in t:
            return preset
    return "modern"


def design_from_legacy(card: dict) -> dict:
    """Build a v2 design from legacy fields (template_id, background_color, text_color)."""
    template = card.get("template_id") or "default"
    preset = legacy_preset(template)
    design = _deep_merge(DEFAULT_DESIGN, PRESETS.get(preset, {}))
    bg = card.get("background_color")
    fg = card.get("text_color")
    if bg and preset not in ("photo",):
        design["background"]["color"] = bg
        design["colors"]["accent"] = bg if bg.upper() not in ("#FFFFFF", "#F9F1EA") else design["colors"]["accent"]
    if fg and preset not in ("photo", "animated", "glass"):
        design["colors"]["text"] = fg
    if template == "full_banner_bubble":
        design["banner"] = {"enabled": True, "height": "lg", "style": "image"}
        design["avatar"]["position"] = "inBanner"
        design["glass"] = {"enabled": True, "opacity": 40, "blur": 50}
    if template == "edge_actions":
        design["components"]["qr"] = True
    if not card.get("banner_url"):
        design["banner"]["enabled"] = design["banner"]["enabled"] and preset in ("modern", "formal")
        if design["banner"]["enabled"]:
            design["banner"]["style"] = "gradient"
    return design


def ensure_design(card: dict) -> tuple[dict, bool]:
    """Return (card, migrated). Adds card_design if missing; never removes legacy fields."""
    if isinstance(card.get("card_design"), dict) and card["card_design"].get("version"):
        return card, False
    card["card_design"] = design_from_legacy(card)
    card["card_design_version"] = DESIGN_VERSION
    card["legacy_template"] = card.get("template_id") or "default"
    return card, True
