"""
Focus! — API serverless (Azure Functions, modelo de programación v2 de Python).

Ruta:  POST /api/ajuste-semanal   (también acepta GET con query string)

Calcula el ajuste semanal del plan de reducción a partir del uso real y la
meta de la semana. Usa las mismas reglas difusas que la API principal:
reglas_plan.py es una copia exacta de app/utils/reglas_plan.py (una prueba
de tests/ lo verifica), así la app Android puede previsualizar el ajuste
sin guardar nada en la base de datos.

Ejemplo:
    POST https://<function-app>.azurewebsites.net/api/ajuste-semanal
    {"uso_real_min": 230, "uso_meta_min": 210, "limite_actual_min": 240, "pct_ignoradas": 0.3}
"""
import json
import logging

import azure.functions as func

from reglas_plan import calcular_cambio

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

INTRO = {
    "excelente": "¡Gran semana!",
    "buena": "Vas bien.",
    "regular": "Semana regular.",
    "baja": "Fue una semana difícil;",
}


def _mensaje(nivel: str, cambio: float) -> str:
    if cambio <= -0.5:
        accion = f"reducimos tu límite un {abs(cambio):g} %."
    elif cambio >= 0.5:
        accion = f"relajamos tu límite un {cambio:g} %."
    else:
        accion = "mantenemos el mismo límite una semana más."
    if not INTRO[nivel].endswith(";"):
        accion = accion[0].upper() + accion[1:]
    return f"{INTRO[nivel]} {accion}"


def _respuesta(cuerpo: dict, status: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(cuerpo, ensure_ascii=False),
        status_code=status,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )


def _leer_numero(datos: dict, campo: str, obligatorio: bool = True) -> float | None:
    valor = datos.get(campo)
    if valor is None:
        if obligatorio:
            raise ValueError(f"Falta el campo '{campo}'")
        return None
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        raise ValueError(f"'{campo}' debe ser numérico")
    if numero < 0:
        raise ValueError(f"'{campo}' no puede ser negativo")
    return numero


def calcular_ajuste(uso_real: float, uso_meta: float, limite_actual: float | None,
                    pct_ignoradas: float = 0.0) -> dict:
    if uso_meta <= 0:
        raise ValueError("'uso_meta_min' debe ser mayor que 0")
    if pct_ignoradas > 1:
        raise ValueError("'pct_ignoradas' debe estar entre 0 y 1")
    # Adherencia: 1.0 si usó lo mismo o menos que la meta; baja conforme se excede.
    adherencia = 1.0 if uso_real <= uso_meta else max(0.0, 1 - (uso_real - uso_meta) / uso_meta)
    cambio, nivel = calcular_cambio(adherencia, pct_ignoradas)
    resultado = {
        "uso_real_min": uso_real,
        "uso_meta_min": uso_meta,
        "pct_ignoradas": pct_ignoradas,
        "adherencia": round(adherencia, 3),
        "nivel": nivel,
        "cambio_pct": cambio,
        "mensaje": _mensaje(nivel, cambio),
    }
    if limite_actual is not None:
        resultado["limite_actual_min"] = limite_actual
        resultado["nuevo_limite_min"] = round(limite_actual * (1 + cambio / 100))
    return resultado


@app.route(route="ajuste-semanal", methods=["GET", "POST"])
def ajuste_semanal(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Focus! ajuste-semanal: %s", req.method)
    datos = dict(req.params)
    if req.method == "POST":
        try:
            cuerpo = req.get_json()
        except ValueError:
            return _respuesta({"detail": "El cuerpo debe ser JSON válido"}, 400)
        if not isinstance(cuerpo, dict):
            return _respuesta({"detail": "El cuerpo debe ser un objeto JSON"}, 400)
        datos.update(cuerpo)
    try:
        resultado = calcular_ajuste(
            _leer_numero(datos, "uso_real_min"),
            _leer_numero(datos, "uso_meta_min"),
            _leer_numero(datos, "limite_actual_min", obligatorio=False),
            _leer_numero(datos, "pct_ignoradas", obligatorio=False) or 0.0,
        )
    except ValueError as e:
        return _respuesta({"detail": str(e)}, 400)
    return _respuesta(resultado)
