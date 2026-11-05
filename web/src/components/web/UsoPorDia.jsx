// Gráfica de uso por día (Foqui y Reportes): barras esbeltas, eje en horas, línea de límite,
// días por registrar rayados y un globo con el detalle de cada día.
// dias: [{ etiqueta, nombre, min, hoy?, futuro? }] · limite: minutos al día o null
import { horas } from '../../data/plan.js'
import { useGlobo } from './Ayuda.jsx'
import './UsoPorDia.css'

// Escala del eje Y en horas enteras (mínimo 3 h)
function escalaHoras(maxMin) {
  const tope = Math.max(3, Math.ceil(maxMin / 60))
  const paso = tope <= 4 ? 1 : 2
  const topeRedondo = Math.ceil(tope / paso) * paso
  return { tope: topeRedondo * 60, marcas: Array.from({ length: topeRedondo / paso + 1 }, (_, i) => i * paso) }
}

export default function UsoPorDia({ dias, limite, alto: altoGrafica = 170 }) {
  const { props, globo } = useGlobo({ arriba: true })
  const pasados = dias.filter((d) => !d.futuro)
  const { tope, marcas } = escalaHoras(Math.max(limite ?? 0, ...pasados.map((d) => d.min)))
  const alto = (min) => `${Math.min(100, (min / tope) * 100)}%`
  const conUso = pasados.filter((d) => d.min > 0 && !d.hoy)
  const menor = conUso.length > 1 ? Math.min(...conUso.map((d) => d.min)) : null
  return (
    <div className="ud" style={{ height: altoGrafica }}>
      <div className="ud__eje" aria-hidden="true">
        {marcas.map((h) => <span key={h} style={{ bottom: alto(h * 60) }}>{h}h</span>)}
      </div>
      <div className="ud__area">
        <div className="ud__guias" aria-hidden="true">
          {marcas.map((h) => <i key={h} style={{ bottom: alto(h * 60) }} />)}
          {limite != null && <span className="ud__limite" style={{ bottom: alto(limite) }}><em>Límite · {horas(limite, { corto: true })}</em></span>}
        </div>
        {dias.map((d) => {
          const excede = limite != null && d.min > limite
          const tipo = d.futuro ? 'futuro' : d.min <= 0 ? 'vacio' : excede ? 'mal' : 'bien'
          const nota = d.futuro ? 'Día por registrar.'
            : d.min <= 0 ? 'Sin registros o dispositivo en reposo.'
              : excede ? `${horas(d.min - limite)} sobre tu límite.`
                : d.min === menor ? '¡Día con menor tiempo en pantalla!'
                  : limite != null ? 'Dentro de tu límite.' : null
          const etiqueta = `${d.nombre}${d.hoy ? ' (hoy)' : ''}`
          const contenido = (
            <>
              <b>{etiqueta}</b>
              {!d.futuro && <span>{d.min > 0 ? `${horas(d.min)} de uso activo` : '0 minutos'}</span>}
              {nota && <span className={`ud__nota ud__nota--${tipo}`}>{nota}</span>}
            </>
          )
          return (
            <div key={d.etiqueta} tabIndex={0} className={`ud__col ud__col--${tipo}${d.hoy ? ' ud__col--hoy' : ''}`}
              aria-label={`${etiqueta}: ${d.futuro ? 'por registrar' : horas(d.min)}. ${nota ?? ''}`} {...props(contenido)}>
              <div className="ud__pista">
                {d.futuro ? <span className="ud__pendiente">Pendiente</span>
                  : d.min > 0 ? <span className="ud__barra" style={{ height: alto(d.min) }} />
                    : <span className="ud__cero" />}
              </div>
              <small>{d.hoy ? 'Hoy' : d.etiqueta}</small>
            </div>
          )
        })}
      </div>
      {globo}
    </div>
  )
}
