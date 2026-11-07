from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas._comun import Respuesta

PATRON_DOMINIO = r"^[A-Za-z0-9][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$"


class DominioCrear(BaseModel):
    dominio: str = Field(..., max_length=255, pattern=PATRON_DOMINIO, examples=["youtube.com"])


class DominioActualizar(BaseModel):
    dominio: Optional[str] = Field(None, max_length=255, pattern=PATRON_DOMINIO)
    activo: Optional[bool] = None


class DominioRespuesta(Respuesta):
    numero: int
    dominio: str
    activo: bool


class IntentoCrear(BaseModel):
    fecha: Optional[datetime] = Field(None, description="UTC. Si el teléfono estuvo sin internet manda la hora real del intento")


class IntentoRespuesta(BaseModel):
    dominio: str
    fecha: datetime


class IntentosPorDominio(BaseModel):
    dominio: str
    numero: Optional[int] = None   # null si el sitio ya no está en la lista
    intentos: int


class IntentosPorDia(BaseModel):
    fecha: date                    # día en la hora local de los usuarios (UTC_OFFSET_HORAS)
    intentos: int


class IntentosResumen(BaseModel):
    dias: int
    total: int
    por_dominio: list[IntentosPorDominio]   # de más a menos intentos
    por_dia: list[IntentosPorDia]           # un registro por día, del más antiguo al de hoy

