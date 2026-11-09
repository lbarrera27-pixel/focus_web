"""
Configuración de la aplicación.

Todo se lee de variables de entorno (o de un archivo .env en local).
En Azure App Service estas mismas variables se definen en
"Configuración > Variables de entorno" y el código no cambia.
"""
import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv()


def _url_azure_sql() -> str | None:
    """Arma la URL de Azure SQL a partir de variables separadas.

    Así la contraseña no se tiene que escribir "escapada" a mano:
    quote_plus se encarga de caracteres como @, #, ! o /.
    """
    servidor = os.getenv("AZURE_SQL_SERVER")  # p. ej. focus-sql.database.windows.net
    if not servidor:
        return None
    base = os.getenv("AZURE_SQL_DB", "focusdb")
    usuario = quote_plus(os.getenv("AZURE_SQL_USER", ""))
    password = quote_plus(os.getenv("AZURE_SQL_PASSWORD", ""))
    driver = quote_plus(os.getenv("AZURE_SQL_DRIVER", "ODBC Driver 18 for SQL Server"))
    return (
        f"mssql+pyodbc://{usuario}:{password}@{servidor}:1433/{base}"
        f"?driver={driver}&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=60"
    )


# Prioridad: DATABASE_URL explícita > variables AZURE_SQL_* > SQLite local
DATABASE_URL = os.getenv("DATABASE_URL") or _url_azure_sql() or "sqlite:///./focus.db"

# Azure Blob Storage (fotos de perfil)
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "fotos")

# Compañero IA (LLM). Sin llave, Foqui responde con mensajes predefinidos.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
COMPANERO_MODELO = os.getenv("COMPANERO_MODELO", "claude-haiku-5-5")

# JWT (app Android y portal web). En Azure define JWT_SECRET con una cadena larga y aleatoria.
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_DIAS = int(os.getenv("JWT_DIAS", "30"))
# Modo anterior de identificación (header X-Usuario-Id). Ponlo en "false" cuando todos los clientes usen JWT.
PERMITIR_X_USUARIO_ID = os.getenv("PERMITIR_X_USUARIO_ID", "true").lower() != "false"

# Recuperación de contraseña. SMTP_HOST y SMTP_REMITENTE activan el envío del correo.
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USUARIO = os.getenv("SMTP_USUARIO")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_REMITENTE = os.getenv("SMTP_REMITENTE")
RECUPERACION_MINUTOS = int(os.getenv("RECUPERACION_MINUTOS", "30"))
# Portal web: ahí abre el enlace para crear la contraseña nueva
PORTAL_URL = os.getenv("PORTAL_URL", "https://green-moss-07816e210.4.azurestaticapps.net").rstrip("/")

# Orígenes permitidos por CORS (separados por coma). "*" = cualquiera.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# Zona horaria de los usuarios (la BD guarda UTC). México centro = -6.
UTC_OFFSET_HORAS = int(os.getenv("UTC_OFFSET_HORAS", "-6"))
