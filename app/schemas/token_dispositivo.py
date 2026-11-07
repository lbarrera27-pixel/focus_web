from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas._comun import Respuesta


class TokenCrear(BaseModel):
    token: str = Field(..., min_length=10, max_length=512, examples=["fcm-ejemplo-0123456789abcdef"])
    plataforma: Literal["android", "web"] = "android"


class TokenActualizar(BaseModel):
    activo: Optional[bool] = None


class EstadoActualizar(BaseModel):
    """Lo manda la app del teléfono; los campos que no se envían se conservan."""
    modelo: Optional[str] = Field(None, max_length=80, examples=["Pixel 7 Pro"])
    version_app: Optional[str] = Field(None, max_length=20, examples=["1.8"])
    bateria: Optional[int] = Field(None, ge=0, le=100, description="Porcentaje de batería", examples=[78])
    cargando: Optional[bool] = Field(None, examples=[False])


class EstadoRespuesta(Respuesta):
    modelo: Optional[str] = None
    version_app: Optional[str] = None
    bateria: Optional[int] = None
    cargando: Optional[bool] = None
    fecha: datetime = Field(..., description="Último reporte (UTC)")


class TokenRespuesta(Respuesta):
    numero: int
    token: str
    plataforma: str
    fecha_registro: datetime
    activo: bool
    estado: Optional[EstadoRespuesta] = Field(None, description="Último estado que reportó el teléfono, si ya reportó")
