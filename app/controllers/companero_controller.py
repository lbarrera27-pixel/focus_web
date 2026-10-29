"""Compañero IA: Foqui explica el plan y el riesgo con un LLM (Claude)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import usuario_actual
from app.models import Usuario
from app.schemas.companero import MensajeCompanero, RespuestaCompanero
from app.services.companero_service import CompaneroService

router = APIRouter(prefix="/companero", tags=["IA · Compañero Foqui"])


@router.post("/mensaje", response_model=RespuestaCompanero)
def mensaje(datos: MensajeCompanero, u: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)):
    """Respuesta de Foqui y su estado de ánimo.

    El estado se decide con el ajuste difuso y el riesgo (no con el LLM). Si el LLM
    no está configurado o falla, responde un mensaje predefinido (`fuente: respaldo`).
    """
    return CompaneroService(db).responder(u, datos.mensaje, datos.historial)
