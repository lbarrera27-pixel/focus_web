// Reportes (Figma e36 centro de reportes, e37 exportar métricas)
import { useCallback, useEffect, useMemo, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import Dialogo from '../../components/web/Dialogo.jsx'
import { useAvisos } from '../../components/web/Avisos.jsx'
import { Banner, Encabezado, EstadoVacio, Esqueleto } from '../../components/web/Comunes.jsx'
import { fechaISO } from '../../data/panel.js'
import { horas } from '../../data/plan.js'
import {
  NIVEL_NOMBRE, PERIODOS_EXPORTAR, anotarDescarga, cargarReportes, consejoSemana, construirSemanas, diagnosticoSemana, escritoTexto,
  fechaCorta, generarCSV, kpisSemana, leerDescargas, rango, rangoExportar, seccionesExportar, tamano, textoResumen,
} from '../../data/reportes.js'
import Ayuda from '../../components/web/Ayuda.jsx'
import UsoPorDia from '../../components/web/UsoPorDia.jsx'
import iconoReloj from '../../assets/icons/w-reloj.svg'
import iconoMeta from '../../assets/icons/w-meta.svg'
import iconoAjuste from '../../assets/icons/aj-perilla.svg'
import iconoAlerta from '../../assets/icons/w-alerta.svg'
import iconoEscudo from '../../assets/icons/ia-escudo.svg'
import iconoFoqui from '../../assets/icons/w-foqui.svg'
import { imprimirReporte } from './imprimir.js'
import iconoArchivo from '../../assets/icons/w-archivo.svg'
import iconoArchivoMarca from '../../assets/icons/w-archivo-marca.svg'
import iconoDescargar from '../../assets/icons/w-descargar.svg'
import iconoDescargarGrande from '../../assets/icons/w-descargar-22.svg'
import iconoPlan from '../../assets/icons/w-reportes.svg'
import { ahoraEnZona } from '../../data/preferencias.js'
import './Reportes.css'

const SEMANA_MS = 7 * 86_400_000
// Marca UTF-8 al inicio del CSV para que Excel muestre bien los acentos
const BOM = String.fromCharCode(0xfeff)

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  a.click()
  URL.revokeObjectURL(url)
}

const ICONO_KPI = { promedio: iconoReloj, cumplimiento: iconoMeta, ajuste: iconoAjuste, riesgo: iconoAlerta }

