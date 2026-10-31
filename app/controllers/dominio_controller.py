"""CRUD de DOMINIO_BLOQUEADO: sitios web que el usuario quiere bloquear."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import usuario_actual
from app.models import Usuario
from app.repositories.dominio_repository import DominioRepository, IntentoRepository
from app.schemas.dominio_bloqueado import (
    DominioActualizar, DominioCrear, DominioRespuesta, IntentoCrear, IntentoRespuesta, IntentosResumen,
)
from app.services.dominio_service import DominioService

router = APIRouter(prefix="/dominios", tags=["Dominios bloqueados"])


def get_service(db: Session = Depends(get_db)) -> DominioService:
    return DominioService(DominioRepository(db))


@router.post("", response_model=DominioRespuesta, status_code=status.HTTP_201_CREATED)
def crear_dominio(datos: DominioCrear, u: Usuario = Depends(usuario_actual), service: DominioService = Depends(get_service)):
    return service.crear(u.id, datos)


@router.get("", response_model=list[DominioRespuesta])
def listar_dominios(u: Usuario = Depends(usuario_actual), service: DominioService = Depends(get_service)):
    return service.listar(u.id)


# Va antes de /{numero} para que "intentos" no se lea como número
@router.get("/intentos", response_model=IntentosResumen)
def resumen_intentos(dias: int = Query(7, ge=1, le=90, description="Días hacia atrás, incluido hoy"),
                     u: Usuario = Depends(usuario_actual), service: DominioService = Depends(get_service),
                     db: Session = Depends(get_db)):
    """Cuántas veces intentó abrir cada sitio bloqueado y cuántos intentos hubo cada día."""
    return service.resumen_intentos(u.id, dias, IntentoRepository(db))


@router.post("/{numero}/intentos", response_model=IntentoRespuesta, status_code=status.HTTP_201_CREATED)
def registrar_intento(numero: int, datos: IntentoCrear | None = None, u: Usuario = Depends(usuario_actual),
                      service: DominioService = Depends(get_service), db: Session = Depends(get_db)):
    """Lo llama el teléfono cada vez que el navegador detiene la apertura de un sitio bloqueado."""
    return service.registrar_intento(u.id, numero, IntentoRepository(db), datos.fecha if datos else None)


@router.get("/{numero}", response_model=DominioRespuesta)
def obtener_dominio(numero: int, u: Usuario = Depends(usuario_actual), service: DominioService = Depends(get_service)):
    return service.obtener(u.id, numero)


@router.put("/{numero}", response_model=DominioRespuesta)
def actualizar_dominio(numero: int, cambios: DominioActualizar, u: Usuario = Depends(usuario_actual),
                     service: DominioService = Depends(get_service)):
    return service.actualizar(u.id, numero, cambios)


@router.delete("/{numero}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_dominio(numero: int, u: Usuario = Depends(usuario_actual), service: DominioService = Depends(get_service)):
    service.eliminar(u.id, numero)
