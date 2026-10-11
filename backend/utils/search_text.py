"""Normalización de texto para la búsqueda global (acentos, mayúsculas, tokens, fragmentos)."""
import re
import unicodedata

_WORD_RX = re.compile(r"[#@]?[\w]+", re.UNICODE)
STOPWORDS = {"de", "la", "el", "los", "las", "un", "una", "y", "o", "en", "a", "que", "con", "por", "para", "del", "al", "es", "the", "of", "and", "to", "in"}


def normalize(text) -> str:
    if not text:
        return ""
    s = unicodedata.normalize("NFD", str(text))
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.lower().replace("ñ", "n")
    return re.sub(r"\s+", " ", s).strip()


def tokens(text, keep_stop=False) -> list:
    out = []
    for t in _WORD_RX.findall(normalize(text)):
        t = t.lstrip("#@")
        if len(t) < 2 or (not keep_stop and t in STOPWORDS):
            continue
        if t not in out:
            out.append(t)
    return out[:200]


def snippet(text, query_tokens, width=140) -> str:
    """Fragmento centrado en la primera coincidencia (sobre el texto original)."""
    if not text:
        return ""
    raw = str(text)
    norm = normalize(raw)
    pos = -1
    for t in query_tokens:
        pos = norm.find(t)
        if pos >= 0:
            break
    if pos < 0 or len(raw) <= width:
        return raw[:width] + ("…" if len(raw) > width else "")
    start = max(0, pos - width // 3)
    end = min(len(raw), start + width)
    return ("…" if start > 0 else "") + raw[start:end] + ("…" if end < len(raw) else "")


def parse_query(q: str) -> dict:
    q = (q or "").strip()
    kind = "text"
    if q.startswith("#"):
        kind = "hashtag"
    elif q.startswith("@"):
        kind = "handle"
    return {"raw": q, "kind": kind, "norm": normalize(q.lstrip("#@")), "tokens": tokens(q, keep_stop=True)}
