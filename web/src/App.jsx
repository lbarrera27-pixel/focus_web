import { useCallback, useEffect, useMemo, useState } from 'react'
import Menu, { SECCIONES_ESTUDIANTE } from './components/Menu.jsx'
import TopBar from './components/TopBar.jsx'
import Acceso from './pages/acceso/Acceso.jsx'
import PanelGeneral from './pages/PanelGeneral.jsx'
import Telemetria from './pages/Telemetria.jsx'
import Analisis from './pages/Analisis.jsx'
import Clusteres from './pages/Clusteres.jsx'
import Ajustes from './pages/ajustes/Ajustes.jsx'
import Riesgo from './pages/riesgo/Riesgo.jsx'
import MiPlan from './pages/plan/MiPlan.jsx'
import Uso from './pages/uso/Uso.jsx'
import Foqui from './pages/foqui/Foqui.jsx'
import Reportes from './pages/reportes/Reportes.jsx'
import AjustesCuenta from './pages/cuenta/AjustesCuenta.jsx'
import { CapaCuenta, MenuUsuario, PaginaNoEncontrada } from './pages/cuenta/DialogosCuenta.jsx'
import Pendiente from './pages/Pendiente.jsx'
import Dialogo from './components/web/Dialogo.jsx'
import { ProveedorAvisos } from './components/web/Avisos.jsx'
import iconoAlerta from './assets/icons/w-dlg-alerta.svg'
import { cargarPanel, construirPanel } from './data/panel.js'
import { datosDemo } from './data/demo.js'
import { csvDeDatos } from './data/ajustes.js'
import { cargarPreferencias, establecerPreferencias } from './data/preferencias.js'
import { api } from './api.js'

const CLAVE_SESION = 'focus.usuario'
const CLAVE_MENU = 'focus.menuContraido'

// Secciones del portal de investigación que siguen disponibles por su dirección (#/telemetria…)
const SECCIONES_INVESTIGACION = ['telemetria', 'analisis', 'clusteres']
// Secciones con el diseño nuevo: se adaptan desde 1024 px (las demás siguen fijas a 1440 px)
const SECCIONES_FLUIDAS = ['riesgo', 'plan', 'uso', 'foqui', 'reportes', 'ajustes', 'no-encontrada']
// Debajo de este ancho el menú se muestra contraído (Figma: "Colapsada se usa en 1024 px")
const ANCHO_MENU_COMPLETO = 1280
// Sin "Mantener la sesión iniciada", la sesión termina tras este tiempo sin actividad (Figma e46)
const INACTIVIDAD_MS = 30 * 60_000

function useAnchoEstrecho() {
  const medir = () => window.innerWidth < ANCHO_MENU_COMPLETO
  const [estrecho, setEstrecho] = useState(medir)
  useEffect(() => {
    const alCambiar = () => setEstrecho(medir())
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])
  return estrecho
}

// Direcciones anteriores al menú nuevo
const ALIAS = { panel: 'inicio' }

function leerMenuContraido() {
  try {
    return localStorage.getItem(CLAVE_MENU) === '1'
  } catch {
    return false
  }
}

// "Mantener la sesión iniciada" guarda la sesión en localStorage; si no, solo dura la pestaña (sessionStorage)
function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION) ?? sessionStorage.getItem(CLAVE_SESION))
  } catch {
    return null
  }
}

