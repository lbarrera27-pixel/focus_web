from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.usuario_repository import UsuarioRepository
from app.seguridad import crear_token
from app.schemas.usuario import LoginEntrada, LoginRespuesta, UsuarioRegistro, UsuarioRespuesta
from app.services.usuario_service import CredencialesInvalidas, UsuarioService

router = APIRouter(prefix="/auth", tags=["Autenticación"])


def get_service(db: Session = Depends(get_db)) -> UsuarioService:
    return UsuarioService(UsuarioRepository(db))


@router.post("/registro", response_model=UsuarioRespuesta, status_code=status.HTTP_201_CREATED)
def registro(datos: UsuarioRegistro, service: UsuarioService = Depends(get_service)):
    return service.registrar(datos)


@router.post("/login", response_model=LoginRespuesta)
def login(datos: LoginEntrada, service: UsuarioService = Depends(get_service)):
    try:
        usuario = service.login(datos.email, datos.password)
    except CredencialesInvalidas:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token, vigencia = crear_token(usuario.id)
    return {
        "usuario_id": usuario.id, "nombre": usuario.nombre, "header": f"X-Usuario-Id: {usuario.id}",
        "access_token": token, "token_type": "bearer", "expira_en": vigencia,
    }
