"""Riesgo de recaída (regresión logística entrenada en ia/entrenar.py)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import usuario_actual
from app.models import Usuario
from app.schemas.riesgo import RiesgoRespuesta
from app.services.riesgo_service import RiesgoService

router = APIRouter(prefix="/riesgo", tags=["IA · Riesgo de recaída"])


@router.get("", response_model=RiesgoRespuesta)
def riesgo(u: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)):
    """Probabilidad de que el usuario se pase de su límite la semana siguiente
    a su último ajuste, y qué variables pesan más en esa estimación."""
    return RiesgoService(db).calcular(u.id)
