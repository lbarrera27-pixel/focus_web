from app.repositories.app_repository import AppRepository
from app.services.base import ServicioPorUsuario
from app.utils.errores import Conflicto


class AppService(ServicioPorUsuario):
    no_encontrado = "No existe la app {numero} para este usuario"
    campos_anulables = {"categoria", "limite_minutos"}
    repo: AppRepository

    def antes_de_eliminar(self, app) -> None:
        # Integridad referencial: no se borra una app que ya tiene historial.
        if self.repo.tiene_historial(app):
            raise Conflicto("La app tiene eventos o pausas registradas; no se puede eliminar")
