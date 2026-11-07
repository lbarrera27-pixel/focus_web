"""
Rutas /api/v1 para clientes: límites de apps y resumen del usuario.

Ejecutar:  pytest -q tests/test_v1.py
"""
import os
import sqlite3
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ.pop("AZURE_SQL_SERVER", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    client.post("/auth/registro", json={"email": "v1@focus.app", "nombre": "V1", "password": "secreto123"})
    token = client.post("/auth/login", json={"email": "v1@focus.app", "password": "secreto123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


TIKTOK = {"paquete": "com.zhiliaoapp.musically", "nombre": "TikTok", "categoria": "SOCIAL",
          "limite_minutos": 30, "limite_aperturas": 10, "nivel": 3}
NETFLIX = {"paquete": "com.netflix.mediaclient", "nombre": "Netflix", "categoria": "STREAMING",
           "limite_minutos": 60, "limite_aperturas": 2, "nivel": 2}


def test_limites_se_guardan_y_se_leen_igual_en_cualquier_cliente(client, auth):
    r = client.put("/api/v1/apps/limits", json={"apps": [TIKTOK, NETFLIX]}, headers=auth)
    assert r.status_code == 200, r.text
    leidos = client.get("/api/v1/apps/limits", headers=auth).json()
    assert [a["nombre"] for a in leidos["apps"]] == ["TikTok", "Netflix"]
    assert leidos["apps"][0]["limite_minutos"] == 30 and leidos["apps"][0]["vigilada"] is True
    assert leidos["version"] is not None
    # Las rutas anteriores también ven los campos nuevos
    assert client.get("/apps", headers=auth).json()[0]["nivel"] == 3


def test_app_que_ya_no_viene_deja_de_vigilarse_sin_borrarse(client, auth):
    r = client.put("/api/v1/apps/limits", json={"apps": [{**TIKTOK, "limite_minutos": 20}]}, headers=auth)
    apps = {a["nombre"]: a for a in r.json()["apps"]}
    assert apps["TikTok"]["limite_minutos"] == 20
    assert apps["Netflix"]["vigilada"] is False


def test_version_vieja_no_pisa_cambios_de_otro_dispositivo(client, auth):
    vieja = "2000-01-01T00:00:00"
    r = client.put("/api/v1/apps/limits", json={"apps": [TIKTOK], "version_base": vieja}, headers=auth)
    assert r.status_code == 409


def test_resumen_con_metricas_y_plan(client, auth):
    client.post("/planes", headers=auth, json={"fecha_inicio": "2026-11-01", "limite_base": 100})
    client.put("/api/v1/apps/limits", json={"apps": [TIKTOK, NETFLIX]}, headers=auth)
    dias = [
        {"fecha": "2026-11-04", "apps": [{"paquete": TIKTOK["paquete"], "minutos": 40, "aperturas": 5}]},
        {"fecha": "2026-11-05", "apps": [{"paquete": TIKTOK["paquete"], "minutos": 50, "aperturas": 6}]},
        {"fecha": "2026-11-06", "apps": [
            {"paquete": TIKTOK["paquete"], "nombre": "TikTok", "minutos": 65, "aperturas": 28},
            {"paquete": NETFLIX["paquete"], "nombre": "Netflix", "minutos": 30, "aperturas": 1},
        ]},
    ]
    assert client.post("/api/v1/metrics/sync", json={"lote_id": "resumen-01", "dias": dias}, headers=auth).status_code == 200

    r = client.get("/api/v1/users/me/summary?fecha=2026-11-06", headers=auth)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["meta_diaria_minutos"] == 100
    assert s["minutos_hoy"] == 95 and s["aperturas_hoy"] == 29
    assert s["apps_en_pausa"] == ["TikTok"]                 # 65 ≥ 30 min; Netflix 30 < 60 y 1 ≤ 2 aperturas
    assert len(s["semana"]) == 7 and s["semana"][-1]["minutos"] == 95
    assert s["dias_con_datos"] == 3
    assert s["racha_dias"] == 3                             # 40, 50 y 95 ≤ 100
    assert s["riesgo"] is None and "ajustes" in s["riesgo_motivo"]


def test_resumen_requiere_identificacion(client):
    assert client.get("/api/v1/users/me/summary").status_code == 422


def test_migracion_agrega_columnas_a_tabla_vieja():
    """En Azure la tabla app ya existía sin las columnas nuevas: el arranque debe agregarlas."""
    from sqlalchemy import create_engine, inspect

    import app.database as database

    viejo = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
    con = sqlite3.connect(viejo)
    con.execute("CREATE TABLE app (id INTEGER PRIMARY KEY, numero INTEGER, usuario_id INTEGER, nombre TEXT, "
                "paquete TEXT, categoria TEXT, limite_aperturas INTEGER)")
    con.execute("INSERT INTO app VALUES (1, 1, 1, 'TikTok', 'com.zhiliaoapp.musically', NULL, 10)")
    con.commit(); con.close()

    original = database.engine
    database.engine = create_engine(f"sqlite:///{viejo}")
    try:
        database._agregar_columnas_nuevas()
        database._agregar_columnas_nuevas()   # idempotente
        columnas = {c["name"] for c in inspect(database.engine).get_columns("app")}
    finally:
        database.engine = original
    assert {"limite_minutos", "nivel", "vigilada", "actualizado"} <= columnas
    fila = sqlite3.connect(viejo).execute("SELECT nivel, vigilada FROM app").fetchone()
    assert fila == (2, 1)
