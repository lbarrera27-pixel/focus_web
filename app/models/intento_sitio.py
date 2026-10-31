from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String

from app.database import Base
from app.models._comun import ahora


class IntentoSitio(Base):
    """Cada vez que el usuario intenta abrir un sitio bloqueado en el navegador del teléfono.

    Guarda el nombre del sitio (no una llave a DOMINIO_BLOQUEADO) para que el historial
    se conserve aunque el sitio se quite de la lista.
    """

    __tablename__ = "intento_sitio"
    __table_args__ = (Index("ix_intento_sitio_usuario_fecha", "usuario_id", "fecha"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuario.id"), nullable=False)
    dominio = Column(String(255), nullable=False)
    fecha = Column(DateTime, nullable=False, default=ahora)   # UTC
