from datetime import date, timedelta
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models._comun import ahora

PATRON_PAQUETE = r"^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$"


class UsoApp(BaseModel):
    paquete: str = Field(..., max_length=255, pattern=PATRON_PAQUETE, examples=["com.instagram.android"])
    nombre: Optional[str] = Field(None, max_length=120, examples=["Instagram"])
    minutos: int = Field(..., ge=0, le=1440, description="Minutos en primer plano ese día", examples=[42])
    aperturas: int = Field(..., ge=0, le=5000, description="Veces que se abrió desde otra app", examples=[17])


class DiaUso(BaseModel):
    fecha: date = Field(..., description="Día de FOCUS! (empieza a las 06:00 hora local)", examples=["2026-11-06"])
    apps: list[UsoApp] = Field(..., max_length=300)

    @field_validator("fecha")
    @classmethod
    def no_futura(cls, v: date) -> date:
        # +1 día de tolerancia por zonas horarias (el servidor está en UTC)
        if v > ahora().date() + timedelta(days=1):
            raise ValueError("la fecha no puede ser futura")
        return v

    @model_validator(mode="after")
    def paquetes_unicos(self):
        paquetes = [a.paquete for a in self.apps]
        if len(paquetes) != len(set(paquetes)):
            raise ValueError("un paquete aparece repetido en el mismo día")
        return self


class LoteMetricas(BaseModel):
    """Lote que envía el WorkManager del teléfono (POST /api/v1/metrics/sync)."""

    lote_id: str = Field(..., min_length=8, max_length=64, description="Id único del envío (para trazas y reintentos)",
                         examples=["5f0b7c2e-1d8a-4a51-9c1e-2b6f0e8d9a10"])
    dispositivo: Optional[str] = Field(None, max_length=120, examples=["Pixel 8 · Android 16"])
    dias: list[DiaUso] = Field(..., min_length=1, max_length=31)

    @model_validator(mode="after")
    def dias_unicos(self):
        fechas = [d.fecha for d in self.dias]
        if len(fechas) != len(set(fechas)):
            raise ValueError("un día aparece repetido en el lote")
        return self


class ResultadoSync(BaseModel):
    lote_id: str
    dias: int
    insertadas: int
    actualizadas: int
