from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.models._comun import DelUsuarioMixin, ahora, fk_usuario


class TokenDispositivo(DelUsuarioMixin, Base):
    """Token de notificaciones push (p. ej. Firebase Cloud Messaging) de un dispositivo."""

    __tablename__ = "token_dispositivo"
    __table_args__ = (DelUsuarioMixin.restriccion_numero("token_dispositivo"),)

    usuario_id = fk_usuario()
    token = Column(String(512), nullable=False, unique=True)
    plataforma = Column(String(20), nullable=False, default="android")
    fecha_registro = Column(DateTime, nullable=False, default=ahora)
    activo = Column(Boolean, nullable=False, default=True)

    # Último estado reportado por el teléfono (tabla ESTADO_DISPOSITIVO); se borra junto con el token
    estado = relationship("EstadoDispositivo", uselist=False, lazy="joined", cascade="all, delete-orphan")
