"""
Conexión a la base de datos con SQLAlchemy.

- Local: SQLite (archivo focus.db).
- Nube: Azure SQL Database (mssql+pyodbc), definida en DATABASE_URL
  o en las variables AZURE_SQL_*.
"""
import logging
import time

from sqlalchemy import create_engine
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

log = logging.getLogger("focus.db")

es_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if es_sqlite else {},
    pool_pre_ping=True,     # revisa que la conexión siga viva (Azure cierra las inactivas)
    pool_recycle=1800,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Clase base de todos los modelos (tablas)."""


def get_db():
    """Dependencia de FastAPI: abre una sesión por petición y la cierra al final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columnas agregadas después de crear las tablas en Azure: (tabla, columna, tipo SQL Server, tipo SQLite).
# create_all() solo crea tablas nuevas; estas se agregan con ALTER TABLE si faltan (idempotente).
_COLUMNAS_NUEVAS = [
    ("app", "limite_minutos", "INT NULL", "INTEGER"),
    ("app", "nivel", "INT NOT NULL CONSTRAINT df_app_nivel DEFAULT 2", "INTEGER NOT NULL DEFAULT 2"),
    ("app", "vigilada", "BIT NOT NULL CONSTRAINT df_app_vigilada DEFAULT 1", "BOOLEAN NOT NULL DEFAULT 1"),
    ("app", "actualizado", "DATETIME2 NOT NULL CONSTRAINT df_app_actualizado DEFAULT SYSUTCDATETIME()",
     "DATETIME NOT NULL DEFAULT '2026-01-01 00:00:00'"),
]


def _agregar_columnas_nuevas() -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    with engine.begin() as con:
        for tabla, columna, tipo_mssql, tipo_sqlite in _COLUMNAS_NUEVAS:
            existentes = {c["name"] for c in inspector.get_columns(tabla)}
            if columna in existentes:
                continue
            if es_sqlite:
                con.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo_sqlite}"))
            else:
                con.execute(text(f"ALTER TABLE {tabla} ADD {columna} {tipo_mssql}"))
            log.info("Columna agregada: %s.%s", tabla, columna)


def sincronizar_esquema(intentos: int = 5, espera_seg: int = 15) -> None:
    """Crea las tablas que no existan (ORM sincronizando el esquema desde el servidor).

    Se reintenta porque la base serverless de Azure SQL se pausa cuando no
    se usa y tarda alrededor de un minuto en "despertar".
    """
    import app.models  # noqa: F401  (registra todos los modelos en Base.metadata)

    for intento in range(1, intentos + 1):
        try:
            Base.metadata.create_all(bind=engine)
            _agregar_columnas_nuevas()
            log.info("Esquema sincronizado (%s)", engine.dialect.name)
            return
        # DBAPIError y no solo OperationalError: el error 40613 de Azure SQL ("database not currently
        # available", mientras despierta) llega de pyodbc como HY000 genérico
        except DBAPIError as e:
            if intento == intentos:
                raise
            log.warning("BD no disponible (intento %s/%s): %s", intento, intentos, e.orig)
            time.sleep(espera_seg)
