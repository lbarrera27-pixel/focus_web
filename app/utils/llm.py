"""
Cliente del LLM (Claude) para el Compañero IA.

La app nunca llama al LLM directamente: lo hace la API, así la llave
(ANTHROPIC_API_KEY) se queda en el servidor. Si no hay llave o el servicio
falla, responder() devuelve None y el servicio usa los mensajes de respaldo.
"""
import logging

import anthropic

from app.config import ANTHROPIC_API_KEY, COMPANERO_MODELO

log = logging.getLogger("focus.llm")

_cliente: anthropic.Anthropic | None = None


def _obtener_cliente() -> anthropic.Anthropic | None:
    global _cliente
    if _cliente is None and ANTHROPIC_API_KEY:
        # Mensajes cortos: si tarda más de 20 s es mejor responder con el respaldo
        _cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=20.0, max_retries=1)
    return _cliente


def responder(sistema: str, mensajes: list[dict]) -> str | None:
    """Texto de la respuesta del LLM, o None si no se pudo obtener."""
    cliente = _obtener_cliente()
    if cliente is None:
        return None
    try:
        respuesta = cliente.messages.create(
            model=COMPANERO_MODELO,
            max_tokens=2000,                     # incluye el razonamiento; el texto es corto
            output_config={"effort": "low"},     # charla breve: no necesita pensar mucho
            system=sistema,
            messages=mensajes,
        )
    except anthropic.RateLimitError:
        log.warning("LLM con límite de peticiones; se usa el respaldo")
        return None
    except anthropic.APIStatusError as e:
        log.warning("LLM respondió %s: %s", e.status_code, e.message)
        return None
    except anthropic.APIConnectionError:
        log.warning("Sin conexión con el LLM; se usa el respaldo")
        return None
    if respuesta.stop_reason in ("refusal", "max_tokens"):
        log.warning("LLM terminó con %s; se usa el respaldo", respuesta.stop_reason)
        return None
    return "".join(b.text for b in respuesta.content if b.type == "text") or None
