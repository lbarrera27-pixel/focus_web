from app.repositories.token_repository import EstadoRepository, TokenRepository
from app.services.base import ServicioPorUsuario
from app.utils.errores import Conflicto, NoEncontrado


class TokenService(ServicioPorUsuario):
    no_encontrado = "No existe el token {numero} para este usuario"
    repo: TokenRepository

    def preparar_creacion(self, usuario_id: int, datos: dict) -> dict:
        if self.repo.existe_token(datos["token"]):
            raise Conflicto("El token ya está registrado")
        return datos

    # ---------- Estado que reporta el teléfono ----------
    def reportar_estado(self, usuario_id: int, numero: int, cambios: dict, estados: EstadoRepository):
        return estados.guardar(self.obtener(usuario_id, numero), cambios)

    def estado(self, usuario_id: int, numero: int):
        token = self.obtener(usuario_id, numero)
        if token.estado is None:
            raise NoEncontrado(f"El dispositivo {numero} todavía no ha reportado su estado")
        return token.estado
