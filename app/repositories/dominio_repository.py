from datetime import datetime

from app.models import DominioBloqueado, IntentoSitio
from app.repositories.base import RepositorioPorUsuario


class DominioRepository(RepositorioPorUsuario[DominioBloqueado]):
    modelo = DominioBloqueado

    def obtener_por_nombre(self, usuario_id: int, dominio: str) -> DominioBloqueado | None:
        return self._consulta(usuario_id).filter(DominioBloqueado.dominio == dominio).first()


class IntentoRepository:
    def __init__(self, db):
        self.db = db

    def registrar(self, usuario_id: int, dominio: str, fecha: datetime | None = None) -> IntentoSitio:
        intento = IntentoSitio(usuario_id=usuario_id, dominio=dominio, **({"fecha": fecha} if fecha else {}))
        self.db.add(intento)
        self.db.commit()
        self.db.refresh(intento)
        return intento

    def desde(self, usuario_id: int, desde: datetime) -> list[IntentoSitio]:
        return (self.db.query(IntentoSitio)
                .filter(IntentoSitio.usuario_id == usuario_id, IntentoSitio.fecha >= desde)
                .all())
