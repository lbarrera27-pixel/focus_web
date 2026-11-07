"""
Reglas difusas del ajuste semanal del plan de Focus! (inferencia Mamdani).

Entradas (0 a 1):
- adherencia: qué tanto respetó el usuario su meta de la semana.
- pct_ignoradas: proporción de pausas que ignoró esa semana. Si cumplió la meta
  pero ignoró muchas pausas, está "aguantando a la fuerza" y se reduce menos.

Salida: cambio % del límite para la semana siguiente (negativo = reducir).

Pasos: fusificación (funciones trapezoidales) -> inferencia (AND = min,
implicación min) -> agregación (max) -> defusificación por centroide.
Los casos claros dan los mismos valores que las reglas anteriores
(-10, -5, 0, +5); la diferencia es que entre niveles el cambio es gradual
en lugar de saltar de golpe.

La Azure Function (serverless/function_app.py) usa exactamente estas reglas.
"""


def trapecio(x: float, a: float, b: float, c: float, d: float) -> float:
    """Membresía trapezoidal: sube de a a b, vale 1 entre b y c, baja de c a d."""
    if x <= a or x >= d:
        return 0.0
    if x < b:
        return (x - a) / (b - a)
    if x <= c:
        return 1.0
    return (d - x) / (d - c)


def triangulo(x: float, a: float, b: float, c: float) -> float:
    return trapecio(x, a, b, b, c)


# Conjuntos de entrada (los extremos se salen del rango para que 0 y 1 valgan 1).
ADHERENCIA = {
    "baja": (-1.0, -0.5, 0.40, 0.55),
    "regular": (0.40, 0.55, 0.65, 0.80),
    "buena": (0.65, 0.80, 0.85, 0.95),
    "excelente": (0.85, 0.95, 1.5, 2.0),
}
IGNORADAS = {
    "pocas": (-1.0, -0.5, 0.20, 0.45),
    "muchas": (0.25, 0.60, 1.5, 2.0),
}

# Conjuntos de salida: triángulos simétricos, así una sola regla activa da su centro exacto.
CAMBIO = {
    "reducir_mucho": (-15.0, -10.0, -5.0),
    "reducir_poco": (-9.0, -5.0, -1.0),
    "mantener": (-3.0, 0.0, 3.0),
    "relajar": (1.0, 5.0, 9.0),
}
RANGO_CAMBIO = (-15.0, 10.0)
PASO = 0.1

# (adherencia, pausas ignoradas, cambio). None = cualquier valor: con adherencia
# regular o baja las pausas no cambian la decisión, y condicionarlas haría que el
# resultado dejara de ser monótono cuando "pocas" y "muchas" se activan a medias.
REGLAS = [
    ("excelente", "pocas", "reducir_mucho"),
    ("excelente", "muchas", "reducir_poco"),
    ("buena", "pocas", "reducir_poco"),
    ("buena", "muchas", "mantener"),
    ("regular", None, "mantener"),
    ("baja", None, "relajar"),
]


def _acotar(x: float) -> float:
    return min(1.0, max(0.0, x))


def nivel_adherencia(adherencia: float) -> str:
    """Etiqueta con mayor grado de membresía (para el mensaje al usuario)."""
    x = _acotar(adherencia)
    return max(ADHERENCIA, key=lambda nombre: trapecio(x, *ADHERENCIA[nombre]))


def calcular_cambio(adherencia: float, pct_ignoradas: float = 0.0) -> tuple[float, str]:
    adh, ign = _acotar(adherencia), _acotar(pct_ignoradas)
    # Fusificación + fuerza de disparo de cada regla (AND = min)
    fuerzas = [
        (min(trapecio(adh, *ADHERENCIA[a]), trapecio(ign, *IGNORADAS[p]) if p else 1.0), CAMBIO[salida])
        for a, p, salida in REGLAS
    ]
    fuerzas = [(f, conjunto) for f, conjunto in fuerzas if f > 0]
    if not fuerzas:
        return 0.0, nivel_adherencia(adh)
    # Implicación (min), agregación (max) y centroide discreto
    inicio, fin = RANGO_CAMBIO
    num = den = 0.0
    for i in range(round((fin - inicio) / PASO) + 1):
        z = inicio + i * PASO
        mu = max(min(f, triangulo(z, *conjunto)) for f, conjunto in fuerzas)
        num += z * mu
        den += mu
    cambio = round(num / den, 1) if den else 0.0
    return cambio + 0.0, nivel_adherencia(adh)  # + 0.0 evita devolver -0.0


# Sensibilidad que la persona elige en "Editar plan" (se guarda en /configuracion/me, clave "plan").
# Escala las reducciones: suave baja hasta -5 %, normal hasta -10 %, estricta hasta -15 %.
SENSIBILIDAD = {"suave": 0.5, "normal": 1.0, "estricta": 1.5}


def aplicar_preferencias(cambio: float, sensibilidad: str = "normal", permitir_relajar: bool = True,
                         semana_anterior_baja: bool = False) -> float:
    """Ajusta la salida difusa a las preferencias del plan.

    - Reducir: se escala según la sensibilidad.
    - Relajar (+): no se aplica si la persona lo desactivó; con «estricta» solo se relaja
      cuando la semana anterior también tuvo adherencia baja (dos semanas seguidas).
    """
    if cambio > 0:
        if not permitir_relajar or (sensibilidad == "estricta" and not semana_anterior_baja):
            return 0.0
        return cambio
    return round(cambio * SENSIBILIDAD.get(sensibilidad, 1.0), 1) + 0.0

