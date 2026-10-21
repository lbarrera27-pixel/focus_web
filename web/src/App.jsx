import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar, { SECCIONES } from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import Login from './pages/Login.jsx'
import PanelGeneral from './pages/PanelGeneral.jsx'
import Telemetria from './pages/Telemetria.jsx'
import Analisis from './pages/Analisis.jsx'
import Clusteres from './pages/Clusteres.jsx'
import Ajustes from './pages/ajustes/Ajustes.jsx'
import { cargarPanel, construirPanel } from './data/panel.js'
import { datosDemo } from './data/demo.js'

const CLAVE_SESION = 'focus.usuario'

function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION))
  } catch {
    return null
  }
}

// La sección activa vive en el hash (#/panel, #/telemetria…) para poder recargar o compartir
function useSeccion() {
  const leer = () => {
    const id = window.location.hash.replace('#/', '')
    return SECCIONES.some((s) => s.id === id) ? id : 'panel'
  }
  const [seccion, setSeccion] = useState(leer)
  useEffect(() => {
    const alCambiar = () => setSeccion(leer())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])
  return [seccion, (id) => (window.location.hash = `/${id}`)]
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  a.click()
  URL.revokeObjectURL(url)
}

function eventosCSV(datos) {
  const nombre = (n) => datos.apps.find((a) => a.numero === n)?.nombre ?? ''
  const filas = datos.eventos.map((e) => [e.numero, e.app_numero, `"${nombre(e.app_numero).replace(/"/g, '""')}"`, e.inicio, e.fin, e.duracion_seg].join(','))
  return ['numero,app_numero,app,inicio,fin,duracion_seg', ...filas].join('\n')
}

export default function App() {
  const [usuario, setUsuario] = useState(leerSesion)
  const [seccion, navegar] = useSeccion()
  const [periodo, setPeriodo] = useState('7d')
  const [busqueda, setBusqueda] = useState('')
  const [datos, setDatos] = useState(null)
  const [estado, setEstado] = useState({ cargando: false, error: null })
  const [cargadoEn, setCargadoEn] = useState(null)

  const entrar = (u) => {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(u))
    setUsuario(u)
  }
  const salir = useCallback(() => {
    localStorage.removeItem(CLAVE_SESION)
    setUsuario(null)
    setDatos(null)
  }, [])

  const cargar = useCallback(async () => {
    if (!usuario) return
    setEstado({ cargando: true, error: null })
    try {
      const d = usuario.demo ? datosDemo(periodo) : await cargarPanel(usuario.id, periodo)
      setDatos(d)
      setCargadoEn(Date.now())
      setEstado({ cargando: false, error: null })
    } catch (err) {
      // 401: el usuario ya no existe o está inactivo
      if (err.status === 401) return salir()
      setEstado({ cargando: false, error: err.status ? err.message : 'No se pudo conectar con la API' })
    }
  }, [usuario, periodo, salir])

  // Todas las secciones comparten los mismos datos salvo Telemetría, que carga los suyos
  const usaDatos = seccion !== 'telemetria'
  useEffect(() => {
    if (usaDatos) cargar()
  }, [cargar, usaDatos])

  // Análisis no tiene la opción "Semestre Piloto"
  useEffect(() => {
    if (seccion === 'analisis' && periodo === 'semestre') setPeriodo('30d')
  }, [seccion, periodo])

  const panel = useMemo(() => (datos ? construirPanel(datos) : null), [datos])

  if (!usuario) return <Login onEntrar={entrar} />

  const textoEstado = estado.error
    ? { texto: `Error: ${estado.error}`, error: true }
    : estado.cargando && !panel
      ? { texto: 'Sincronizando con la nube…' }
      : panel
        ? { texto: `Estado: ${usuario.demo ? 'Datos de demostración' : 'Nube Sincronizada'} · ${panel.eventosTotales} eventos` }
        : null

  function exportar() {
    if (!datos) return
    const sufijo = `${datos.desde}_${datos.hasta}`
    descargar(`focus-datos_${sufijo}.json`, JSON.stringify(datos, null, 2), 'application/json')
    descargar(`focus-eventos_${sufijo}.csv`, eventosCSV(datos), 'text/csv')
  }

  let contenido
  if (seccion === 'telemetria') {
    contenido = <Telemetria usuario={usuario} onSesionInvalida={salir} />
  } else if (seccion === 'analisis') {
    contenido = (
      <Analisis
        usuario={usuario}
        datos={datos}
        periodo={periodo}
        onPeriodo={setPeriodo}
        error={estado.error}
        cargadoEn={cargadoEn}
        onReintentar={cargar}
      />
    )
  } else if (seccion === 'clusteres') {
    contenido = (
      <Clusteres
        usuario={usuario}
        datos={datos}
        periodo={periodo}
        onPeriodo={setPeriodo}
        error={estado.error}
        onRecargar={cargar}
      />
    )
  } else if (seccion === 'ajustes') {
    contenido = (
      <Ajustes
        key={usuario.id}
        usuario={usuario}
        datos={datos}
        error={estado.error}
        cargadoEn={cargadoEn}
        onRecargar={cargar}
        onCuentaEliminada={salir}
      />
    )
  } else {
    contenido = (
      <>
        <TopBar
          ruta="FOCUS! / ANALYTICS"
          titulo="Cloud Analytics & Research Portal"
          estado={textoEstado}
          periodo={periodo}
          onPeriodo={setPeriodo}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          onExportar={exportar}
        />
        {panel ? (
          <PanelGeneral panel={panel} busqueda={busqueda} />
        ) : (
          <div className="panel panel--una">
            <p className="vacio">
              {estado.error ? (
                <>
                  No se pudieron cargar los datos. <button type="button" className="enlace" onClick={cargar}>Reintentar</button>
                </>
              ) : (
                'Cargando datos…'
              )}
            </p>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="app">
      <Sidebar activa={seccion} onNavegar={navegar} usuario={usuario} onSalir={salir} />
      <main className="contenido">{contenido}</main>
    </div>
  )
}
