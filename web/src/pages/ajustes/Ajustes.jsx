import { useEffect, useMemo, useRef, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import iconoCandado from '../../assets/icons/aj-candado.svg'
import iconoRestablecer from '../../assets/icons/aj-restablecer.svg'
import iconoGuardar from '../../assets/icons/aj-guardar.svg'
import { DEFAULTS, cargarLocales, guardarLocales, leerLocales } from '../../data/ajustes.js'
import { haceCuanto } from '../../data/panel.js'
import { api } from '../../api.js'
import TabReglas from './TabReglas.jsx'
import TabApps from './TabApps.jsx'
import TabLimites from './TabLimites.jsx'
import TabPrivacidad from './TabPrivacidad.jsx'
import TabSitios from './TabSitios.jsx'
import { useAvisos } from '../../components/web/Avisos.jsx'
import { horas } from '../../data/plan.js'
import './Ajustes.css'

// Orden de las pestañas de "Apps y sitios" en Figma (e25–e28)
const PESTANAS = [
  { id: 'apps', titulo: 'Apps restringidas' },
  { id: 'sitios', titulo: 'Sitios bloqueados' },
  { id: 'limites', titulo: 'Límites diarios' },
  { id: 'reglas', titulo: 'Reglas de fricción' },
  { id: 'privacidad', titulo: 'Privacidad académica' },
]

// Cómo se nombra cada clave de /configuracion/me en el diálogo de cambios sin guardar
const NOMBRES_AJUSTE = {
  niveles: 'Niveles de fricción',
  ejercicio: 'Ejercicio de la pausa',
  modoFoco: 'Modo foco',
  appsInactivas: 'Apps con fricción activada',
  categorias: 'Límites por categoría',
  reduccionGradual: 'Reducción gradual',
  descanso: 'Horario de descanso',
  excepciones: 'Excepciones',
  privacidad: 'Datos compartidos para investigación',
  anonimizacion: 'Anonimización',
  retencion: 'Tiempo de retención',
  consentimientoRetirado: 'Consentimiento',
}

function iniciales(nombre = '') {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}

// Valores que viven en la API y se editan como borrador hasta "Guardar"
function borradorApi(datos) {
  return {
    limiteGlobal: datos?.plan?.limite_base ?? null,
    limitesApps: Object.fromEntries((datos?.apps ?? []).map((a) => [a.numero, a.limite_aperturas])),
  }
}

export default function Ajustes({ usuario, datos, error, cargadoEn, onRecargar, onCuentaEliminada, onGuardia, pestanaInicial = 'apps' }) {
  const avisar = useAvisos()
  const [pestana, setPestana] = useState(pestanaInicial)
  // Se empieza con la copia del navegador y se reemplaza con lo que devuelva GET /configuracion/me
  const [inicial] = useState(() => leerLocales(usuario.id))
  const [locales, setLocales] = useState(() => structuredClone(inicial))
  const [guardadosLocales, setGuardadosLocales] = useState(inicial)
  const [borrador, setBorrador] = useState(() => borradorApi(datos))
  const [estado, setEstado] = useState({ guardando: false, mensaje: null, error: false })
  const [ultimaSync, setUltimaSync] = useState(cargadoEn)

  const original = useMemo(() => borradorApi(datos), [datos])

  // Cuando llegan datos nuevos de la API (p. ej. tras crear una app) se toman los valores nuevos,
  // pero se conservan los campos que el usuario ya había editado y aún no guarda
  const [originalPrevio, setOriginalPrevio] = useState(original)
  if (original !== originalPrevio) {
    const editado = (k, v) => v !== undefined && v !== (k === null ? originalPrevio.limiteGlobal : originalPrevio.limitesApps[k])
    setBorrador((b) => ({
      limiteGlobal: editado(null, b.limiteGlobal) ? b.limiteGlobal : original.limiteGlobal,
      limitesApps: Object.fromEntries(
        Object.entries(original.limitesApps).map(([n, v]) => [n, editado(n, b.limitesApps[n]) ? b.limitesApps[n] : v]),
      ),
    }))
    setOriginalPrevio(original)
  }

  useEffect(() => {
    setUltimaSync(cargadoEn)
  }, [cargadoEn])

  // Si el usuario ya empezó a editar antes de que responda la API, se conservan sus cambios
  useEffect(() => {
    let vigente = true
    cargarLocales(usuario).then((remotos) => {
      if (!vigente || !remotos) return
      setLocales((l) => (JSON.stringify(l) === JSON.stringify(inicial) ? structuredClone(remotos) : l))
      setGuardadosLocales(remotos)
    })
    return () => {
      vigente = false
    }
  }, [usuario, inicial])

  const cambiosApi = useMemo(() => {
    const apps = Object.entries(borrador.limitesApps).filter(([n, v]) => original.limitesApps[n] !== v)
    return { plan: borrador.limiteGlobal !== original.limiteGlobal, apps }
  }, [borrador, original])
  const cambiosLocales = JSON.stringify(locales) !== JSON.stringify(guardadosLocales)
  const pendientes = cambiosLocales || cambiosApi.plan || cambiosApi.apps.length > 0

  // Aviso del navegador si se intenta salir con cambios sin guardar
  useEffect(() => {
    if (!pendientes) return
    const avisar = (e) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [pendientes])

  // Lista de cambios para el diálogo "Tienes cambios sin guardar" (Figma e30)
  const listaCambios = useMemo(() => {
    const lista = []
    if (cambiosApi.plan) lista.push({ nombre: 'Límite diario global', antes: horas(original.limiteGlobal), despues: horas(borrador.limiteGlobal) })
    for (const [n, v] of cambiosApi.apps) {
      const app = datos?.apps.find((a) => String(a.numero) === String(n))
      lista.push({ nombre: `${app?.nombre ?? 'App'} · aperturas`, antes: original.limitesApps[n], despues: v })
    }
    if (locales.temporizador !== guardadosLocales.temporizador) {
      lista.push({ nombre: 'Temporizador de la pausa', antes: `${guardadosLocales.temporizador} s`, despues: `${locales.temporizador} s` })
    }
    for (const k of Object.keys(locales)) {
      if (k === 'temporizador' || JSON.stringify(locales[k]) === JSON.stringify(guardadosLocales[k])) continue
      lista.push({ nombre: NOMBRES_AJUSTE[k] ?? 'Otro ajuste' })
    }
    return lista
  }, [cambiosApi, original, borrador, datos, locales, guardadosLocales])

  // Referencias a lo último guardado y a guardar(), para los botones de los avisos ("Deshacer", "Reintentar")
  const guardadosRef = useRef(guardadosLocales)
  const guardarRef = useRef(null)
  const [reGuardar, setReGuardar] = useState(false)
  useEffect(() => {
    guardadosRef.current = guardadosLocales
    guardarRef.current = guardar
  })
  useEffect(() => {
    if (!reGuardar) return
    setReGuardar(false)
    guardarRef.current()
  }, [reGuardar])

  // Avisa a App si hay cambios pendientes para preguntar antes de cambiar de sección
  useEffect(() => {
    onGuardia?.(pendientes ? { cambios: listaCambios, guardar: () => guardarRef.current() } : null)
  }, [pendientes, listaCambios, onGuardia])
  useEffect(() => () => onGuardia?.(null), [onGuardia])

  // Sitios bloqueados: se guardan al momento (solo la clave "sitios"), sin pasar por "Guardar"
  async function guardarSitios(actualizar) {
    const sitios = actualizar(guardadosRef.current.sitios ?? {})
    const nuevos = { ...guardadosRef.current, sitios }
    await guardarLocales(usuario, nuevos)
    guardadosRef.current = nuevos
    setGuardadosLocales(nuevos)
    setLocales((l) => ({ ...l, sitios }))
    setUltimaSync(Date.now())
  }

  function deshacer(previo) {
    setLocales(structuredClone(previo.locales))
    setBorrador(previo.borrador)
    setReGuardar(true)
  }

  async function guardar() {
    const previo = { locales: guardadosLocales, borrador: original }
    setEstado({ guardando: true, mensaje: null, error: false })
    avisar({ id: 'ajustes-guardar', tono: 'info', titulo: 'Guardando…', detalle: 'Enviando tus cambios a la nube.', fijo: true })
    try {
      if (!usuario.demo) {
        if (cambiosApi.plan && datos.plan) await api.actualizarPlan(usuario.id, datos.plan.numero, { limite_base: borrador.limiteGlobal })
        for (const [numero, limite] of cambiosApi.apps) await api.actualizarApp(usuario.id, numero, { limite_aperturas: limite })
      }
      // PUT /configuracion/me (en la demo, solo en el navegador)
      if (cambiosLocales) await guardarLocales(usuario, locales)
      setGuardadosLocales(structuredClone(locales))
      // En la demo no hay API: los cambios de límites se descartan
      if (usuario.demo) setBorrador(borradorApi(datos))
      const enApi = (cambiosApi.plan ? 1 : 0) + cambiosApi.apps.length + (cambiosLocales ? 1 : 0)
      setEstado({
        guardando: false,
        error: false,
        mensaje: usuario.demo ? 'Guardado en este navegador (demo: no se envía nada a la API)' : `Guardado · ${enApi} cambio(s) enviados a la API`,
      })
      setUltimaSync(Date.now())
      if ((cambiosApi.plan || cambiosApi.apps.length) && !usuario.demo) onRecargar()
      // Figma e31: en la demo el aviso es de advertencia porque nada llega al teléfono
      avisar({
        id: 'ajustes-guardar',
        tono: usuario.demo ? 'alerta' : 'exito',
        titulo: usuario.demo ? 'Solo guardado en este navegador' : 'Guardado y enviado al teléfono',
        detalle: usuario.demo ? 'Modo demostración: no se envía nada a la API.' : `${enApi} cambio${enApi === 1 ? '' : 's'} · tu teléfono los aplica en segundos.`,
        accion: { texto: 'Deshacer', alPulsar: () => deshacer(previo) },
      })
      return true
    } catch (err) {
      setEstado({ guardando: false, error: true, mensaje: `No se pudo guardar: ${err.message || 'sin conexión'}` })
      // Figma e32: el error se queda hasta cerrarlo o reintentar
      avisar({
        id: 'ajustes-guardar',
        tono: 'error',
        titulo: 'No se pudo guardar',
        detalle: `${err.message || 'Sin conexión'}. Tus cambios siguen aquí; la app móvil usa la configuración anterior.`,
        accion: { texto: 'Reintentar', alPulsar: () => guardarRef.current() },
      })
      return false
    }
  }

  function restablecer() {
    setLocales(structuredClone(DEFAULTS))
    setBorrador(borradorApi(datos))
    setEstado({ guardando: false, error: false, mensaje: 'Valores por defecto cargados; pulsa Guardar para aplicarlos' })
  }

  const actual = PESTANAS.find((p) => p.id === pestana)
  const props = { usuario, datos, locales, setLocales, borrador, setBorrador, original, onRecargar, onCuentaEliminada }

  return (
    <div className="aj">
      <header className="aj-encabezado">
        <div className="w-encabezado__titulos">
          <p className="w-sobretitulo">APPS Y SITIOS · {actual.titulo.toUpperCase()}</p>
          <h1 className="w-display">Configuración del sistema</h1>
        </div>
        <div className="topbar__acciones aj-acciones">
          <span className="chip aj-chip">
            <Icono src={iconoCandado} tam={13} />
            Cambios protegidos y auditados
          </span>
          <span className={`estado estado--chip ia-modelo${error ? ' estado--error' : ''}`}>
            <span className="estado__punto" aria-hidden="true" />
            {error ? 'Sin conexión con la nube' : usuario.demo ? 'Modo demostración' : 'Nube sincronizada'}
          </span>
          <span className="avatar avatar--bd" title={usuario.nombre}>{iniciales(usuario.nombre)}</span>
        </div>
      </header>

      <nav className="aj-pestanas" aria-label="Secciones de configuración" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === pestana}
            className={`aj-pestana${p.id === pestana ? ' aj-pestana--activa' : ''}`}
            onClick={() => setPestana(p.id)}
          >
            {p.titulo}
          </button>
        ))}
      </nav>

      <div className="aj-contenido">
        {!datos ? (
          <p className="vacio">
            {error ? (
              <>
                No se pudieron cargar los datos. <button type="button" className="enlace" onClick={onRecargar}>Reintentar</button>
              </>
            ) : (
              'Cargando ajustes…'
            )}
          </p>
        ) : pestana === 'reglas' ? (
          <TabReglas {...props} />
        ) : pestana === 'apps' ? (
          <TabApps {...props} />
        ) : pestana === 'limites' ? (
          <TabLimites {...props} />
        ) : pestana === 'sitios' ? (
          <TabSitios usuario={usuario} locales={locales} guardarSitios={guardarSitios} ultimaSync={ultimaSync} />
        ) : (
          <TabPrivacidad {...props} />
        )}
      </div>

      <footer className="aj-barra">
        <div className="aj-barra__estado">
          <span className={`aj-barra__titulo${pendientes ? '' : ' aj-barra__titulo--ok'}`}>
            <i />
            {estado.mensaje && !pendientes ? estado.mensaje : pendientes ? 'Cambios locales pendientes' : 'Todo guardado'}
          </span>
          <small className={estado.error ? 'aj-error' : ''}>
            {estado.error
              ? estado.mensaje
              : `La última sincronización con la nube fue ${ultimaSync ? haceCuanto(new Date(ultimaSync).toISOString()).toLowerCase() : 'pendiente'}.`}
          </small>
        </div>
        <div className="aj-barra__botones">
          <button type="button" className="aj-boton-secundario" onClick={restablecer}>
            <Icono src={iconoRestablecer} tam={16} />
            Restablecer valores por defecto
          </button>
          <button type="button" className="boton-primario aj-boton-primario" onClick={guardar} disabled={!pendientes || estado.guardando}>
            <Icono src={iconoGuardar} tam={17} />
            {estado.guardando ? 'Guardando…' : 'Guardar y sincronizar con móvil'}
          </button>
        </div>
      </footer>
    </div>
  )
}
