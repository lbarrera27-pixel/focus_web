"""Recuperación de contraseña con enlace temporal de un solo uso."""
import hashlib
import secrets
from datetime import timedelta

from sqlalchemy.orm import Session

from app.config import PORTAL_URL, RECUPERACION_MINUTOS
from app.models import TokenRecuperacion, Usuario
from app.models._comun import ahora
from app.utils.security import hashear_password

MAX_ENLACES = 3
VENTANA_MINUTOS = 15


class EnlaceInvalido(Exception):
    pass


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def solicitar_enlace(db: Session, email: str) -> tuple[str, str] | None:
    """(correo, enlace) si hay que enviarlo; None si la cuenta no existe o ya pidió demasiados."""
    usuario = db.query(Usuario).filter(Usuario.email == email.strip().lower()).first()
    if usuario is None or not usuario.activo:
        return None
    momento = ahora()
    tokens = db.query(TokenRecuperacion).filter(TokenRecuperacion.usuario_id == usuario.id)
    recientes = tokens.filter(TokenRecuperacion.creado >= momento - timedelta(minutes=VENTANA_MINUTOS)).count()
    if recientes >= MAX_ENLACES:
        return None
    # Solo vale el enlace más nuevo
    tokens.filter(TokenRecuperacion.usado.is_(None)).update({TokenRecuperacion.usado: momento})
    token = secrets.token_urlsafe(32)
    db.add(TokenRecuperacion(
        usuario_id=usuario.id, token_hash=_hash(token), creado=momento,
        expira=momento + timedelta(minutes=RECUPERACION_MINUTOS),
    ))
    db.commit()
    # El token va en el fragmento (#): el navegador no lo manda a ningún servidor al abrir la página
    return usuario.email, f"{PORTAL_URL}/#/restablecer?token={token}"


def restablecer_password(db: Session, token: str, password: str) -> None:
    momento = ahora()
    fila = db.query(TokenRecuperacion).filter(TokenRecuperacion.token_hash == _hash(token)).first()
    if fila is None or fila.usado is not None or fila.expira <= momento:
        raise EnlaceInvalido()
    usuario = db.get(Usuario, fila.usuario_id)
    if usuario is None or not usuario.activo:
        raise EnlaceInvalido()
    # Marcado condicional: si llegan dos peticiones con el mismo enlace, solo una gana
    marcados = db.query(TokenRecuperacion).filter(
        TokenRecuperacion.id == fila.id, TokenRecuperacion.usado.is_(None),
    ).update({TokenRecuperacion.usado: momento})
    if marcados != 1:
        db.rollback()
        raise EnlaceInvalido()
    usuario.password_hash = hashear_password(password)
    db.commit()
