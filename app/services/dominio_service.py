from collections import Counter
from datetime import datetime, timedelta, timezone

from app.config import UTC_OFFSET_HORAS
from app.repositories.dominio_repository import DominioRepository, IntentoRepository
from app.services.base import ServicioPorUsuario
from app.utils.errores import Conflicto


class DominioService(ServicioPorUsuario):
    no_encontrado = "No existe el dominio {numero} para este usuario"
    repo: DominioRepository

    def preparar_creacion(self, usuario_id: int, datos: dict) -> dict:
        datos["dominio"] = datos["dominio"].lower()
        if self.repo.obtener_por_nombre(usuario_id, datos["dominio"]):
            raise Conflicto("Ese dominio ya está en la lista")
        return datos

    def preparar_actualizacion(self, usuario_id: int, obj, cambios: dict) -> dict:
        if "dominio" in cambios:
            cambios["dominio"] = cambios["dominio"].lower()
            otro = self.repo.obtener_por_nombre(usuario_id, cambios["dominio"])
            if otro and otro.id != obj.id:
                raise Conflicto("Ese dominio ya está en la lista")
        return cambios

    # ---------- Intentos de abrir un sitio bloqueado ----------
    def registrar_intento(self, usuario_id: int, numero: int, intentos: IntentoRepository, fecha=None):
        sitio = self.obtener(usuario_id, numero)
        if fecha is not None and fecha.tzinfo is not None:
            fecha = fecha.astimezone(timezone.utc).replace(tzinfo=None)
        return intentos.registrar(usuario_id, sitio.dominio, fecha)

    def resumen_intentos(self, usuario_id: int, dias: int, intentos: IntentoRepository) -> dict:
        """Intentos de los últimos `dias` días (incluye hoy), por sitio y por día local."""
        offset = timedelta(hours=UTC_OFFSET_HORAS)
        hoy_local = (datetime.now(timezone.utc).replace(tzinfo=None) + offset).date()
        inicio_local = hoy_local - timedelta(days=dias - 1)
        desde_utc = datetime.combine(inicio_local, datetime.min.time()) - offset
        lista = intentos.desde(usuario_id, desde_utc)

        numeros = {d.dominio: d.numero for d in self.repo.listar(usuario_id)}
        por_dominio = Counter(i.dominio for i in lista)
        por_dia = Counter((i.fecha + offset).date() for i in lista)
        return {
            "dias": dias,
            "total": len(lista),
            "por_dominio": [{"dominio": d, "numero": numeros.get(d), "intentos": n}
                            for d, n in por_dominio.most_common()],
            "por_dia": [{"fecha": inicio_local + timedelta(days=k), "intentos": por_dia.get(inicio_local + timedelta(days=k), 0)}
                        for k in range(dias)],
        }

