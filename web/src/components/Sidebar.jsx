import Icono from './Icono.jsx'
import brand from '../assets/icons/brand.svg'
import navPanel from '../assets/icons/nav-panel.svg'
import navTelemetria from '../assets/icons/nav-telemetria.svg'
import navAnalisis from '../assets/icons/nav-analisis.svg'
import navClusteres from '../assets/icons/nav-clusteres.svg'
import navAjustes from '../assets/icons/nav-ajustes.svg'

export const SECCIONES = [
  { id: 'panel', titulo: 'Panel General', sub: 'Overview', icono: navPanel },
  { id: 'telemetria', titulo: 'Telemetría Cloud', sub: 'Dispositivo Android', icono: navTelemetria },
  { id: 'analisis', titulo: 'Análisis Predictivo', sub: 'IA de recaída', icono: navAnalisis },
  { id: 'clusteres', titulo: 'Clústeres Big Data', sub: 'Patrones conductuales', icono: navClusteres },
  { id: 'ajustes', titulo: 'Ajustes y Perfil', sub: 'Configuración', icono: navAjustes },
]

export default function Sidebar({ activa, onNavegar, usuario, onSalir }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__glow" aria-hidden="true" />
      <div className="brand">
        <Icono src={brand} tam={40} />
        <div className="brand__texto">
          <span className="brand__nombre">
            FOCUS<span className="acento">!</span>
          </span>
          <span className="brand__lema">Menos pantalla, más enfoque</span>
        </div>
      </div>

      <p className="sidebar__titulo">PORTAL DE INVESTIGACIÓN</p>
      <nav className="nav" aria-label="Navegación principal">
        {SECCIONES.map((s) => {
          const esActiva = s.id === activa
          return (
            <button
              key={s.id}
              type="button"
              className={`nav__item${esActiva ? ' nav__item--activo' : ''}`}
              aria-current={esActiva ? 'page' : undefined}
              onClick={() => onNavegar(s.id)}
            >
              {esActiva && <span className="nav__marca" aria-hidden="true" />}
              <Icono src={s.icono} tam={18} tinta={esActiva ? '#f59e0b' : '#94a3b8'} />
              <span className="nav__texto">
                <span className="nav__titulo">{s.titulo}</span>
                <span className="nav__sub">{s.sub}</span>
              </span>
              {esActiva && <span className="nav__punto" aria-hidden="true" />}
            </button>
          )
        })}
      </nav>

      <div className="sidebar__pie">
        <div className="proyecto">
          <span className="proyecto__etiqueta">PROYECTO PILOTO · 2025</span>
          <span className="proyecto__titulo">Bienestar Digital Aplicado</span>
          <span className="proyecto__desc">Plataforma experimental de análisis conductual</span>
        </div>

        <div className="instituciones">
          <div className="institucion">
            <span className="institucion__sigla institucion__sigla--uaq">UAQ</span>
            <span className="institucion__texto">
              <b>Universidad Autónoma</b>
              <small>de Querétaro</small>
            </span>
          </div>
          <div className="institucion">
            <span className="institucion__sigla institucion__sigla--fif">FIF</span>
            <span className="institucion__texto">
              <b>Facultad de Informática</b>
              <small>Investigación aplicada</small>
            </span>
          </div>
        </div>

        {usuario && (
          <button type="button" className="sesion" onClick={onSalir} title="Cerrar sesión">
            <span className="sesion__nombre">{usuario.nombre}</span>
            <span className="sesion__salir">{usuario.demo ? 'Salir de la demo' : 'Cerrar sesión'}</span>
          </button>
        )}
      </div>
    </aside>
  )
}
