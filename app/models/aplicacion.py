from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.database import Base
from app.models._comun import DelUsuarioMixin, ahora, fk_usuario


class App(DelUsuarioMixin, Base):
    """Aplicación del teléfono que el usuario quiere limitar."""

    __tablename__ = "app"
    __table_args__ = (DelUsuarioMixin.restriccion_numero("app"),)

    usuario_id = fk_usuario()
    nombre = Column(String(120), nullable=False)
    paquete = Column(String(255), nullable=False)
    categoria = Column(String(60), nullable=True)
    limite_aperturas = Column(Integer, nullable=False, default=10)
    # Lo que la app Android necesita para bloquear (antes solo vivía en el teléfono)
    limite_minutos = Column(Integer, nullable=True)                 # minutos al día; null = sin límite de tiempo
    nivel = Column(Integer, nullable=False, default=2)              # fricción 1..3 (pausa de 5 / 10 / 20 s)
    vigilada = Column(Boolean, nullable=False, default=True)        # interruptor de "Mis apps"
    actualizado = Column(DateTime, nullable=False, default=ahora, onupdate=ahora)
