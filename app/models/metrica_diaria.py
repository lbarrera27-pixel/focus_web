from sqlalchemy import Column, Date, DateTime, Integer, String, UniqueConstraint

from app.database import Base
from app.models._comun import ahora, fk_usuario


class MetricaDiaria(Base):
    """Uso total de una app en un día (lo que mide UsageStatsManager en el teléfono).

    Una fila por usuario + día + paquete: la app reenvía el día completo en cada sincronización
    y la fila se actualiza (idempotente), así un lote repetido o reintentado no duplica nada.
    El "día" de FOCUS! empieza a las 06:00 hora local del teléfono.
    """

    __tablename__ = "metrica_diaria"
    __table_args__ = (UniqueConstraint("usuario_id", "fecha", "paquete", name="uq_metrica_usuario_fecha_paquete"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = fk_usuario()
    fecha = Column(Date, nullable=False, index=True)
    paquete = Column(String(255), nullable=False)
    nombre = Column(String(120), nullable=True)
    minutos = Column(Integer, nullable=False)
    aperturas = Column(Integer, nullable=False)
    actualizado = Column(DateTime, nullable=False, default=ahora, onupdate=ahora)
