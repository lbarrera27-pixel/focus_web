"""Pruebas del modelo de riesgo de recaída (app/utils/riesgo.py e ia/)."""
import pytest

from app.utils.riesgo import VARIABLES, cargar_modelo, nivel, predecir

np = pytest.importorskip("numpy")

from ia import metricas  # noqa: E402
from ia.generador import generar  # noqa: E402
from ia.regresion_logistica import Normalizador, costo, entrenar, gradientes, predecir_proba  # noqa: E402

PROMEDIO = dict(zip(VARIABLES, cargar_modelo()["media"]))


@pytest.fixture(scope="module")
def datos():
    X, y, _, _ = generar(n_usuarios=150, semilla=7)
    return Normalizador().ajustar(X).transformar(X), y


# ---------- Modelo guardado e inferencia de la API ----------
def test_modelo_guardado_usa_las_variables_en_orden():
    modelo = cargar_modelo()
    assert modelo["variables"] == VARIABLES
    assert len(modelo["w"]) == len(modelo["media"]) == len(modelo["desviacion"]) == len(VARIABLES)
    assert 0 < modelo["umbral"] < 1


def test_niveles():
    assert nivel(0.10, 0.33) == "bajo"
    assert nivel(0.40, 0.33) == "medio"
    assert nivel(0.75, 0.33) == "alto"


def test_inferencia_en_python_puro_igual_a_numpy():
    modelo = cargar_modelo()
    X, _, _, _ = generar(n_usuarios=20, semilla=3)
    Z = (X - np.array(modelo["media"])) / np.array(modelo["desviacion"])
    esperadas = predecir_proba(Z, np.array(modelo["w"]), modelo["b"])
    for fila, p in zip(X, esperadas):
        assert predecir(dict(zip(VARIABLES, fila)))["probabilidad"] == pytest.approx(p, abs=1e-4)


@pytest.mark.parametrize("variable, sube", [
    ("pct_ignoradas", True), ("pct_nocturno", True),
    ("pct_foco_completadas", False), ("adherencia", False),
])
def test_direccion_de_los_factores(variable, sube):
    bajo = predecir({**PROMEDIO, variable: 0.1})["probabilidad"]
    alto = predecir({**PROMEDIO, variable: 0.9})["probabilidad"]
    assert (alto > bajo) is sube


def test_factores_ordenados_por_peso():
    factores = predecir({**PROMEDIO, "pct_ignoradas": 0.95})["factores"]
    assert factores[0]["variable"] == "pct_ignoradas" and factores[0]["efecto"] == "sube"
    pesos = [abs(f["contribucion"]) for f in factores]
    assert pesos == sorted(pesos, reverse=True) and len(factores) == len(VARIABLES)


# ---------- Regresión logística desde cero ----------
def test_gradiente_analitico_igual_al_numerico(datos):
    X, y = datos
    rng = np.random.default_rng(0)
    w, b, lam, h = rng.normal(size=X.shape[1]), 0.3, 5.0, 1e-6
    dw, db = gradientes(X, y, w, b, lam)
    for j in range(len(w)):
        e = np.zeros_like(w)
        e[j] = h
        numerico = (costo(X, y, w + e, b, lam) - costo(X, y, w - e, b, lam)) / (2 * h)
        assert dw[j] == pytest.approx(numerico, abs=1e-6)
    assert db == pytest.approx((costo(X, y, w, b + h, lam) - costo(X, y, w, b - h, lam)) / (2 * h), abs=1e-6)


def test_el_costo_baja_en_cada_epoca(datos):
    X, y = datos
    _, _, historial = entrenar(X, y, alfa=0.3, lam=1.0, epocas=300)
    assert all(b <= a + 1e-12 for a, b in zip(historial, historial[1:]))
    assert historial[-1] < np.log(2)  # mejor que p = 0.5 para todos


def test_coeficientes_iguales_a_sklearn(datos):
    sk = pytest.importorskip("sklearn.linear_model")
    X, y = datos
    lam = 1.0
    w, b, _ = entrenar(X, y, alfa=1.0, lam=lam, epocas=5000)
    modelo = sk.LogisticRegression(C=1 / lam, tol=1e-10, max_iter=10000).fit(X, y)
    assert np.allclose(w, modelo.coef_[0], atol=1e-3)
    assert b == pytest.approx(modelo.intercept_[0], abs=1e-3)


# ---------- Métricas ----------
def test_metricas_iguales_a_sklearn(datos):
    skm = pytest.importorskip("sklearn.metrics")
    X, y = datos
    w, b, _ = entrenar(X, y, epocas=500)
    p = predecir_proba(X, w, b)
    r = metricas.evaluar(y, p, 0.4)
    pred = (p >= 0.4).astype(int)
    assert r["auc_roc"] == pytest.approx(skm.roc_auc_score(y, p))
    assert r["precision"] == pytest.approx(skm.precision_score(y, pred))
    assert r["recall"] == pytest.approx(skm.recall_score(y, pred))
    assert r["f1"] == pytest.approx(skm.f1_score(y, pred))
    vn, fp, fn, vp = skm.confusion_matrix(y, pred).ravel()
    assert r["matriz_confusion"] == {"vp": vp, "fp": fp, "fn": fn, "vn": vn}


def test_auc_con_empates():
    y = np.array([0, 1, 0, 1])
    assert metricas.auc_roc(y, np.array([0.5, 0.5, 0.5, 0.5])) == 0.5
    assert metricas.auc_roc(y, np.array([0.1, 0.9, 0.2, 0.8])) == 1.0


# ---------- Generador ----------
def test_generador_reproducible_y_balanceado():
    X1, y1, perfiles, usuarios = generar(n_usuarios=60, semilla=11)
    X2, y2, _, _ = generar(n_usuarios=60, semilla=11)
    assert np.array_equal(X1, X2) and np.array_equal(y1, y2)
    assert X1.shape[1] == len(VARIABLES) and len(y1) == len(perfiles) == len(usuarios)
    assert 0.2 < y1.mean() < 0.6
    proporciones = X1[:, [VARIABLES.index(v) for v in ("adherencia", "pct_ignoradas", "pct_nocturno")]]
    assert proporciones.min() >= 0 and proporciones.max() <= 1
