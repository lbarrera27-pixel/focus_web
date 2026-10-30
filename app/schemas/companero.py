from typing import Literal, Optional

from pydantic import BaseModel, Field


class TurnoChat(BaseModel):
    rol: Literal["usuario", "foqui"]
    texto: str = Field(..., min_length=1, max_length=1000)


class MensajeCompanero(BaseModel):
    mensaje: Optional[str] = Field(
        None, max_length=500,
        description="Lo que escribe el usuario. Vacío = Foqui saluda y explica la semana.",
        examples=["¿Por qué bajó mi límite?"],
    )
    historial: list[TurnoChat] = Field(
        default_factory=list, max_length=10,
        description="Últimos turnos del chat (la API no guarda conversaciones).",
    )


class ContextoCompanero(BaseModel):
    """Lo único que ve el LLM: datos agregados de la semana."""
    nombre: str
    semana: Optional[int] = None
    minutos_semana: Optional[float] = None
    limite_diario_min: Optional[float] = None
    adherencia: Optional[float] = None
    nivel_adherencia: Optional[str] = None
    cambio_pct: Optional[float] = None
    riesgo_nivel: Optional[Literal["bajo", "medio", "alto"]] = None
    riesgo_probabilidad: Optional[float] = None
    factor_principal: Optional[str] = None
    racha: Optional[int] = None
    sesion_foco_activa: bool = False


class RespuestaCompanero(BaseModel):
    mensaje: str
    estado_foqui: Literal["Normal", "Atenta", "Enfocado", "Feliz", "Cansado"]
    fuente: Literal["llm", "respaldo"]   # respaldo = mensaje predefinido (sin LLM)
    contexto: ContextoCompanero
