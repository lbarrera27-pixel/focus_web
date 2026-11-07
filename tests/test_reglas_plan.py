"""Pruebas del controlador difuso del ajuste semanal (app/utils/reglas_plan.py)."""
from pathlib import Path

import pytest

from app.utils.reglas_plan import aplicar_preferencias, calcular_cambio

RAIZ = Path(__file__).resolve().parent.parent
ADHERENCIAS = [i / 100 for i in range(101)]


@pytest.mark.parametrize("adherencia, cambio, nivel", [
    (1.0, -10.0, "excelente"),
    (0.82, -5.0, "buena"),
    (0.60, 0.0, "regular"),
    (0.20, 5.0, "baja"),
])
def test_casos_claros_conservan_las_reglas_anteriores(adherencia, cambio, nivel):
    assert calcular_cambio(adherencia) == (cambio, nivel)


@pytest.mark.parametrize("pct_ignoradas", [0.0, 0.3, 0.7, 1.0])
def test_mas_adherencia_nunca_relaja_mas(pct_ignoradas):
    cambios = [calcular_cambio(a, pct_ignoradas)[0] for a in ADHERENCIAS]
    assert all(siguiente <= actual for actual, siguiente in zip(cambios, cambios[1:]))


@pytest.mark.parametrize("pct_ignoradas", [0.0, 0.7])
def test_sin_saltos_bruscos(pct_ignoradas):
    # Con las reglas nítidas 0.89 -> -5 % y 0.90 -> -10 %; ahora el cambio es gradual.
    cambios = [calcular_cambio(a, pct_ignoradas)[0] for a in ADHERENCIAS]
    assert max(abs(b - a) for a, b in zip(cambios, cambios[1:])) <= 1.0


def test_ignorar_pausas_reduce_menos():
    for adherencia in ADHERENCIAS:
        cambios = [calcular_cambio(adherencia, i / 10)[0] for i in range(11)]
        # tolerancia de 0.1: la resolución del centroide redondeado
        assert all(siguiente >= actual - 0.1 for actual, siguiente in zip(cambios, cambios[1:]))
    assert calcular_cambio(1.0, 0.0)[0] == -10.0
    assert calcular_cambio(1.0, 0.8)[0] == -5.0


def test_rango_y_valores_fuera_de_rango():
    for adherencia in ADHERENCIAS:
        for ignoradas in (0.0, 0.5, 1.0):
            assert -10.0 <= calcular_cambio(adherencia, ignoradas)[0] <= 5.0
    assert calcular_cambio(1.7) == calcular_cambio(1.0)
    assert calcular_cambio(-0.3, -1) == calcular_cambio(0.0, 0.0)


def test_la_funcion_serverless_usa_las_mismas_reglas():
    original = (RAIZ / "app" / "utils" / "reglas_plan.py").read_bytes()
    copia = (RAIZ / "serverless" / "reglas_plan.py").read_bytes()
    assert copia == original, "Copia app/utils/reglas_plan.py a serverless/reglas_plan.py"


@pytest.mark.parametrize("cambio, prefs, esperado", [
    (-10.0, {}, -10.0),                                            # normal: igual que las reglas
    (-10.0, {"sensibilidad": "suave"}, -5.0),
    (-10.0, {"sensibilidad": "estricta"}, -15.0),
    (5.0, {"permitir_relajar": False}, 0.0),                       # no relaja si se desactivó
    (5.0, {"sensibilidad": "estricta"}, 0.0),                      # estricta: una semana mala no basta
    (5.0, {"sensibilidad": "estricta", "semana_anterior_baja": True}, 5.0),
    (5.0, {"sensibilidad": "suave"}, 5.0),
])
def test_preferencias_del_plan(cambio, prefs, esperado):
    assert aplicar_preferencias(cambio, **prefs) == esperado

