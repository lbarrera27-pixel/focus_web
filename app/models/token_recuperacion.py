from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base
from app.models._comun import ahora, fk_usuario


class TokenRecuperacion(Base):
    """Enlace temporal para crear una contraseña nueva.

    Solo se guarda el hash SHA-256 del token: quien lea la base de datos no puede usar los enlaces.
    """

    __tablename__ = "token_recuperacion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = fk_usuario()
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    creado = Column(DateTime, nullable=False, default=ahora)
    expira = Column(DateTime, nullable=False)
    usado = Column(DateTime, nullable=True)     # también se marca al pedir un enlace más nuevo
