"""
Recuperación de contraseña con enlace temporal.

Ejecutar:  pytest -q tests/test_recuperacion.py
"""
import os
import tempfile
from datetime import timedelta

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ.pop("AZURE_SQL_SERVER", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.controllers import auth_controller  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import TokenRecuperacion  # noqa: E402
from app.models._comun import ahora  # noqa: E402
from main import app  # noqa: E402

CLAVE_NUEVA = "NuevaClave123"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def enviados(monkeypatch):
    correos = []
    monkeypatch.setattr(auth_controller, "correo_configurado", lambda: True)
    monkeypatch.setattr(auth_controller, "enviar_correo_recuperacion", lambda d, e: correos.append((d, e)))
    return correos


def cuenta(client, email):
    r = client.post("/auth/registro", json={"email": email, "nombre": "R", "password": "secreto123"})
    assert r.status_code == 201, r.text


def pedir_token(client, email, enviados):
    assert client.post("/auth/recuperar", json={"email": email}).status_code == 202
    return enviados[-1][1].split("token=")[1]


def test_cuenta_inexistente_responde_igual_y_no_envia(client, enviados):
    assert client.post("/auth/recuperar", json={"email": "nadie@focus.app"}).status_code == 202
    assert enviados == []


def test_enlace_cambia_la_contrasena_una_sola_vez(client, enviados):
    cuenta(client, "a@focus.app")
    token = pedir_token(client, "a@focus.app", enviados)
    assert enviados[-1][0] == "a@focus.app" and "/#/restablecer?token=" in enviados[-1][1]

    assert client.post("/auth/restablecer", json={"token": token, "password": CLAVE_NUEVA}).status_code == 200
    assert client.post("/auth/login", json={"email": "a@focus.app", "password": CLAVE_NUEVA}).status_code == 200
    assert client.post("/auth/login", json={"email": "a@focus.app", "password": "secreto123"}).status_code == 401
    # Reutilizarlo no sirve
    assert client.post("/auth/restablecer", json={"token": token, "password": "OtraClave123"}).status_code == 400


def test_en_la_base_no_queda_el_token(client, enviados):
    cuenta(client, "b@focus.app")
    token = pedir_token(client, "b@focus.app", enviados)
    with SessionLocal() as db:
        assert db.query(TokenRecuperacion).filter_by(token_hash=token).count() == 0


def test_enlace_caducado(client, enviados):
    cuenta(client, "c@focus.app")
    token = pedir_token(client, "c@focus.app", enviados)
    with SessionLocal() as db:
        db.query(TokenRecuperacion).update({TokenRecuperacion.expira: ahora() - timedelta(minutes=1)})
        db.commit()
    assert client.post("/auth/restablecer", json={"token": token, "password": CLAVE_NUEVA}).status_code == 400


def test_solo_vale_el_enlace_mas_nuevo(client, enviados):
    cuenta(client, "d@focus.app")
    viejo = pedir_token(client, "d@focus.app", enviados)
    nuevo = pedir_token(client, "d@focus.app", enviados)
    assert client.post("/auth/restablecer", json={"token": viejo, "password": CLAVE_NUEVA}).status_code == 400
    assert client.post("/auth/restablecer", json={"token": nuevo, "password": CLAVE_NUEVA}).status_code == 200


def test_limite_de_solicitudes(client, enviados):
    cuenta(client, "e@focus.app")
    for _ in range(5):
        assert client.post("/auth/recuperar", json={"email": "e@focus.app"}).status_code == 202
    assert len(enviados) == 3


def test_validaciones(client, enviados):
    assert client.post("/auth/restablecer", json={"token": "x" * 43, "password": CLAVE_NUEVA}).status_code == 400
    assert client.post("/auth/restablecer", json={"token": "x" * 43, "password": "corta"}).status_code == 422


def test_sin_smtp_no_intenta_enviar(client, monkeypatch):
    llamadas = []
    monkeypatch.setattr(auth_controller, "correo_configurado", lambda: False)
    monkeypatch.setattr(auth_controller, "enviar_correo_recuperacion", lambda d, e: llamadas.append(d))
    cuenta(client, "f@focus.app")
    assert client.post("/auth/recuperar", json={"email": "f@focus.app"}).status_code == 202
    assert llamadas == []
