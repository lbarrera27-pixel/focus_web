"""
Evaluación del Compañero IA (pieza 3) con 24 casos de prueba.

Cada caso es una combinación de adherencia, pausas ignoradas (vía el cambio
difuso) y riesgo. Se llama al LLM real con las mismas instrucciones que usa la
API y se revisa automáticamente cada respuesta:

- largo: cabe en la burbuja de Foqui (<= MAX_CARACTERES)
- sin_markdown: no trae listas, negritas ni encabezados
- numeros: todas las cifras que menciona salen de los datos (no inventa)
- cambio: si menciona el porcentaje de cambio, es el correcto
- tono: no regaña (no usa palabras como "mal", "fallaste", "deberías")

El tono cercano y la empatía se revisan además a mano en el reporte.

Uso (necesita ANTHROPIC_API_KEY; cada corrida hace 24 llamadas al modelo):
    python -m ia.evaluar_companero
Resultados en ia/resultados/companero.json
"""
import json
import re
from pathlib import Path

from app.utils import llm
from app.utils.companero import APERTURA, MAX_CARACTERES, estado_foqui, instrucciones_sistema, limpiar_respuesta
from app.utils.reglas_plan import calcular_cambio

RUTA = Path(__file__).parent / "resultados" / "companero.json"
REGANOS = ("fallaste", "deberías", "mal hecho", "decepcion", "irresponsable", "otra vez fallaste")


def casos() -> list[dict]:
    """4 adherencias x 2 niveles de pausas ignoradas x 3 niveles de riesgo = 24 casos."""
    lista = []
    for adherencia in (1.0, 0.9, 0.6, 0.35):
        for ignoradas in (0.1, 0.7):
            cambio, nivel = calcular_cambio(adherencia, ignoradas)
            for riesgo, p, factor in (("bajo", 0.2, None), ("medio", 0.5, "Pausas ignoradas"),
                                      ("alto", 0.8, "Uso nocturno")):
                lista.append({
                    "nombre": "Dani", "semana": 3, "minutos_semana": round(1470 / max(adherencia, 0.3)),
                    "limite_diario_min": 210.0, "adherencia": adherencia, "nivel_adherencia": nivel,
                    "cambio_pct": cambio, "riesgo_nivel": riesgo, "riesgo_probabilidad": p,
                    "factor_principal": factor, "racha": 3 if adherencia >= 0.9 else 0,
                    "sesion_foco_activa": False,
                })
    return lista


def _numeros(texto: str) -> set[float]:
    return {float(n.replace(",", ".")) for n in re.findall(r"\d+(?:[.,]\d+)?", texto)}


def revisar(ctx: dict, texto: str) -> dict[str, bool]:
    permitidos = {abs(v) for v in ctx.values() if isinstance(v, (int, float)) and not isinstance(v, bool)}
    permitidos |= {round(v * 100) for v in (ctx["adherencia"], ctx["riesgo_probabilidad"])}
    permitidos |= {25.0, 1.0, 2.0, 3.0, 800.0, 911.0, 2000.0}  # sesión de 25 min, conteos chicos y Línea de la Vida
    minutos = ctx["minutos_semana"]
    permitidos |= {minutos // 60, minutos % 60, ctx["limite_diario_min"] // 60, ctx["limite_diario_min"] % 60}
    porcentajes = {float(n.replace(",", ".")) for n in re.findall(r"(\d+(?:[.,]\d+)?)\s*%", texto)}
    return {
        "largo": len(texto) <= MAX_CARACTERES,
        "sin_markdown": not re.search(r"(^|\s)[-*•]\s|\*\*|#", texto),
        "numeros": _numeros(texto) <= permitidos,
        "cambio": porcentajes <= {abs(ctx["cambio_pct"]), round(ctx["riesgo_probabilidad"] * 100),
                                  round(ctx["adherencia"] * 100)},
        "tono": not any(p in texto.lower() for p in REGANOS),
    }


def main():
    resultados = []
    for i, ctx in enumerate(casos(), 1):
        estado = estado_foqui(ctx)
        texto = llm.responder(instrucciones_sistema(ctx, estado), [{"role": "user", "content": APERTURA}])
        if texto is None:
            raise SystemExit("El LLM no respondió: revisa ANTHROPIC_API_KEY y la conexión.")
        texto = limpiar_respuesta(texto)
        checks = revisar(ctx, texto)
        resultados.append({"caso": i, "contexto": ctx, "estado_foqui": estado, "mensaje": texto, "checks": checks})
        print(f"{i:2d} {estado:8s} {'OK ' if all(checks.values()) else 'REV'} {texto}")

    resumen = {nombre: sum(r["checks"][nombre] for r in resultados) / len(resultados)
               for nombre in resultados[0]["checks"]}
    resumen["todos"] = sum(all(r["checks"].values()) for r in resultados) / len(resultados)
    RUTA.parent.mkdir(exist_ok=True)
    RUTA.write_text(json.dumps({"modelo": llm.COMPANERO_MODELO, "resumen": resumen, "casos": resultados},
                               ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nResumen:", {k: f"{v:.0%}" for k, v in resumen.items()})


if __name__ == "__main__":
    main()
