from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl

from app.schemas._comun import Respuesta

PATRON_EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UsuarioRegistro(BaseModel):
    email: str = Field(..., pattern=PATRON_EMAIL, examples=["dazai@focus.app"])
    nombre: str = Field(..., min_length=1, max_length=120, examples=["Luis Angel"])
    password: str = Field(..., min_length=6, max_length=72, examples=["secreto123"])
    seudonimo: Optional[str] = Field(None, max_length=60, examples=["piedrita"])


class LoginEntrada(BaseModel):
    email: str = Field(..., examples=["dazai@focus.app"])
    password: str = Field(..., examples=["secreto123"])


class RecuperarEntrada(BaseModel):
    email: str = Field(..., pattern=PATRON_EMAIL, examples=["dazai@focus.app"])


class UsuarioActualizar(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=120)
    seudonimo: Optional[str] = Field(None, max_length=60)
    password: Optional[str] = Field(None, min_length=6, max_length=72)


class FotoUrlEntrada(BaseModel):
    url: HttpUrl = Field(..., examples=["https://focusstorage.blob.core.windows.net/fotos/usuario-1.jpg"])


class UsuarioRespuesta(Respuesta):
    id: int
    email: str
    nombre: str
    seudonimo: Optional[str] = None
    activo: bool
    foto_url: Optional[str] = None
    fecha_registro: datetime


class LoginRespuesta(BaseModel):
    usuario_id: int
    nombre: str
    header: str = Field(..., description="Header que debe enviarse en las demás rutas")