// La sección activa vive en el hash (#/panel, #/telemetria…) para poder recargar o compartir
function useSeccion() {
  const leer = () => {
    const crudo = window.location.hash.replace('#/', '')
    const id = ALIAS[crudo] ?? crudo
    if (!id) return 'inicio'
    // Dirección desconocida: página "No encontramos esta página" (Figma e47)
    return SECCIONES_ESTUDIANTE.some((s) => s.id === id) || SECCIONES_INVESTIGACION.includes(id) ? id : 'no-encontrada'
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
  const [menuContraido, setMenuContraido] = useState(leerMenuContraido)
  const estrecho = useAnchoEstrecho()
  // En pantallas angostas el menú empieza contraído; el botón lo abre solo mientras dure la visita
  const [abiertoEstrecho, setAbiertoEstrecho] = useState(false)
  // Cambios sin guardar de la sección activa ({ cambios, guardar }) y sección a la que se quiere ir (Figma e30)
  const [guardia, setGuardia] = useState(null)
  const [salida, setSalida] = useState(null)
  const [guardandoSalida, setGuardandoSalida] = useState(false)
  // Menú de la cuenta (e42) y diálogo abierto: perfil, desactivar, salir, expirada o ayuda
  const [menuCuenta, setMenuCuenta] = useState(false)
  const [perfilMenu, setPerfilMenu] = useState(null)
  const [dialogoCuenta, setDialogoCuenta] = useState(null)
  // Formato de hora e inicio de semana (Ajustes › Cuenta): al cambiar se vuelven a pintar las secciones
  const [versionPrefs, setVersionPrefs] = useState(0)
  const aplicarPreferencias = useCallback((p) => {
    if (establecerPreferencias(p)) setVersionPrefs((v) => v + 1)
  }, [])

  const intentarNavegar = (id) => {
    if (guardia && id !== seccion) setSalida(id)
    else navegar(id)
  }
  const salirA = (id) => {
    setSalida(null)
    setGuardia(null)
    navegar(id)
  }
  async function guardarYSalir() {
    setGuardandoSalida(true)
    const ok = await guardia.guardar()
    setGuardandoSalida(false)
    // Si falla se queda en la sección; el aviso de error ofrece reintentar
    if (ok) salirA(salida)
    else setSalida(null)
  }

  function alternarMenu() {
    setMenuContraido((c) => {
      try {
        localStorage.setItem(CLAVE_MENU, c ? '0' : '1')
      } catch {
        // sin almacenamiento: el estado del menú solo dura esta sesión
      }
      return !c
    })
  }

  const entrar = (u, recordar = true) => {
    try {
      ;(recordar ? localStorage : sessionStorage).setItem(CLAVE_SESION, JSON.stringify(u))
    } catch {
      // sin almacenamiento: la sesión solo dura mientras la página esté abierta
    }
    setUsuario(u)
  }
  // Cambio de nombre desde Ajustes: se guarda donde ya estaba la sesión
  const actualizarUsuario = (u) => {
    try {
      ;(localStorage.getItem(CLAVE_SESION) ? localStorage : sessionStorage).setItem(CLAVE_SESION, JSON.stringify(u))
    } catch {
      // sin almacenamiento: el nombre nuevo se ve hasta recargar
    }
    setUsuario(u)
  }
  const salir = useCallback(() => {
    try {
      localStorage.removeItem(CLAVE_SESION)
      sessionStorage.removeItem(CLAVE_SESION)
    } catch {
      // nada que borrar
    }
    setUsuario(null)
    setDatos(null)
    setMenuCuenta(false)
    setPerfilMenu(null)
    setDialogoCuenta(null)
  }, [])
  const expirar = useCallback(() => setDialogoCuenta('expirada'), [])

  // Sesión solo de esta pestaña: se cierra tras un rato sin actividad
  useEffect(() => {
    if (!usuario || usuario.demo || localStorage.getItem(CLAVE_SESION)) return
    let ultima = Date.now()
    const activo = () => (ultima = Date.now())
    const eventos = ['pointerdown', 'keydown', 'wheel']
    eventos.forEach((e) => window.addEventListener(e, activo, { passive: true }))
    const reloj = setInterval(() => Date.now() - ultima > INACTIVIDAD_MS && expirar(), 60_000)
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, activo))
      clearInterval(reloj)
    }
  }, [usuario, expirar])

  useEffect(() => {
    if (!usuario) return
    let vivo = true
    cargarPreferencias(usuario).then((p) => vivo && aplicarPreferencias(p))
    return () => {
      vivo = false
    }
  }, [usuario, aplicarPreferencias])

  // El correo y la foto del menú se piden al abrirlo por primera vez
  useEffect(() => {
    if (!menuCuenta || perfilMenu || !usuario || usuario.demo) return
    api.usuario(usuario.id).then(setPerfilMenu).catch(() => {})
  }, [menuCuenta, perfilMenu, usuario])

  function elegirMenu(id) {
    setMenuCuenta(false)
    if (id === 'ajustes') return intentarNavegar('ajustes')
    if (id === 'exportar') {
      if (datos) descargar(`focus-mis-datos_${usuario.demo ? 'demo' : usuario.id}.csv`, csvDeDatos(datos), 'text/csv')
      return
    }
    setDialogoCuenta(id)
  }

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
      if (err.status === 401) return expirar()
      setEstado({ cargando: false, error: err.status ? err.message : 'No se pudo conectar con la API' })
    }
  }, [usuario, periodo, expirar])

  // Todas las secciones comparten los mismos datos salvo Telemetría, que carga los suyos
  const usaDatos = seccion !== 'telemetria'
  // También al cambiar las preferencias: con otra zona horaria cambia el "hoy" de los periodos
  useEffect(() => {
    if (usaDatos) cargar()
  }, [cargar, usaDatos, versionPrefs])

  // Análisis no tiene la opción "Semestre Piloto"
  useEffect(() => {
    if (seccion === 'analisis' && periodo === 'semestre') setPeriodo('30d')
  }, [seccion, periodo])

  const panel = useMemo(() => (datos ? construirPanel(datos) : null), [datos])

  if (!usuario) return <Acceso onEntrar={entrar} />

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
  } else if (seccion === 'plan') {
    contenido = <MiPlan usuario={usuario} datos={datos} error={estado.error} onRecargar={cargar} />
  } else if (seccion === 'uso') {
    contenido = (
      <Uso
        usuario={usuario}
        datos={datos}
        error={estado.error}
        periodo={periodo}
        onPeriodo={setPeriodo}
        onExportar={exportar}
        onRecargar={cargar}
      />
    )
  } else if (seccion === 'reportes') {
    contenido = <Reportes key={usuario.id} usuario={usuario} datos={datos} onNavegar={intentarNavegar} />
  } else if (seccion === 'foqui') {
    contenido = <Foqui key={usuario.id} usuario={usuario} datos={datos} onNavegar={intentarNavegar} />
  } else if (seccion === 'ajustes') {
    contenido = (
      <AjustesCuenta key={usuario.id} usuario={usuario} datos={datos} onRecargar={cargar} onPerfil={actualizarUsuario}
        onDialogo={setDialogoCuenta} onExpirada={expirar} onPreferencias={aplicarPreferencias} />
    )
  } else if (seccion === 'no-encontrada') {
    contenido = <PaginaNoEncontrada onNavegar={navegar} />
  } else if (seccion === 'riesgo') {
    contenido = <Riesgo usuario={usuario} datos={datos} onNavegar={navegar} />
  } else if (seccion === 'apps') {
    contenido = (
      <Ajustes
        key={usuario.id}
        usuario={usuario}
        datos={datos}
        error={estado.error}
        cargadoEn={cargadoEn}
        onRecargar={cargar}
        onCuentaEliminada={salir}
        onGuardia={setGuardia}
      />
    )
  } else if (seccion !== 'inicio') {
    const s = SECCIONES_ESTUDIANTE.find((x) => x.id === seccion)
    contenido = <Pendiente titulo={s.titulo} sobretitulo={`MI PANEL · ${s.titulo.toUpperCase()}`} onNavegar={navegar} />
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
          <PanelGeneral panel={panel} busqueda={busqueda} onRecargar={cargar} />
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
    <ProveedorAvisos>
      <div className={`app${SECCIONES_FLUIDAS.includes(seccion) ? ' app--fluida' : ''}`}>
        <Menu
          activa={seccion}
          onNavegar={intentarNavegar}
          usuario={usuario}
          contraido={estrecho ? !abiertoEstrecho : menuContraido}
          onContraer={estrecho ? () => setAbiertoEstrecho((a) => !a) : alternarMenu}
          onUsuario={() => setMenuCuenta((a) => !a)}
          usuarioAbierto={menuCuenta}
        >
          {menuCuenta && <MenuUsuario usuario={usuario} perfil={perfilMenu} onCerrar={() => setMenuCuenta(false)} onElegir={elegirMenu} />}
        </Menu>
        {/* Ajustes no se reinicia al cambiar las preferencias: es donde se cambian */}
        <main className="contenido" key={seccion === 'ajustes' ? 'ajustes' : `v${versionPrefs}`}>{contenido}</main>
      </div>
      {salida && guardia && (
        <Dialogo icono={iconoAlerta} titulo="Tienes cambios sin guardar" ancho={520} onCerrar={() => setSalida(null)}
          detalle="Si sales ahora se perderán. La app móvil seguirá usando la configuración anterior."
          acciones={(
            <>
              <button type="button" className="w-dlg-boton w-dlg-boton--fantasma" onClick={() => salirA(salida)}>Descartar</button>
              <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={() => setSalida(null)}>Seguir editando</button>
              <button type="button" className="w-dlg-boton w-dlg-boton--primario" disabled={guardandoSalida} onClick={guardarYSalir}>
                {guardandoSalida ? 'Guardando…' : 'Guardar y salir'}
              </button>
            </>
          )}>
          <ul className="w-cambios">
            {guardia.cambios.map((c) => (
              <li key={c.nombre}>
                <span>{c.nombre}</span>
                {c.antes != null && <><s>{c.antes}</s><i aria-hidden="true">→</i><b>{c.despues}</b></>}
              </li>
            ))}
          </ul>
        </Dialogo>
      )}
      <CapaCuenta dialogo={dialogoCuenta} onDialogo={setDialogoCuenta} usuario={usuario} datos={datos}
        onPerfil={(p) => { setPerfilMenu(p); if (p.nombre !== usuario.nombre) actualizarUsuario({ ...usuario, nombre: p.nombre }) }}
        onSalir={salir} onNavegar={intentarNavegar} />
    </ProveedorAvisos>
  )
}
