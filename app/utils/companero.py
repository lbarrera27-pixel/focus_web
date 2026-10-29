"""
Compañero IA de Focus! (pieza 3 de la IA): Foqui, la mascota, con voz de un LLM.

Reparto de responsabilidades:
- La lógica difusa decide el ajuste y la regresión logística estima el riesgo.
- Este módulo decide el ESTADO de Foqui con reglas fijas (no el LLM), para que
  sea consistente con los números, y arma las instrucciones del sistema.
- El LLM solo pone en palabras esos números. Si falla, se usa un mensaje
  predefinido según el estado y la app sigue funcionando.

Privacidad: el LLM recibe solo datos agregados de la semana (minutos totales,
adherencia, cambio difuso, nivel de riesgo, racha). Nunca nombres de apps,
horarios ni eventos individuales.

Los estados son los mismos de FoquiEstado en la app (ui/components/Foqui.kt).
"""
import json

ESTADOS = ("Normal", "Atenta", "Enfocado", "Feliz", "Cansado")

# Largo máximo del mensaje que se muestra en la burbuja de Foqui.
MAX_CARACTERES = 600

INSTRUCCIONES = """Eres Foqui, la mascota de FOCUS!, una app que ayuda a reducir poco a poco el tiempo en el celular.
FOCUS! no prohíbe: agrega fricción a las apps que distraen y baja el límite diario cada semana con un plan.

Cómo hablas:
- En español de México, cercano, cálido y sin juzgar. Tuteas al usuario.
- Breve: máximo 3 oraciones (unas 60 palabras). Sin listas, sin markdown, a lo mucho un emoji.
- Celebra los avances concretos y, si algo va mal, propones UNA acción pequeña (una sesión de Modo Foco, cuidar la noche, dejar el celular lejos al dormir).

Reglas:
- Usa solo los números de DATOS_DEL_USUARIO. No inventes cifras, apps, horarios ni días.
- No decides el plan: el ajuste del límite lo calcula el sistema difuso y el riesgo lo calcula un modelo. Tú solo los explicas.
- Si cambio_pct es negativo, el límite baja ese porcentaje; si es positivo, se relaja; si es 0, se mantiene.
- Si el riesgo es "alto", da ánimo y una sugerencia concreta, sin asustar ni regañar.
- No das consejos médicos ni psicológicos. Si el usuario expresa malestar serio (tristeza profunda, ansiedad fuerte, ideas de hacerse daño), responde con empatía y sugiérele buscar apoyo de una persona de confianza o de un profesional; en México puede llamar a la Línea de la Vida: 800 911 2000.
- Si te preguntan algo fuera de FOCUS! y del bienestar digital, responde en una frase y regresa amablemente al tema."""

APERTURA = "(El usuario acaba de abrir el chat con Foqui. Salúdalo por su nombre y cuéntale en breve cómo va su semana.)"


def estado_foqui(ctx: dict) -> str:
    """Estado de ánimo de Foqui a partir de los números (mismo criterio siempre)."""
    adherencia = ctx.get("adherencia")
    riesgo = ctx.get("riesgo_nivel")
    if ctx.get("sesion_foco_activa"):
        return "Enfocado"
    if riesgo == "alto" or (adherencia is not None and adherencia < 0.5):
        return "Cansado"
    if adherencia is not None and adherencia >= 0.9 and riesgo in (None, "bajo"):
        return "Feliz"
    if riesgo == "medio" or (ctx.get("cambio_pct") or 0) > 0:
        return "Atenta"
    return "Normal"


def _explicar_cambio(cambio: float) -> str:
    if cambio < 0:
        return f"tu límite baja {abs(cambio):g} %"
    if cambio > 0:
        return f"tu límite se relaja {cambio:g} %"
    return "tu límite se mantiene igual"


def mensaje_respaldo(ctx: dict, estado: str) -> str:
    """Mensaje predefinido cuando el LLM no está disponible."""
    nombre = ctx.get("nombre") or "hola"
    if ctx.get("adherencia") is None:
        return (f"¡Hola, {nombre}! Soy Foqui. Cuando cierres tu primera semana del plan "
                "te cuento cómo vas. Mientras, prueba una sesión de Modo Foco de 25 minutos.")
    cambio = _explicar_cambio(ctx.get("cambio_pct") or 0.0)
    racha = int(ctx.get("racha") or 0)
    if estado == "Enfocado":
        return f"Vas muy bien en tu sesión de foco, {nombre}. Termínala y luego descansas. 🎯"
    if estado == "Feliz":
        texto = f"¡Lo lograste, {nombre}! Cumpliste tu meta y {cambio} la próxima semana."
        return texto + (f" Llevas {racha} semanas seguidas cumpliendo." if racha > 1 else "")
    if estado == "Cansado":
        return (f"Esta semana costó trabajo, {nombre}, y está bien: {cambio} para que sea más fácil. "
                "¿Qué tal una sesión de Modo Foco hoy en la noche?")
    if estado == "Atenta":
        return (f"Vas bien, {nombre}, pero hay señales de que la próxima semana puede costarte. "
                f"Por eso {cambio}. Cuida sobre todo el uso en la noche.")
    return f"Hola, {nombre}. Esta semana {cambio}. ¡Sigue así!"


def instrucciones_sistema(ctx: dict, estado: str) -> str:
    """Instrucciones fijas + los datos agregados del usuario en JSON."""
    datos = {**ctx, "estado_foqui": estado}
    return f"{INSTRUCCIONES}\n\nDATOS_DEL_USUARIO:\n{json.dumps(datos, ensure_ascii=False, sort_keys=True)}"


def limpiar_respuesta(texto: str) -> str | None:
    """Quita espacios y markdown sencillo; None si la respuesta no sirve."""
    texto = " ".join(texto.replace("**", "").replace("#", "").split())
    if not texto:
        return None
    if len(texto) > MAX_CARACTERES:
        corte = texto.rfind(".", 0, MAX_CARACTERES)
        texto = texto[: corte + 1] if corte > 0 else texto[:MAX_CARACTERES].rstrip() + "…"
    return texto
