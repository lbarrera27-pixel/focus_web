"""
JWT y sincronización por lotes (POST /api/v1/metrics/sync).

Ejecutar:  pytest -q tests/test_metricas.py
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ.pop("AZURE_SQL_SERVER", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import MetricaDiaria  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def token(client):
    client.post("/auth/registro", json={"email": "metricas@focus.app", "nombre": "Métricas", "password": "secreto123"})
    r = client.post("/auth/login", json={"email": "metricas@focus.app", "password": "secreto123"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token_type"] == "bearer" and body["expira_en"] > 0
    return {"Authorization": f"Bearer {body['access_token']}"}


def lote(lote_id="lote-0001", minutos=42, **extra):
    return {
        "lote_id": lote_id,
        "dispositivo": "Pixel · Android 16",
        "dias": [
            {"fecha": "2026-11-05", "apps": [
                {"paquete": "com.instagram.android", "nombre": "Instagram", "minutos": minutos, "aperturas": 17},
                {"paquete": "com.zhiliaoapp.musically", "nombre": "TikTok", "minutos": 30, "aperturas": 9},
            ]},
        ],
        **extra,
    }


def test_jwt_da_acceso_a_rutas_privadas(client, token):
    assert client.get("/apps", headers=token).status_code == 200
    assert client.get("/apps", headers={"Authorization": "Bearer no-es-un-token"}).status_code == 401


def test_sync_inserta_y_es_idempotente(client, token):
    r = client.post("/api/v1/metrics/sync", json=lote(), headers=token)
    assert r.status_code == 200, r.text
    assert r.json() == {"lote_id": "lote-0001", "dias": 1, "insertadas": 2, "actualizadas": 0}

    # Reenviar el mismo día actualiza, no duplica
    r = client.post("/api/v1/metrics/sync", json=lote("lote-0002", minutos=55), headers=token)
    assert r.json()["insertadas"] == 0 and r.json()["actualizadas"] == 2
    with SessionLocal() as db:
        filas = db.query(MetricaDiaria).filter_by(paquete="com.instagram.android").all()
        assert len(filas) == 1 and filas[0].minutos == 55


def test_sync_valida_el_lote(client, token):
    malo = lote()
    malo["dias"][0]["apps"][0]["minutos"] = 2000  # más de 24 h
    assert client.post("/api/v1/metrics/sync", json=malo, headers=token).status_code == 422

    malo = lote()
    malo["dias"][0]["apps"][1]["paquete"] = "com.instagram.android"  # repetido
    assert client.post("/api/v1/metrics/sync", json=malo, headers=token).status_code == 422

    malo = lote()
    malo["dias"][0]["fecha"] = "2099-01-01"
    assert client.post("/api/v1/metrics/sync", json=malo, headers=token).status_code == 422

    assert client.post("/api/v1/metrics/sync", json=lote()).status_code == 422  # sin identificación
