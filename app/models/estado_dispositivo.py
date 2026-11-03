from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from app.database import Base
from app.models._comun import ahora


class EstadoDispositivo(Base):
    """Último estado que reportó un teléfono vinculado: modelo, versión de la app y batería.

    Es una tabla aparte (una fila por token) para no tocar TOKEN_DISPOSITIVO: create_all
    crea tablas nuevas pero no agrega columnas a las que ya existen en Azure SQL.
    """

    __tablename__ = "estado_dispositivo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_id = Column(Integer, ForeignKey("token_dispositivo.id"), nullable=False, unique=True)
    modelo = Column(String(80), nullable=True)        # "Pixel 7 Pro"
    version_app = Column(String(20), nullable=True)   # "1.8"
    bateria = Column(Integer, nullable=True)          # 0 – 100
    cargando = Column(Boolean, nullable=True)
    fecha = Column(DateTime, nullable=False, default=ahora)   # UTC del último reporte
