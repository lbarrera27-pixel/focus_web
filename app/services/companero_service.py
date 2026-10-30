"""
Compañero IA (pieza 3): junta lo que decidieron la lógica difusa y la regresión
logística y se lo da al LLM para que Foqui lo explique.
"""
from datetime import timedelta

from app.models._comun import ahora
from app.repositories.ajuste_repository import AjusteRepository
from app.repositories.evento_repository import EventoRepository
from app.repositories.plan_repository import PlanRepository
from app.repositories.sesion_repository import SesionRepository
from app.services.plan_service import rango_semana
from app.services.riesgo_service import RiesgoService
from app.utils import llm
from app.utils.companero import (
    APERTURA, estado_foqui, instrucciones_sistema, limpiar_respuesta, mensaje_respaldo,
)
from app.utils.reglas_plan import nivel_adherencia


class CompaneroService:
    def __init__(self, db):
        self.planes = PlanRepository(db)
        self.ajustes = AjusteRepository(db)
        self.eventos = EventoRepository(db)
        self.sesiones = SesionRepository(db)
        self.riesgo = RiesgoService(db)

    def _sesion_activa(self, usuario_id: int) -> bool:
        momento = ahora()
        return any(
            not s.completada and s.fin is None and s.inicio + timedelta(minutes=s.duracion_min) > momento
            for s in self.sesiones.listar(usuario_id, completada=False)[-3:]
        )

    def contexto(self, usuario) -> dict:
        """Datos agregados de la última semana con ajuste. Nada de apps ni horarios."""
        ctx = {"nombre": (usuario.seudonimo or usuario.nombre).split()[0],
               "sesion_foco_activa": self._sesion_activa(usuario.id)}
        plan = self.planes.activo(usuario.id)
        ajustes = self.ajustes.listar(plan) if plan else []
        if not ajustes:
            return ctx
        actual = ajustes[-1]
        _, segundos = self.eventos.resumen(usuario.id, *rango_semana(plan, actual.semana))
        limite = plan.limite_base
        for ajuste in ajustes:
            limite *= 1 + ajuste.cambio_pct / 100
        riesgo = self.riesgo.calcular(usuario.id)
        sube = [f for f in riesgo["factores"] if f["efecto"] == "sube"]
        ctx.update({
            "semana": actual.semana,
            "minutos_semana": round(segundos / 60, 1),
            "limite_diario_min": round(limite, 1),
            "adherencia": round(actual.adherencia, 2),
            "nivel_adherencia": nivel_adherencia(actual.adherencia),
            "cambio_pct": actual.cambio_pct,
            "riesgo_nivel": riesgo["nivel"],
            "riesgo_probabilidad": round(riesgo["probabilidad"], 2),
            "factor_principal": sube[0]["descripcion"] if sube else None,
            "racha": int(riesgo["variables"]["racha"]),
        })
        return ctx

    def responder(self, usuario, mensaje: str | None, historial: list) -> dict:
        ctx = self.contexto(usuario)
        estado = estado_foqui(ctx)
        mensajes = [{"role": "user" if t.rol == "usuario" else "assistant", "content": t.texto} for t in historial]
        # El primer turno que ve el LLM siempre es del usuario
        while mensajes and mensajes[0]["role"] != "user":
            mensajes.pop(0)
        mensajes.append({"role": "user", "content": (mensaje or "").strip() or APERTURA})

        texto = llm.responder(instrucciones_sistema(ctx, estado), mensajes)
        texto = limpiar_respuesta(texto) if texto else None
        return {
            "mensaje": texto or mensaje_respaldo(ctx, estado),
            "estado_foqui": estado,
            "fuente": "llm" if texto else "respaldo",
            "contexto": ctx,
        }
