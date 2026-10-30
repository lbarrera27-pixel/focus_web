"""Pruebas del Compañero IA sin llamar al LLM (estado de Foqui, respaldo y limpieza)."""
import json

import pytest

from app.utils.companero import (
    ESTADOS, MAX_CARACTERES, estado_foqui, instrucciones_sistema,
    limpiar_respuesta, mensaje_respaldo,
)


@pytest.mark.parametrize("ctx, esperado", [
    ({"sesion_foco_activa": True, "adherencia": 0.3, "riesgo_nivel": "alto"}, "Enfocado"),
    ({"adherencia": 0.95, "riesgo_nivel": "alto"}, "Cansado"),
    ({"adherencia": 0.4, "riesgo_nivel": "bajo"}, "Cansado"),
    ({"adherencia": 0.95, "riesgo_nivel": "bajo"}, "Feliz"),
    ({"adherencia": 0.95, "riesgo_nivel": "medio"}, "Atenta"),
    ({"adherencia": 0.7, "riesgo_nivel": "bajo", "cambio_pct": 2.3}, "Atenta"),
    ({"adherencia": 0.7, "riesgo_nivel": "bajo", "cambio_pct": -2.3}, "Normal"),
    ({}, "Normal"),
])
def test_estado_foqui(ctx, esperado):
    assert estado_foqui(ctx) == esperado


def test_respaldo_para_cada_estado_usa_los_numeros():
    ctx = {"nombre": "Dani", "adherencia": 0.9, "cambio_pct": -7.9, "racha": 3}
    for estado in ESTADOS:
        texto = mensaje_respaldo(ctx, estado)
        assert "Dani" in texto and len(texto) <= MAX_CARACTERES
    assert "baja 7.9 %" in mensaje_respaldo(ctx, "Feliz")
    assert "3 semanas" in mensaje_respaldo(ctx, "Feliz")
    assert "se relaja 5 %" in mensaje_respaldo({**ctx, "cambio_pct": 5.0}, "Cansado")


def test_respaldo_sin_plan():
    assert "primera semana" in mensaje_respaldo({"nombre": "Dani"}, "Normal")


def test_instrucciones_llevan_solo_datos_agregados():
    ctx = {"nombre": "Dani", "adherencia": 0.9, "cambio_pct": -5.0}
    texto = instrucciones_sistema(ctx, "Feliz")
    datos = json.loads(texto.split("DATOS_DEL_USUARIO:\n", 1)[1])
    assert datos == {**ctx, "estado_foqui": "Feliz"}


def test_limpiar_respuesta():
    assert limpiar_respuesta("  **¡Hola!**  \n\n ## Vas bien.  ") == "¡Hola! Vas bien."
    assert limpiar_respuesta("   ") is None
    largo = limpiar_respuesta("Una oración corta. " * 60)
    assert len(largo) <= MAX_CARACTERES and largo.endswith(".")

