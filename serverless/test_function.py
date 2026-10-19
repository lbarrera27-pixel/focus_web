import json

import azure.functions as func

from function_app import ajuste_semanal


def llamar(metodo="POST", cuerpo=None, params=None):
    req = func.HttpRequest(method=metodo, url="/api/ajuste-semanal", params=params or {},
                           body=json.dumps(cuerpo).encode() if cuerpo is not None else b"")
    fn = ajuste_semanal.build().get_user_function()
    r = fn(req)
    return r.status_code, json.loads(r.get_body())


def test_cumplio_meta():
    s, b = llamar(cuerpo={"uso_real_min": 200, "uso_meta_min": 210, "limite_actual_min": 240})
    assert s == 200 and b["adherencia"] == 1.0 and b["cambio_pct"] == -10.0 and b["nuevo_limite_min"] == 216


def test_se_excedio():
    s, b = llamar(cuerpo={"uso_real_min": 300, "uso_meta_min": 200})
    assert s == 200 and b["adherencia"] == 0.5 and b["nivel"] == "regular" and "nuevo_limite_min" not in b


def test_get_con_query():
    s, b = llamar("GET", params={"uso_real_min": "450", "uso_meta_min": "200"})
    assert s == 200 and b["nivel"] == "baja" and b["cambio_pct"] == 5.0


def test_pausas_ignoradas_reducen_menos():
    s, b = llamar(cuerpo={"uso_real_min": 200, "uso_meta_min": 210, "limite_actual_min": 240, "pct_ignoradas": 0.8})
    assert s == 200 and b["cambio_pct"] == -5.0 and b["nuevo_limite_min"] == 228
    assert b["mensaje"] == "¡Gran semana! Reducimos tu límite un 5 %."


def test_ajuste_gradual():
    # 0.9 de adherencia queda entre "buena" (-5 %) y "excelente" (-10 %)
    s, b = llamar(cuerpo={"uso_real_min": 220, "uso_meta_min": 200})
    assert s == 200 and -10.0 < b["cambio_pct"] < -5.0


def test_errores():
    assert llamar(cuerpo={"uso_real_min": 10, "uso_meta_min": 200, "pct_ignoradas": 1.5})[0] == 400
    assert llamar(cuerpo={"uso_meta_min": 200})[0] == 400
    assert llamar(cuerpo={"uso_real_min": "x", "uso_meta_min": 200})[0] == 400
    assert llamar(cuerpo={"uso_real_min": 10, "uso_meta_min": 0})[0] == 400
