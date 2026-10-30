"""
Regresión logística desde cero con NumPy (sin scikit-learn).

    p = sigmoide(X w + b)
    J = -(1/m) Σ [y log p + (1-y) log(1-p)] + (λ / 2m) ||w||²
    w <- w - α ((1/m) Xᵀ(p - y) + (λ/m) w)
    b <- b - α (1/m) Σ (p - y)

Descenso por gradiente por lotes completos; el sesgo b no se regulariza.
"""
import numpy as np

EPS = 1e-12  # evita log(0)


def sigmoide(z: np.ndarray) -> np.ndarray:
    # Partir por signo evita overflow de exp con |z| grandes
    salida = np.empty_like(z, dtype=float)
    pos = z >= 0
    salida[pos] = 1 / (1 + np.exp(-z[pos]))
    e = np.exp(z[~pos])
    salida[~pos] = e / (1 + e)
    return salida


def costo(X: np.ndarray, y: np.ndarray, w: np.ndarray, b: float, lam: float) -> float:
    m = len(y)
    p = np.clip(sigmoide(X @ w + b), EPS, 1 - EPS)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)) + lam / (2 * m) * (w @ w))


def gradientes(X: np.ndarray, y: np.ndarray, w: np.ndarray, b: float, lam: float) -> tuple[np.ndarray, float]:
    m = len(y)
    error = sigmoide(X @ w + b) - y
    return X.T @ error / m + lam * w / m, float(np.mean(error))


def entrenar(X: np.ndarray, y: np.ndarray, alfa: float = 0.1, lam: float = 0.01,
             epocas: int = 2000) -> tuple[np.ndarray, float, list[float]]:
    """Devuelve (w, b, historial del costo por época)."""
    w, b = np.zeros(X.shape[1]), 0.0
    historial = []
    for _ in range(epocas):
        dw, db = gradientes(X, y, w, b, lam)
        w -= alfa * dw
        b -= alfa * db
        historial.append(costo(X, y, w, b, lam))
    return w, b, historial


def predecir_proba(X: np.ndarray, w: np.ndarray, b: float) -> np.ndarray:
    return sigmoide(X @ w + b)


class Normalizador:
    """Estandarización z = (x - media) / desviación con estadísticas del entrenamiento."""

    def ajustar(self, X: np.ndarray) -> "Normalizador":
        self.media = X.mean(axis=0)
        self.desviacion = X.std(axis=0)
        self.desviacion[self.desviacion == 0] = 1.0
        return self

    def transformar(self, X: np.ndarray) -> np.ndarray:
        return (X - self.media) / self.desviacion
