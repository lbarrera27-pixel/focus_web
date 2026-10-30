// Editar plan semanal (Figma e10). Si aún no hay plan, el mismo formulario lo crea.
import { useMemo, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { Banner, Encabezado } from '../../components/web/Comunes.jsx'
import { api } from '../../api.js'
import { fechaISO } from '../../data/panel.js'
import {
  DIAS_CORTE, SENSIBILIDADES, guardarPreferencias, horas, ignoradasSemana, limiteActual, simular,
} from '../../data/plan.js'
import iconoInfo from '../../assets/icons/w-info-18.svg'
import iconoInfoVerde from '../../assets/icons/w-info-verde.svg'

const METAS = Array.from({ length: 17 }, (_, i) => 60 + i * 15)          // 1 h a 5 h
const SEMANAS = Array.from({ length: 9 }, (_, i) => 4 + i)                // 4 a 12

function Campo({ id, etiqueta, ayuda, children }) {
  return (
    <div className="ep-campo">
      <label htmlFor={id} className="w-cuerpo">{etiqueta}</label>
      {children}
      {ayuda && <p className="w-texto w-texto--3">{ayuda}</p>}
    </div>
  )
}

export default function EditarPlan({ usuario, plan, ajustes, pausas, prefs, onCancelar, onGuardado }) {
  const [form, setForm] = useState(prefs)
  const limiteInicial = plan ? limiteActual(plan, ajustes) : 240
  const [limite, setLimite] = useState(limiteInicial)
  const [estado, setEstado] = useState({ guardando: false, error: '' })
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const ultimo = ajustes[ajustes.length - 1]
  const adherencia = ultimo?.adherencia ?? 0.9
  const ignoradas = ultimo ? ignoradasSemana(plan, ultimo.semana, pausas) : 0
  const semanaActual = plan?.semana_actual ?? 0
  const limiteValido = Number(limite) >= 30 && Number(limite) <= 720
  const sim = useMemo(
    () => simular(limiteValido ? Number(limite) : limiteInicial, Number(form.meta_min), adherencia, ignoradas,
      form.permitir_relajar, semanaActual),
    [limite, limiteValido, limiteInicial, form.meta_min, adherencia, ignoradas, form.permitir_relajar, semanaActual],
  )
  const elegida = sim[form.sensibilidad]
  const barras = [Number(limite) || limiteInicial, ...elegida.limites]
  const maxBarra = Math.max(...barras)
  const textoLlega = (s) => (s.llega ? `Semana ${s.llega}` : '—')
  const diferencia = (otra) => {
    if (!elegida.llega || !sim[otra].llega) return null
    const d = sim[otra].llega - elegida.llega
    const n = Math.abs(d)
    const semanas = n === 1 ? 'una semana' : `${n} semanas`
    return d === 0 ? 'lo mismo' : `${semanas} ${d > 0 ? 'más' : 'menos'}`
  }

  async function guardar() {
    if (!limiteValido) return setEstado({ guardando: false, error: 'El límite debe estar entre 30 y 720 minutos al día.' })
    setEstado({ guardando: true, error: '' })
    const nuevas = { ...form, meta_min: Number(form.meta_min), semanas: Number(form.semanas) }
    try {
      if (!usuario.demo) {
        if (!plan) {
          await api.crearPlan(usuario.id, { fecha_inicio: fechaISO(new Date()), limite_base: Number(limite) })
        } else if (Number(limite) !== limiteInicial) {
          // El límite actual es limite_base × los cambios de cada semana: se corrige el punto de partida
          const factor = limiteInicial / plan.limite_base
          await api.actualizarPlan(usuario.id, plan.numero, { limite_base: Math.max(1, Math.round(Number(limite) / factor)) })
        }
      }
      await guardarPreferencias(usuario, nuevas)
      onGuardado(nuevas)
    } catch (err) {
      setEstado({ guardando: false, error: err.message || 'No se pudo conectar con la API.' })
    }
  }

  return (
    <div className="w-pagina mp ep">
      <Encabezado sobretitulo="MI PLAN · AJUSTE SEMANAL" titulo={plan ? 'Editar plan semanal' : 'Crear mi plan'}>
        <button type="button" className="w-boton w-boton--secundario" onClick={onCancelar} disabled={estado.guardando}>Cancelar</button>
        <button type="button" className="w-boton w-boton--primario" onClick={guardar} disabled={estado.guardando}>
          {estado.guardando ? 'Guardando…' : plan ? 'Guardar plan' : 'Crear plan'}
        </button>
      </Encabezado>

      {estado.error && <Banner tono="error" titulo="No pudimos guardar tu plan" detalle={estado.error} />}

      <div className="w-fila mp-cuerpo">
        <section className="w-tarjeta ep-form">
          <div>
            <h2 className="w-titulo-3">Tu plan</h2>
            <p className="w-cuerpo w-texto--3">
              {plan ? 'Los cambios se aplican desde la próxima semana. La semana actual no se recalcula.' : 'El plan empieza hoy; tu primer ajuste llega en una semana.'}
            </p>
          </div>
          <Campo id="ep-meta" etiqueta="Meta final de uso diario" ayuda="Recomendado: entre 1 h 30 min y 3 h.">
            <select id="ep-meta" className="ep-caja" value={form.meta_min} onChange={cambiar('meta_min')}>
              {METAS.map((m) => <option key={m} value={m}>{horas(m)}</option>)}
            </select>
          </Campo>
          <div className="ep-fila">
            <Campo id="ep-semanas" etiqueta="Duración del plan" ayuda="De 4 a 12 semanas.">
              <select id="ep-semanas" className="ep-caja" value={form.semanas} onChange={cambiar('semanas')}>
                {SEMANAS.map((s) => <option key={s} value={s}>{s} semanas</option>)}
              </select>
            </Campo>
            <Campo id="ep-corte" etiqueta="Día de corte" ayuda="Ese día se calcula el ajuste.">
              <select id="ep-corte" className="ep-caja" value={form.dia_corte} onChange={cambiar('dia_corte')}>
                {DIAS_CORTE.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)} · 00:00</option>)}
              </select>
            </Campo>
          </div>
          <Campo id="ep-limite" etiqueta={plan ? 'Límite actual (punto de partida)' : 'Límite de partida'}
            ayuda={`${limiteValido ? `${horas(Number(limite))} al día. ` : ''}${plan ? 'Lo calcula el plan. Puedes corregirlo una vez por semana.' : 'Lo que usas hoy, más o menos.'}`}>
            <span className={`ep-caja ep-caja--sufijo${limiteValido ? '' : ' ep-caja--error'}`}>
              <input id="ep-limite" type="number" min={30} max={720} step={1} value={limite}
                aria-invalid={!limiteValido || undefined} onChange={(e) => setLimite(e.target.value)} />
              <span>min</span>
            </span>
          </Campo>
          <div className="w-divisor" />
          <div className="ep-sensibilidad">
            <h2 className="w-titulo-3" id="ep-sens">Sensibilidad del ajuste</h2>
            <p className="w-cuerpo w-texto--3">Qué tan rápido baja tu límite cuando cumples. No cambia tu meta.</p>
            <div className="ep-segmentado" role="radiogroup" aria-labelledby="ep-sens">
              {SENSIBILIDADES.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={form.sensibilidad === s.id}
                  className={form.sensibilidad === s.id ? 'ep-segmentado__activo' : ''}
                  onClick={() => setForm((f) => ({ ...f, sensibilidad: s.id }))}>
                  {s.titulo}
                </button>
              ))}
            </div>
            <div className="ep-opciones">
              {SENSIBILIDADES.map((s) => (
                <button key={s.id} type="button" tabIndex={-1} aria-hidden="true"
                  className={`ep-opcion${form.sensibilidad === s.id ? ' ep-opcion--activa' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, sensibilidad: s.id }))}>
                  <b className="w-cuerpo">{s.titulo}</b>
                  <span className="w-texto w-texto--2">
                    {s.detalle}{s.id === prefs.sensibilidad && plan ? ' Es la configuración actual.' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <label className="ep-relajar">
            <input type="checkbox" role="switch" checked={form.permitir_relajar} onChange={cambiar('permitir_relajar')} />
            <span className="ep-switch" aria-hidden="true" />
            <span className="w-cuerpo">Permitir que el plan relaje el límite (+5 %) cuando la semana sale mal</span>
          </label>
        </section>

        <section className="w-tarjeta ep-vista">
          <div>
            <h2 className="w-titulo-3">Así cambiaría tu límite</h2>
            <p className="w-cuerpo w-texto--3">
              {ultimo
                ? `Simulación con tu adherencia actual (${Math.round(adherencia * 100)} %) y pausas ignoradas (${Math.round(ignoradas * 100)} %).`
                : `Simulación con una semana típica (adherencia ${Math.round(adherencia * 100)} %, sin pausas ignoradas).`}
            </p>
          </div>
          <table className="ep-tabla">
            <thead>
              <tr>
                <th>SEMANA</th>
                {SENSIBILIDADES.map((s) => <th key={s.id}>{s.titulo.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              {elegida.limites.map((_, k) => (
                <tr key={k}>
                  <td>Semana {semanaActual + k + 2}</td>
                  {SENSIBILIDADES.map((s) => (
                    <td key={s.id}><span className={s.id === form.sensibilidad ? 'ep-tabla__elegida' : ''}>{horas(sim[s.id].limites[k], { corto: true })}</span></td>
                  ))}
                </tr>
              ))}
              <tr className="ep-tabla__meta">
                <td>Meta</td>
                {SENSIBILIDADES.map((s) => (
                  <td key={s.id}><span className={s.id === form.sensibilidad ? 'ep-tabla__elegida' : ''}>{textoLlega(sim[s.id])}</span></td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="mp-aviso mp-aviso--info">
            <Icono src={iconoInfo} tam={18} />
            <span className="w-cuerpo w-texto--2">Focus! calcula el cambio con tus números. Foqui solo te lo explica: nunca decide tu límite.</span>
          </div>
          <div className="w-divisor" />
          <p className="w-sobretitulo">PROYECCIÓN CON «{SENSIBILIDADES.find((s) => s.id === form.sensibilidad).titulo.toUpperCase()}»</p>
          <div className="ep-barras" role="img" aria-label="Proyección del límite en las próximas semanas">
            {barras.map((m, i) => (
              <div key={i}>
                <span className="w-texto">{horas(m, { corto: true })}</span>
                <i className={i === 0 ? 'ep-barras__actual' : ''} style={{ height: `${(m / maxBarra) * 100}px` }} />
                <span className="w-texto w-texto--3">S{semanaActual + i + 1}</span>
              </div>
            ))}
          </div>
          <div className="mp-aviso mp-aviso--exito">
            <Icono src={iconoInfoVerde} tam={16} />
            <span>
              {elegida.llega ? (
                <>
                  <b className="w-cuerpo">Llegarías a tu meta en la semana {elegida.llega}</b>
                  <span className="w-texto w-texto--2">
                    {[['suave', 'Suave'], ['normal', 'Normal'], ['estricta', 'Estricta']]
                      .filter(([id]) => id !== form.sensibilidad && diferencia(id))
                      .map(([id, t]) => `con «${t}» tardarías ${diferencia(id)}`)
                      .join('; ')
                      .replace(/^c/, 'C')}.
                  </span>
                </>
              ) : (
                <>
                  <b className="w-cuerpo">Con tu semana actual el límite no bajaría</b>
                  <span className="w-texto w-texto--2">Cuando tu adherencia mejore, el plan empezará a bajarlo.</span>
                </>
              )}
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