// Figma e37: diálogo "Exportar métricas"
function Exportar({ r, semanas, nombre, onCerrar, onDescargado }) {
  const [periodo, setPeriodo] = useState('4s')
  const [personalizado, setPersonalizado] = useState({ desde: fechaISO(new Date(ahoraEnZona().getTime() - 27 * 86_400_000)), hasta: fechaISO(ahoraEnZona()) })
  const [formato, setFormato] = useState('tabla')
  const [incluir, setIncluir] = useState({ uso: true, pausas: true, plan: true, riesgo: true, foqui: false })

  const rangoSel = rangoExportar(periodo, r, personalizado)
  const secciones = useMemo(() => seccionesExportar(r, semanas, rangoSel, nombre), [r, semanas, rangoSel.desde.getTime(), rangoSel.hasta.getTime(), nombre]) // eslint-disable-line react-hooks/exhaustive-deps
  const elegidas = secciones.filter((s) => incluir[s.id])
  const contenido = formato === 'tabla' ? generarCSV(elegidas) : ''
  const semanasPdf = semanas.filter((s) => s.hasta >= rangoSel.desde && s.desde <= rangoSel.hasta)
  const titulo = PERIODOS_EXPORTAR.find((p) => p.id === periodo).titulo
  const nombreRango = periodo === 'personalizado' ? rango(rangoSel.desde, rangoSel.hasta) : titulo.toLowerCase()
  const listo = formato === 'tabla' ? elegidas.length > 0 : semanasPdf.length > 0

  function bajar() {
    if (formato === 'tabla') {
      descargar(`focus-metricas_${fechaISO(rangoSel.desde)}_${fechaISO(rangoSel.hasta)}.csv`, BOM + contenido, 'text/csv;charset=utf-8')
      onDescargado(`Mis datos · ${nombreRango} (tabla)`)
    } else {
      imprimirReporte(`Reporte Focus! · ${rango(rangoSel.desde, rangoSel.hasta)}`,
        semanasPdf.map((s) => ({ semana: s, parrafos: textoResumen(s, r, nombre, s === semanas[0]) })))
      onDescargado(`Reporte · ${nombreRango} (PDF)`)
    }
  }

  return (
    <Dialogo icono={iconoDescargarGrande} titulo="Exportar métricas" detalle="Descarga tus datos para analizarlos fuera del portal."
      ancho={560} onCerrar={onCerrar} className="rp-exportar"
      nota={formato === 'tabla' ? `≈ ${tamano(new Blob([contenido]).size)} · sin tu nombre ni tu correo` : `${semanasPdf.length} semana${semanasPdf.length === 1 ? '' : 's'} · sin tu nombre ni tu correo`}
      acciones={(
        <>
          <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="w-dlg-boton w-dlg-boton--primario" disabled={!listo} onClick={bajar}>
            {formato === 'tabla' ? 'Descargar tabla' : 'Descargar PDF'}
          </button>
        </>
      )}>
      <p className="w-etiqueta" id="rp-periodo">PERIODO</p>
      <div className="w-segmentos rp-segmentos" role="radiogroup" aria-labelledby="rp-periodo">
        {PERIODOS_EXPORTAR.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.titulo}</button>
        ))}
      </div>
      {periodo === 'personalizado' && (
        <div className="rp-fechas">
          <label className="w-campo"><span>Desde</span>
            <input type="date" value={personalizado.desde} max={personalizado.hasta} onChange={(e) => setPersonalizado((p) => ({ ...p, desde: e.target.value }))} />
          </label>
          <label className="w-campo"><span>Hasta</span>
            <input type="date" value={personalizado.hasta} max={fechaISO(ahoraEnZona())} onChange={(e) => setPersonalizado((p) => ({ ...p, hasta: e.target.value }))} />
          </label>
        </div>
      )}

      <p className="w-etiqueta" id="rp-formato">FORMATO</p>
      <div className="rp-formatos" role="radiogroup" aria-labelledby="rp-formato">
        {[['tabla', 'Tabla', 'Para Excel o Sheets'], ['pdf', 'PDF', 'Reporte con gráficas']].map(([id, t, d]) => (
          <button key={id} type="button" role="radio" aria-checked={formato === id} onClick={() => setFormato(id)}>
            <b>{t}</b><small>{d}</small>
          </button>
        ))}
      </div>

      <p className="w-etiqueta">INCLUIR</p>
      {formato === 'tabla' ? (
        <ul className="rp-incluir">
          {secciones.map((s) => (
            <li key={s.id}>
              <label>
                <input type="checkbox" checked={incluir[s.id]} onChange={(e) => setIncluir((i) => ({ ...i, [s.id]: e.target.checked }))} />
                <span>{s.titulo}</span>
              </label>
              <small>{s.cuenta}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="w-cuerpo w-texto--3">Un resumen por semana con sus números y su gráfica de uso diario. Se abre la ventana de impresión: elige «Guardar como PDF».</p>
      )}
    </Dialogo>
  )
}

export default function Reportes({ usuario, datos, onNavegar }) {
  const avisar = useAvisos()
  const [r, setR] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [descargas, setDescargas] = useState(() => leerDescargas(usuario.id))
  const nombre = usuario.nombre.split(' ')[0]

  const plan = datos?.plan
  const cargar = useCallback(async () => {
    setError(null)
    try {
      setR(await cargarReportes(usuario, { plan, ajustes: datos?.ajustes, apps: datos?.apps }))
    } catch (err) {
      setError(err.message || 'Sin conexión')
    }
  }, [usuario, plan, datos?.ajustes, datos?.apps])

  useEffect(() => {
    if (usuario.demo || datos) cargar()
  }, [cargar, usuario.demo, datos])

  const semanas = useMemo(() => (r?.plan ? construirSemanas(r) : []), [r])
  const actual = semanas.find((s) => s.id === sel) ?? semanas[0]
  const parrafos = actual ? textoResumen(actual, r, nombre, actual === semanas[0]) : []
  const consejo = actual ? consejoSemana(actual, r) : null

  const anotar = (titulo) => setDescargas(anotarDescarga(usuario.id, titulo))

  function pdfSemana() {
    imprimirReporte(`Resumen · ${actual.titulo}`, [{ semana: actual, parrafos }])
    anotar(`Resumen · ${actual.titulo} (PDF)`)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText([`Semana del ${actual.titulo}`, ...parrafos].join('\n\n'))
      avisar({ tono: 'exito', titulo: 'Texto copiado', detalle: 'Pégalo donde quieras compartir tu resumen.' })
    } catch {
      avisar({ tono: 'error', titulo: 'No se pudo copiar', detalle: 'Tu navegador no permitió usar el portapapeles.' })
    }
  }

  let cuerpo
  if (error && !r) {
    cuerpo = <Banner tono="error" titulo="No pudimos cargar tus reportes" detalle={error}
      accion={<button type="button" className="w-boton w-boton--secundario" onClick={cargar}>Reintentar</button>} />
  } else if (!r) {
    cuerpo = (
      <div className="rp-fila" aria-busy="true">
        <section className="w-tarjeta rp-lista">{Array.from({ length: 6 }, (_, i) => <Esqueleto key={i} alto={i ? 44 : 22} />)}</section>
        <section className="w-tarjeta rp-lectura"><Esqueleto ancho={280} alto={26} /><Esqueleto alto={96} /><Esqueleto alto={120} /></section>
      </div>
    )
  } else if (!semanas.length) {
    cuerpo = (
      <section className="w-tarjeta rp-vacio">
        <EstadoVacio icono={iconoPlan} titulo="Aún no hay reportes"
          detalle={r.plan ? 'Cuando cierres tu primera semana del plan, Foqui te deja aquí su resumen con tus números.' : 'Crea tu plan para empezar a recibir un resumen cada semana.'}
          accion="Ir a Mi plan" onAccion={() => onNavegar('plan')} />
      </section>
    )
  } else {
    const nuevo = ahoraEnZona().getTime() - semanas[0].escrito.getTime() < SEMANA_MS
    cuerpo = (
      <div className="rp-fila">
        <section className="w-tarjeta rp-lista">
          <h2 className="w-titulo-3 rp-lista__titulo">Resúmenes semanales</h2>
          <ul>
            {semanas.map((s, i) => (
              <li key={s.id}>
                <button type="button" className={`rp-semana${s === actual ? ' rp-semana--activa' : ''}`} aria-current={s === actual}
                  onClick={() => setSel(s.id)}>
                  <span className="rp-semana__icono"><img src={s === actual ? iconoArchivoMarca : iconoArchivo} alt="" /></span>
                  <span className="rp-semana__texto">
                    <b>{s.titulo}</b>
                    <small>{s.antesDelPlan ? 'Antes del plan · ' : ''}{horas(s.promedio)} al día</small>
                  </span>
                  <span className="rp-semana__chips">
                    {i === 0 && <span className="rp-nuevo">{nuevo ? 'Nuevo' : 'Actual'}</span>}
                    {s.nivel && <span className={`rp-riesgo rp-riesgo--${s.nivel}`}>{NIVEL_NOMBRE[s.nivel]}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {descargas.length > 0 && (
            <>
              <div className="w-divisor" />
              <p className="w-sobretitulo">DESCARGAS RECIENTES</p>
              <ul className="rp-descargas">
                {descargas.map((d) => (
                  <li key={d.fecha}>
                    <Icono src={iconoDescargar} tam={14} />
                    <span><b>{d.titulo}</b><small>{fechaCorta(d.fecha)}</small></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <article className="w-tarjeta rp-lectura">
          <header>
            <h2 className="rp-titulo-1">Semana del {actual.titulo}</h2>
            <p className="w-cuerpo w-texto--3">{actual.antesDelPlan ? 'Tu punto de partida antes de empezar el plan' : escritoTexto(actual)}</p>
          </header>
          <div className="rp-kpis">
            {kpisSemana(actual).map((k) => (
              <div key={k.id} className={`w-tarjeta w-kpi rp-kpi rp-kpi--${k.id}`}>
                <div className="rp-kpi__cabeza">
                  <p className="w-etiqueta">{k.etiqueta}</p>
                  <Ayuda titulo={k.etiqueta.charAt(0) + k.etiqueta.slice(1).toLowerCase()} que={k.ayuda} />
                  <span className="rp-kpi__icono" aria-hidden="true"><Icono src={ICONO_KPI[k.id]} tam={16} /></span>
                </div>
                <p className={`w-display${k.nivel ? ` rp-kpi__valor--${k.nivel}` : ''}`}>{k.valor}</p>
                <p className="w-texto w-texto--3">{k.detalle}</p>
              </div>
            ))}
          </div>
          <section className="rp-diagnostico">
            <div className="rp-subtitulo">
              <h3>Diagnóstico semanal</h3>
              <Ayuda titulo="Diagnóstico semanal" que="Lo más importante de la semana en dos líneas: los días en que te pasaste de tu límite y cómo queda tu límite." />
            </div>
            <p>{diagnosticoSemana(actual)}</p>
          </section>
          {consejo && (
            <div className="rp-consejo">
              <span className="rp-consejo__icono"><Icono src={iconoFoqui} tam={18} /></span>
              <p><b>Consejo de Foqui:</b> {consejo}</p>
            </div>
          )}

          <section className="rp-grafica">
            <div className="rp-subtitulo">
              <h3>Uso diario de esa semana</h3>
              <Ayuda titulo="Uso diario de esa semana" que="Horas de uso de cada día comparadas con el límite que tenías esa semana."
                accion="Toca o toca o pasa el ratón por una barra para ver el detalle del día." />
            </div>
            <UsoPorDia dias={actual.dias} limite={actual.limite} alto={190} />
            <ul className="ud__leyenda">
              <li><i className="ud__punto--bien" />Dentro del límite</li>
              <li><i className="ud__punto--mal" />Sobre el límite</li>
            </ul>
          </section>

          <p className="rp-nota">
            <Icono src={iconoEscudo} tam={16} />
            Foqui solo analiza totales de tiempo; nunca accede a nombres de apps ni mensajes privados.
          </p>
          <div className="rp-acciones">
            <button type="button" className="w-boton w-boton--secundario" onClick={pdfSemana}>Descargar PDF</button>
            <button type="button" className="w-boton w-boton--secundario" onClick={copiar}>Copiar texto</button>
            <button type="button" className="w-boton rp-fantasma" onClick={() => onNavegar('foqui')}>Abrir en Foqui</button>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="w-pagina rp">
      <Encabezado sobretitulo="REPORTES" titulo="Reportes y resúmenes">
        <button type="button" className="w-boton w-boton--primario" disabled={!semanas.length} onClick={() => setExportando(true)}>Exportar métricas</button>
      </Encabezado>
      {cuerpo}
      {exportando && (
        <Exportar r={r} semanas={semanas} nombre={nombre} onCerrar={() => setExportando(false)}
          onDescargado={(t) => {
            anotar(t)
            setExportando(false)
            avisar({ tono: 'exito', titulo: 'Descarga lista', detalle: t })
          }} />
      )}
    </div>
  )
}
