from app.models import EstadoDispositivo, TokenDispositivo
from app.models._comun import ahora
from app.repositories.base import RepositorioPorUsuario


class TokenRepository(RepositorioPorUsuario[TokenDispositivo]):
    modelo = TokenDispositivo

    def existe_token(self, token: str) -> bool:
        return self.db.query(TokenDispositivo.id).filter(TokenDispositivo.token == token).first() is not None


class EstadoRepository:
    """Último estado de cada teléfono (una fila por token)."""

    def __init__(self, db):
        self.db = db

    def guardar(self, token: TokenDispositivo, cambios: dict) -> EstadoDispositivo:
        if token.estado is None:
            token.estado = EstadoDispositivo()
        estado = token.estado
        for campo, valor in cambios.items():
            setattr(estado, campo, valor)
        estado.fecha = ahora()   # cada reporte cuenta como "última actualización", aunque no cambie nada
        self.db.commit()
        self.db.refresh(estado)
        return estado
