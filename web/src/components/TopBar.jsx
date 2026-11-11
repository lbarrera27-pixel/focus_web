import { useEffect, useRef } from 'react'
import Icono from './Icono.jsx'
import iconoBuscar from '../assets/icons/search.svg'
import iconoDescargar from '../assets/icons/download.svg'
import { PERIODOS } from '../data/panel.js'
import './TopBar.css'

// En Mac el atajo se muestra como ⌘K; en Windows y Linux como Ctrl K
const ES_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export default function TopBar({ ruta, titulo, estado, periodo, onPeriodo, busqueda, onBusqueda, onExportar }) {
  const buscador = useRef(null)

  // ⌘K / Ctrl K lleva el cursor al buscador
  useEffect(() => {
    const alTeclear = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        buscador.current?.focus()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  return (
    <header className="topbar topbar--grande">
      <div className="topbar__titulos">
        <p className="topbar__ruta">{ruta}</p>
        <h1 className="topbar__titulo">{titulo}</h1>
        {estado && (
          <span className={`estado${estado.error ? ' estado--error' : ''}`} role="status">
            <span className="estado__punto" aria-hidden="true" />
            {estado.texto}
          </span>
        )}
      </div>

      <div className="topbar__acciones">
        <div className="segmentado" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`segmentado__opcion${p.id === periodo ? ' segmentado__opcion--activa' : ''}`}
              aria-pressed={p.id === periodo}
              onClick={() => onPeriodo(p.id)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        <label className="buscador">
          <Icono src={iconoBuscar} tam={20} />
          <input
            ref={buscador}
            type="search"
            placeholder="Buscar métrica o usuario"
            aria-label="Buscar métrica o usuario"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
          />
          <kbd>{ES_MAC ? '⌘K' : 'Ctrl K'}</kbd>
        </label>

        <button type="button" className="boton-primario" onClick={onExportar}>
          <Icono src={iconoDescargar} tam={20} />
          Exportar Datos
          <span className="boton-primario__extra">CSV/JSON</span>
        </button>
      </div>
    </header>
  )
}
