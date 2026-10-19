"""Esquema estricto de la petición de envío (cualquier campo extra → 422)."""
import re
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

URL_RE = re.compile(r"^/[A-Za-z0-9/_\-?=&.%:+,]*$")
IMAGE_RE = re.compile(r"^https://res\.cloudinary\.com/[A-Za-z0-9/_\-.%]+$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9:_\-]{20,4096}$")


class SendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(..., min_length=8, max_length=64, pattern=r"^[A-Za-z0-9\-_]+$")
    user_ref: str = Field(..., min_length=8, max_length=64, description="sha256 del user_id (nunca el id real)")
    tokens: List[str] = Field(..., min_length=1, max_length=500)
    title: str = Field(..., min_length=1, max_length=100)
    body: str = Field("", max_length=500)
    data: Dict[str, str] = Field(default_factory=dict)
    url: Optional[str] = Field(None, max_length=512)
    image: Optional[str] = Field(None, max_length=512)
    dry_run: bool = False

    @field_validator("tokens")
    @classmethod
    def _tokens(cls, v):
        bad = [t for t in v if not TOKEN_RE.match(t)]
        if bad:
            raise ValueError("token con formato inválido")
        if len(set(v)) != len(v):
            raise ValueError("tokens duplicados")
        return v

    @field_validator("data")
    @classmethod
    def _data(cls, v):
        if len(v) > 20:
            raise ValueError("máximo 20 claves en data")
        total = sum(len(k) + len(val) for k, val in v.items())
        if total > 2048:
            raise ValueError("data supera 2 KB")
        for k in v:
            if not re.match(r"^[A-Za-z0-9_]{1,40}$", k):
                raise ValueError(f"clave de data inválida: {k}")
        return v

    @field_validator("url")
    @classmethod
    def _url(cls, v):
        if v is not None and not URL_RE.match(v):
            raise ValueError("url debe ser una ruta relativa de BRUNO")
        return v

    @field_validator("image")
    @classmethod
    def _image(cls, v):
        if v is not None and not IMAGE_RE.match(v):
            raise ValueError("image debe ser una URL de Cloudinary")
        return v


class SendResponse(BaseModel):
    request_id: str
    sent: int
    failed: int
    invalid_tokens: List[str] = []
    dry_run: bool = False
