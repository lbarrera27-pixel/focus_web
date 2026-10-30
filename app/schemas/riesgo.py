from typing import Literal

from pydantic import BaseModel


class FactorRiesgo(BaseModel):
    variable: str
    descripcion: str
    valor: float
    contribucion: float            # w_j * z_j: aporte al logit
    efecto: Literal["sube", "baja"]


class RiesgoRespuesta(BaseModel):
    plan: int
    semana: int                    # última semana con ajuste; se predice la siguiente
    probabilidad: float            # P(recaída la semana siguiente)
    nivel: Literal["bajo", "medio", "alto"]
    umbral: float                  # desde aquí el modelo considera que habrá recaída
    variables: dict[str, float]
    factores: list[FactorRiesgo]   # ordenados del que más pesa al que menos
