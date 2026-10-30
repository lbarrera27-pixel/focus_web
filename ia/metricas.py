"""Métricas de clasificación binaria, programadas a mano con NumPy."""
import numpy as np


def matriz_confusion(y: np.ndarray, pred: np.ndarray) -> dict[str, int]:
    return {
        "vp": int(np.sum((pred == 1) & (y == 1))),
        "fp": int(np.sum((pred == 1) & (y == 0))),
        "fn": int(np.sum((pred == 0) & (y == 1))),
        "vn": int(np.sum((pred == 0) & (y == 0))),
    }


def _dividir(a: float, b: float) -> float:
    return a / b if b else 0.0


def f_beta(precision: float, recall: float, beta: float = 1.0) -> float:
    """F1 con beta=1; beta=2 le da más peso al recall."""
    return _dividir((1 + beta**2) * precision * recall, beta**2 * precision + recall)


def auc_roc(y: np.ndarray, p: np.ndarray) -> float:
    """Área bajo la ROC = probabilidad de que un positivo tenga más p que un negativo
    (estadístico de Mann-Whitney con rangos promedio para los empates)."""
    orden = np.argsort(p, kind="mergesort")
    rangos = np.empty(len(p))
    p_ord = p[orden]
    i = 0
    while i < len(p):
        j = i
        while j + 1 < len(p) and p_ord[j + 1] == p_ord[i]:
            j += 1
        rangos[orden[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    n_pos, n_neg = int(y.sum()), int(len(y) - y.sum())
    return float((rangos[y == 1].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def curva_roc(y: np.ndarray, p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(tasa de falsos positivos, tasa de verdaderos positivos) para cada umbral."""
    umbrales = np.r_[np.inf, np.sort(np.unique(p))[::-1]]
    n_pos, n_neg = y.sum(), len(y) - y.sum()
    tfp = np.array([np.sum((p >= u) & (y == 0)) / n_neg for u in umbrales])
    tvp = np.array([np.sum((p >= u) & (y == 1)) / n_pos for u in umbrales])
    return tfp, tvp


def evaluar(y: np.ndarray, p: np.ndarray, umbral: float = 0.5) -> dict:
    pred = (p >= umbral).astype(int)
    mc = matriz_confusion(y, pred)
    precision = _dividir(mc["vp"], mc["vp"] + mc["fp"])
    recall = _dividir(mc["vp"], mc["vp"] + mc["fn"])
    return {
        "exactitud": (mc["vp"] + mc["vn"]) / len(y),
        "precision": precision,
        "recall": recall,
        "f1": f_beta(precision, recall),
        "f2": f_beta(precision, recall, 2.0),
        "auc_roc": auc_roc(y, p),
        "matriz_confusion": mc,
    }
