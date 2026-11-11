"""
Identificación del usuario.

Todas las rutas privadas usan Depends(usuario_actual). Se acepta, en este orden:

1. Authorization: Bearer <JWT>   (lo que usan la app Android y el portal web; ver app/seguridad.py)
2. X-Usuario-Id: <id>            (modo anterior, para Postman y clientes viejos). Se puede apagar
                                 con PERMITIR_X_USUARIO_ID=false cuando todos los clientes usen JWT.

Los números de las rutas son relativos al usuario:
    GET /pausas/7  ->  la 7.ª pausa del usuario que hace la petición
"""
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import PERMITIR_X_USUARIO_ID
from app.database import get_db
from app.models import Usuario
from app.seguridad import TokenInvalido, leer_token

_bearer = HTTPBearer(auto_error=False, description="Token de POST /auth/login")


def _no_autorizado(detalle: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail=detalle, headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_actual(
    credenciales: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    x_usuario_id: Optional[int] = Header(None, alias="X-Usuario-Id", description="Modo anterior (sin JWT)"),
    db: Session = Depends(get_db),
) -> Usuario:
    if credenciales is not None:
        try:
            usuario_id = leer_token(credenciales.credentials)
        except TokenInvalido:
            raise _no_autorizado("Token inválido o vencido; inicia sesión de nuevo")
    elif x_usuario_id is not None and PERMITIR_X_USUARIO_ID:
        usuario_id = x_usuario_id
    elif x_usuario_id is not None:
        raise _no_autorizado("X-Usuario-Id está desactivado; usa Authorization: Bearer")
    else:
        # Mismo código que antes cuando falta la identificación (422), para no romper clientes existentes
        raise HTTPException(status_code=422, detail="Falta Authorization: Bearer <token> (o X-Usuario-Id)")

    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.activo:
        raise _no_autorizado("Usuario no válido o inactivo")
    return usuario
