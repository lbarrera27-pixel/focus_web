import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.usuario import LoginEntrada, LoginRespuesta, RecuperarEntrada, UsuarioRegistro, UsuarioRespuesta
from app.services.usuario_service import CredencialesInvalidas, UsuarioService

router = APIRouter(prefix="/auth", tags=["Autenticación"])
log = logging.getLogger("focus.auth")


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
    return {"usuario_id": usuario.id, "nombre": usuario.nombre, "header": f"X-Usuario-Id: {usuario.id}"}


@router.post("/recuperar", status_code=status.HTTP_202_ACCEPTED)
def recuperar_contrasena(datos: RecuperarEntrada, service: UsuarioService = Depends(get_service)):
    """Solicitud para restablecer la contraseña (pantalla "Recupera tu contraseña" del portal).

    Responde lo mismo exista o no la cuenta, para no revelar qué correos están registrados.
    El envío del correo con el enlace aún no está conectado a un servicio de correo:
    por ahora la solicitud solo queda en el registro del servidor.
    """
    if service.repo.obtener_por_email(datos.email.strip().lower()):
        log.info("Solicitud de recuperación de contraseña para el usuario de %s", datos.email)
    return {"detail": "Si el correo está registrado, recibirás un enlace para crear una contraseña nueva"}

