import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.usuario_repository import UsuarioRepository
from app.seguridad import crear_token
from app.utils.correo import correo_configurado, enviar_correo_recuperacion
from app.schemas.usuario import LoginEntrada, LoginRespuesta, RecuperarEntrada, RestablecerEntrada, UsuarioRegistro, UsuarioRespuesta
from app.services.recuperacion_service import EnlaceInvalido, restablecer_password, solicitar_enlace
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
    token, vigencia = crear_token(usuario.id)
    return {
        "usuario_id": usuario.id, "nombre": usuario.nombre, "header": f"X-Usuario-Id: {usuario.id}",
        "access_token": token, "token_type": "bearer", "expira_en": vigencia,
    }


@router.post("/recuperar", status_code=status.HTTP_202_ACCEPTED)
def recuperar_contrasena(datos: RecuperarEntrada, tareas: BackgroundTasks, db: Session = Depends(get_db)):
    """Pide el enlace para crear una contraseña nueva.

    Responde lo mismo exista o no la cuenta, para no revelar qué correos están registrados.
    El correo sale en segundo plano, así el tiempo de respuesta tampoco lo delata.
    """
    solicitud = solicitar_enlace(db, datos.email)
    if solicitud:
        if correo_configurado():
            tareas.add_task(enviar_correo_recuperacion, *solicitud)
        else:
            log.warning("Recuperación solicitada, pero SMTP no está configurado: no se envió el correo")
    return {"detail": "Si el correo está registrado, recibirás un enlace para crear una contraseña nueva"}


@router.post("/restablecer")
def restablecer_contrasena(datos: RestablecerEntrada, db: Session = Depends(get_db)):
    """Crea la contraseña nueva con el enlace del correo (un solo uso, caduca a los 30 minutos)."""
    try:
        restablecer_password(db, datos.token, datos.password)
    except EnlaceInvalido:
        raise HTTPException(status_code=400, detail="El enlace no es válido o ya caducó. Pide uno nuevo.")
    return {"detail": "Tu contraseña se actualizó"}
