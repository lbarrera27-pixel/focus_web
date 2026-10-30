"""
Generador de usuarios-semana sintéticos para el modelo de riesgo de recaída.

La app aún no tiene usuarios reales, así que se simulan perfiles con rasgos
ocultos que el modelo NO ve:

- disciplina:   qué tan fácil le resulta cumplir su meta.
- motivación:   cambia de semana a semana pero con memoria (sube y baja por rachas).
- impulsividad: qué tanto ignora las pausas.
- nocturnidad:  qué parte de su uso cae entre 22:00 y 06:00.

Cada semana se observan las 7 variables de app/utils/riesgo.py. El ajuste del
plan sale del controlador difuso real (app/utils/reglas_plan.py), y los recortes
fuertes acumulan "fatiga", que empeora las semanas siguientes. La etiqueta es
y = 1 si la semana siguiente no cumple (adherencia < UMBRAL_CUMPLE).
"""
import numpy as np

from app.utils.reglas_plan import calcular_cambio
from app.utils.riesgo import UMBRAL_CUMPLE, VARIABLES

# Parámetros Beta(a, b) de cada rasgo por perfil, y su proporción en la población.
PERFILES = {
    "disciplinado": {"peso": 0.30, "disciplina": (6, 2), "impulsividad": (2, 6), "nocturnidad": (2, 6)},
    "nocturno":     {"peso": 0.25, "disciplina": (3, 3), "impulsividad": (3, 4), "nocturnidad": (6, 2)},
    "impulsivo":    {"peso": 0.25, "disciplina": (3, 4), "impulsividad": (6, 2), "nocturnidad": (3, 4)},
    "irregular":    {"peso": 0.20, "disciplina": (2, 2), "impulsividad": (2, 2), "nocturnidad": (2, 2)},
}

# Dinámica semanal (ver _semanas)
K_DISCIPLINA, K_FATIGA, RUIDO, DESPLAZAMIENTO = 2.6, 1.0, 0.25, 1.0
PERSISTENCIA, M_INICIAL, M_RUIDO = 0.9, 0.8, 0.4


def _sigmoide(z):
    return 1 / (1 + np.exp(-z))


def _rasgos(rng: np.random.Generator) -> tuple[str, dict]:
    nombres = list(PERFILES)
    perfil = nombres[rng.choice(len(nombres), p=[PERFILES[n]["peso"] for n in nombres])]
    params = PERFILES[perfil]
    return perfil, {r: rng.beta(*params[r]) for r in ("disciplina", "impulsividad", "nocturnidad")}


def _semanas(rng: np.random.Generator, rasgos: dict, n_semanas: int) -> list[dict]:
    """Simula n_semanas + 1 semanas observadas de un usuario."""
    d, i, n = rasgos["disciplina"], rasgos["impulsividad"], rasgos["nocturnidad"]
    fatiga, motivacion = 0.0, rng.normal(0, M_INICIAL)
    semanas = []
    for _ in range(n_semanas + 1):
        ignoradas = float(np.clip(0.7 * i - 0.08 * motivacion + 0.25 * fatiga + rng.normal(0, 0.08), 0, 1))
        nocturno = float(np.clip(0.55 * n - 0.04 * motivacion + rng.normal(0, 0.06), 0, 1))
        foco = float(np.clip(0.8 * d + 0.12 * motivacion - 0.25 * fatiga + rng.normal(0, 0.12), 0, 1))
        # Puntaje latente de la semana: rasgos, motivación y fatiga deciden si cumple
        z = (K_DISCIPLINA * d + motivacion - 1.4 * ignoradas - 1.8 * nocturno + 0.8 * foco
             - K_FATIGA * fatiga + rng.normal(0, RUIDO))
        adherencia = float(np.clip(1.25 * _sigmoide(z + DESPLAZAMIENTO), 0, 1))
        cambio, _ = calcular_cambio(adherencia, ignoradas)
        semanas.append({
            "adherencia": adherencia, "pct_ignoradas": ignoradas, "pct_nocturno": nocturno,
            "pct_foco_completadas": foco, "cambio_pct": cambio,
        })
        # Recortar el límite cansa; relajarlo deja descansar un poco
        fatiga = float(np.clip(0.6 * fatiga + 0.05 * max(0.0, -cambio) - 0.02 * max(0.0, cambio), 0, 1.5))
        # La motivación persiste de una semana a otra (AR(1)): por eso la tendencia informa
        motivacion = PERSISTENCIA * motivacion + rng.normal(0, M_RUIDO)
    return semanas


def generar(n_usuarios: int = 2000, semanas: tuple[int, int] = (6, 16), semilla: int = 42):
    """Devuelve (X, y, perfiles, usuarios): una fila por usuario-semana con las columnas de VARIABLES.

    `usuarios` indica a qué usuario pertenece cada fila, para dividir los datos por usuario
    y que sus semanas no queden repartidas entre entrenamiento y prueba.
    """
    rng = np.random.default_rng(semilla)
    filas, etiquetas, perfiles, usuarios = [], [], [], []
    for u in range(n_usuarios):
        perfil, rasgos = _rasgos(rng)
        historia = _semanas(rng, rasgos, int(rng.integers(semanas[0], semanas[1] + 1)))
        racha, anterior = 0, None
        for actual, siguiente in zip(historia, historia[1:]):
            racha = racha + 1 if actual["adherencia"] >= UMBRAL_CUMPLE else 0
            fila = dict(actual)
            fila["tendencia"] = actual["adherencia"] - anterior["adherencia"] if anterior else 0.0
            fila["racha"] = float(racha)
            filas.append([fila[v] for v in VARIABLES])
            etiquetas.append(1 if siguiente["adherencia"] < UMBRAL_CUMPLE else 0)
            perfiles.append(perfil)
            usuarios.append(u)
            anterior = actual
    return np.array(filas), np.array(etiquetas), np.array(perfiles), np.array(usuarios)


if __name__ == "__main__":
    X, y, perfiles, _ = generar()
    print(f"{len(y)} usuarios-semana, {y.mean():.1%} recaídas")
    for p in PERFILES:
        print(f"  {p:<13} {(perfiles == p).sum():>6} filas, {y[perfiles == p].mean():.1%} recaídas")
    for j, v in enumerate(VARIABLES):
        print(f"  {v:<21} media {X[:, j].mean():7.3f}  desv {X[:, j].std():6.3f}")
