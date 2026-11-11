"""
Envío de correos por SMTP. Sirve con cualquier proveedor (Azure Communication Services, SendGrid,
Gmail con contraseña de aplicación...): solo cambian las variables SMTP_* de config.py.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import RECUPERACION_MINUTOS, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_REMITENTE, SMTP_USUARIO

log = logging.getLogger("focus.correo")


def correo_configurado() -> bool:
    return bool(SMTP_HOST and SMTP_REMITENTE)


def enviar_correo_recuperacion(destino: str, enlace: str) -> None:
    """Se ejecuta en segundo plano. Si falla solo se registra el tipo de error (nunca el enlace)."""
    mensaje = EmailMessage()
    mensaje["Subject"] = "Crea tu nueva contraseña de FOCUS!"
    mensaje["From"] = SMTP_REMITENTE
    mensaje["To"] = destino
    mensaje.set_content(
        "Recibimos una solicitud para cambiar la contraseña de tu cuenta de FOCUS!.\n\n"
        f"Abre este enlace para crear una nueva (caduca en {RECUPERACION_MINUTOS} minutos):\n{enlace}\n\n"
        "Si no fuiste tú, ignora este correo: tu contraseña no cambiará."
    )
    mensaje.add_alternative(
        '<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:480px">'
        "<h2>Crea tu nueva contraseña</h2>"
        "<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de FOCUS!.</p>"
        f'<p><a href="{enlace}" style="display:inline-block;background:#f59e0b;color:#0f172a;'
        'padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">Crear contraseña</a></p>'
        f"<p>El enlace caduca en {RECUPERACION_MINUTOS} minutos.</p>"
        "<p>Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p></div>",
        subtype="html",
    )
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if SMTP_USUARIO:
                smtp.login(SMTP_USUARIO, SMTP_PASSWORD or "")
            smtp.send_message(mensaje)
        log.info("Correo de recuperación enviado")
    except (smtplib.SMTPException, OSError) as e:
        log.error("No se pudo enviar el correo de recuperación: %s", type(e).__name__)
