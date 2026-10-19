from datetime import datetime

from app.models import Pausa
from app.repositories.base import RepositorioPorUsuario


class PausaRepository(RepositorioPorUsuario[Pausa]):
    modelo = Pausa

    def contar_entre(self, usuario_id: int, desde: datetime, hasta: datetime) -> tuple[int, int]:
        """(total, ignoradas) de las pausas con fecha en [desde, hasta)."""
        pausas = self._consulta(usuario_id).filter(Pausa.fecha >= desde, Pausa.fecha < hasta)
        return pausas.count(), pausas.filter(Pausa.ignorada.is_(True)).count()
