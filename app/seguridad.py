"""
Tokens JWT (HS256) para la app Android y el portal web.

    POST /auth/login  ->  {"access_token": "...", "token_type": "bearer", ...}
    Authorization: Bearer <access_token>   en las rutas privadas

La llave se lee de JWT_SECRET (en Azure: Configuración > Variables de entorno).
Sin ella se genera una al azar al arrancar: sirve en local, pero los tokens dejan de valer
al reiniciar el servidor, así que en producción hay que definirla.
"""
import logging
import secrets
from datetime import timedelta

import jwt

from app.config import JWT_DIAS, JWT_SECRET
from app.models._comun import ahora

log = logging.getLogger("focus.seguridad")

ALGORITMO = "HS256"
_llave = JWT_SECRET or secrets.token_urlsafe(48)
if not JWT_SECRET:
    log.warning("JWT_SECRET no está definida: se usa una llave temporal (los tokens no sobreviven a un reinicio)")


class TokenInvalido(Exception):
    pass


def crear_token(usuario_id: int) -> tuple[str, int]:
    """Devuelve (token, segundos de vigencia)."""
    vigencia = timedelta(days=JWT_DIAS)
    emitido = ahora()
    datos = {"sub": str(usuario_id), "iat": emitido, "exp": emitido + vigencia}
    return jwt.encode(datos, _llave, algorithm=ALGORITMO), int(vigencia.total_seconds())


def leer_token(token: str) -> int:
    """Id del usuario del token; TokenInvalido si está alterado, vencido o mal formado."""
    try:
        datos = jwt.decode(token, _llave, algorithms=[ALGORITMO], options={"require": ["sub", "exp"]})
        return int(datos["sub"])
    except (jwt.PyJWTError, ValueError) as e:
        raise TokenInvalido(str(e)) from e
