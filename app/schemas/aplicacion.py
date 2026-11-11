from typing import Optional

from pydantic import BaseModel, Field

from app.schemas._comun import Respuesta


class AppCrear(BaseModel):
    nombre: str = Field(..., max_length=120, examples=["Instagram"])
    paquete: str = Field(..., max_length=255, examples=["com.instagram.android"])
    categoria: Optional[str] = Field(None, max_length=60, examples=["redes"])
    limite_aperturas: int = Field(10, ge=0, examples=[5])
    limite_minutos: Optional[int] = Field(None, ge=0, le=1440, examples=[45])
    nivel: int = Field(2, ge=1, le=3, examples=[2])
    vigilada: bool = True


class AppActualizar(BaseModel):
    nombre: Optional[str] = Field(None, max_length=120)
    paquete: Optional[str] = Field(None, max_length=255)
    categoria: Optional[str] = Field(None, max_length=60)
    limite_aperturas: Optional[int] = Field(None, ge=0)
    limite_minutos: Optional[int] = Field(None, ge=0, le=1440)
    nivel: Optional[int] = Field(None, ge=1, le=3)
    vigilada: Optional[bool] = None


class AppRespuesta(Respuesta):
    numero: int
    nombre: str
    paquete: str
    categoria: Optional[str] = None
    limite_aperturas: int
    limite_minutos: Optional[int] = None
    nivel: int = 2
    vigilada: bool = True
