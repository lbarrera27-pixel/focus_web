import { useState } from 'react'
import Icono from '../../components/Icono.jsx'
import iconoMas from '../../assets/icons/aj-mas.svg'
import iconoTimer from '../../assets/icons/aj-timer.svg'
import iconoConfig from '../../assets/icons/aj-config.svg'
import iconoFoco from '../../assets/icons/aj-foco.svg'
import iconoCalendario from '../../assets/icons/aj-calendario.svg'
import { Cabecera, Chip, ChipNivel, Interruptor, Nota, Pasos } from './Comunes.jsx'
import { progresionSemanal } from '../../data/ajustes.js'

const NIVELES = [
  { nivel: 1, titulo: 'Retraso simple', desc: 'Una espera corta con cuenta regresiva antes de abrir la app. Ideal para empezar.', fondo: '#fef3c7', texto: '#b45309' },
  { nivel: 2, titulo: 'Pregunta reflexiva', desc: 'Te pregunta para qué quieres abrirla y muestra cuántas aperturas te quedan.', fondo: '#e0f2fe', texto: '#0369a1' },
  { nivel: 3, titulo: 'Respiración guiada', desc: 'Pausa larga con respiración, recordatorio de tu meta y doble confirmación para continuar.', fondo: '#ffe4e6', texto: '#9f1239' },
]

const EJERCICIOS = [
  { id: 'respiracion', titulo: 'Respiración guiada', desc: 'Ciclo visual de inhalación y exhalación' },
  { id: 'pregunta', titulo: 'Pregunta reflexiva', desc: 'Pregunta breve antes de continuar' },
  { id: 'retraso', titulo: 'Retraso simple', desc: 'Solo temporizador y cuenta regresiva' },
]

const DIAS = [
  { n: 1, letra: 'L', corto: 'Lun' },
  { n: 2, letra: 'M', corto: 'Mar' },
  { n: 3, letra: 'M', corto: 'Mié' },
  { n: 4, letra: 'J', corto: 'Jue' },
  { n: 5, letra: 'V', corto: 'Vie' },
  { n: 6, letra: 'S', corto: 'Sáb' },
  { n: 0, letra: 'D', corto: 'Dom' },
]

const minutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const aHhmm = (min) => {
  const t = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// Columna del reloj (horas o minutos). Fuera de RelojDigital para que no se vuelva a montar y conserve el foco.
function ColumnaReloj({ texto, paso, nombre, etiqueta, mover }) {
  const teclas = (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); mover(paso) }
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(-paso) }
  }
  return (
    <span className="aj-reloj__columna">
      <button type="button" aria-label={`Subir ${nombre} de ${etiqueta.toLowerCase()}`} onClick={() => mover(paso)}>▲</button>
      <span className="aj-reloj__digitos" tabIndex={0} role="spinbutton" aria-label={`${nombre} de ${etiqueta.toLowerCase()}`}
        aria-valuenow={Number(texto)} onKeyDown={teclas}>{texto}</span>
      <button type="button" aria-label={`Bajar ${nombre} de ${etiqueta.toLowerCase()}`} onClick={() => mover(-paso)}>▼</button>
    </span>
  )
}

// Reloj digital: horas y minutos grandes con flechas; también responde a las flechas del teclado
function RelojDigital({ etiqueta, valor, onCambio }) {
  const [h, m] = valor.split(':')
  const mover = (delta) => onCambio(aHhmm(minutos(valor) + delta))
  return (
    <div className="aj-reloj">
      <small>{etiqueta}</small>
      <div className="aj-reloj__pantalla">
        <ColumnaReloj texto={h} paso={60} nombre="horas" etiqueta={etiqueta} mover={mover} />
        <span className="aj-reloj__dos-puntos" aria-hidden="true">:</span>
        <ColumnaReloj texto={m} paso={5} nombre="minutos" etiqueta={etiqueta} mover={mover} />
      </div>
    </div>
  )
}

export default function TabReglas({ datos, locales, setLocales }) {
  const [editando, setEditando] = useState(false)
  const cambiar = (fn) => setLocales((l) => fn(structuredClone(l)))
  const progresion = progresionSemanal(datos.ajustes)
  const foco = locales.modoFoco
  const horas = Math.max(0, (minutos(foco.fin) - minutos(foco.inicio)) / 60)
  const ejercicio = EJERCICIOS.find((e) => e.id === locales.ejercicio)
  // Escala del calendario: de la hora de inicio a la de fin, en bloques de 2 h
  const inicioH = Math.floor(minutos(foco.inicio) / 60)
  const marcas = Array.from({ length: Math.max(2, Math.ceil(horas / 2) + 1) }, (_, i) => String((inicioH + i * 2) % 24).padStart(2, '0'))

  return (
    <div className="aj-grid aj-grid--reglas">
      {/* ---------- Niveles ---------- */}
      <section className="aj-panel">
        <Cabecera
          etiqueta="NIVELES DE FRICCIÓN"
          titulo="Cómo interviene Focus!"
          desc="Qué pasa cada vez que intentas abrir una app restringida."
          extra={<Chip>3 niveles</Chip>}
        />
        <div className="aj-niveles">
          {NIVELES.map((n) => (
            <div key={n.nivel} className="aj-nivel-fila" style={{ '--fondo-nivel': n.fondo, '--texto-nivel': n.texto }}>
              <span className="aj-nivel-fila__chip">
                <small>NIVEL</small>
                <b>{n.nivel}</b>
              </span>
              <span className="aj-nivel-fila__texto">
                <b>{n.titulo}</b>
                <small>{n.desc}</small>
                <span className="aj-nivel-fila__intensidad" aria-label={`Intensidad ${n.nivel} de 3`}>
                  {[1, 2, 3].map((i) => <i key={i} className={i <= n.nivel ? 'aj-on' : ''} />)}
                  <em>Intensidad {['baja', 'media', 'alta'][n.nivel - 1]}</em>
                </span>
              </span>
              <span className="aj-nivel-fila__espera">
                <small>ESPERA</small>
                <b>{locales.niveles[n.nivel]} s</b>
              </span>
              {editando && (
                <Pasos
                  etiqueta={`la espera del nivel ${n.nivel}`}
                  deshabilitarMenos={locales.niveles[n.nivel] <= 1}
                  deshabilitarMas={locales.niveles[n.nivel] >= 60}
                  onMenos={() => cambiar((l) => ((l.niveles[n.nivel] -= 1), l))}
                  onMas={() => cambiar((l) => ((l.niveles[n.nivel] += 1), l))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="aj-progresion">
          <p className="aj-progresion__titulo">PROGRESIÓN SUGERIDA POR LA IA · AJUSTES SEMANALES DE LA API</p>
          <div className="aj-progresion__semanas">
            {progresion.length ? (
              progresion.map((s) => (
                <div key={s.semana} className="aj-semana" title={`Adherencia ${Math.round(s.adherencia * 100)}% · cambio ${s.cambio}%`}>
                  <small>SEMANA {s.semana}</small>
                  <ChipNivel nivel={s.nivel} />
                  <span>{locales.niveles[s.nivel]} s de espera</span>
                </div>
              ))
            ) : (
              <p className="aj-progresion__vacio">Aún no hay ajustes semanales. Regístralos desde Clústeres o con POST /planes/{'{n}'}/ajustes.</p>
            )}
          </div>
        </div>

        <button type="button" className="aj-boton-punteado" onClick={() => setEditando((e) => !e)} aria-pressed={editando}>
          <Icono src={iconoMas} tam={16} />
          {editando ? 'Listo' : 'Personalizar tiempos de espera'}
        </button>
        <div className="aj-pie">
          <Nota>La IA sugiere el nivel de cada semana según tu adherencia al plan.</Nota>
        </div>
      </section>

      <div className="aj-columna">
        {/* ---------- Calibración ---------- */}
        <section className="aj-panel aj-panel--calibracion">
          <Cabecera
            etiqueta="FRICCIÓN PROGRESIVA"
            titulo="Calibración del Sistema"
            desc="Ajusta la intensidad de las pausas conscientes."
            extra={<Chip punto>Adaptativo</Chip>}
          />
          <div className="aj-temporizador">
            <div className="aj-temporizador__cabeza">
              <span className="aj-icono-caja" style={{ background: '#fef3c7' }}><Icono src={iconoTimer} tam={17} /></span>
              <span>
                <b>Duración del temporizador de espera</b>
                <small>Tiempo mínimo antes de permitir continuar</small>
              </span>
              <strong>{locales.temporizador}s</strong>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              value={locales.temporizador}
              onChange={(e) => cambiar((l) => ((l.temporizador = Number(e.target.value)), l))}
              className="aj-rango"
              style={{ '--pct': `${((locales.temporizador - 3) / 12) * 100}%` }}
              aria-label="Duración del temporizador de espera"
            />
            <div className="aj-temporizador__escala">
              <small>3s · Suave</small>
              <small>9s · Recomendado</small>
              <small>15s · Intenso</small>
            </div>
          </div>

          <div className="aj-ejercicios">
            <div className="aj-ejercicios__cabeza">
              <small className="micro">TIPO DE EJERCICIO CONSCIENTE</small>
              <small>Se aplica en la Fricción Nivel 2</small>
            </div>
            <div className="aj-ejercicios__opciones" role="radiogroup" aria-label="Tipo de ejercicio consciente">
              {EJERCICIOS.map((e, i) => {
                const sel = e.id === locales.ejercicio
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    className={`aj-ejercicio${sel ? ' aj-ejercicio--sel' : ''}`}
                    onClick={() => cambiar((l) => ((l.ejercicio = e.id), l))}
                  >
                    <span className="aj-ejercicio__num">{i + 1}</span>
                    <span>
                      <b>{e.titulo}</b>
                      <small>{e.desc}</small>
                    </span>
                    <i />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="aj-config-actual">
            <span className="aj-icono-caja aj-icono-caja--azul"><Icono src={iconoConfig} tam={16} /></span>
            <span>
              <small>CONFIGURACIÓN ACTUAL</small>
              <b>{locales.temporizador}s · {ejercicio.titulo} · Escalamiento IA {datos.ajustes?.length ? 'activo' : 'sin ajustes aún'}</b>
            </span>
          </div>
        </section>

        {/* ---------- Modo foco ---------- */}
        <section className="aj-panel aj-panel--foco">
          <Cabecera
            etiqueta="DEEP WORK SCHEDULE"
            titulo="Modo Foco Programado"
            desc="Activa automáticamente la protección durante tus bloques de trabajo."
            extra={<Interruptor activo={foco.activo} etiqueta="Modo Foco Programado" onCambio={(v) => cambiar((l) => ((l.modoFoco.activo = v), l))} />}
          />
          <div className={`aj-foco${foco.activo ? '' : ' aj-foco--apagado'}`}>
            <div className="aj-dias">
              {DIAS.map((d) => {
                const sel = foco.dias.includes(d.n)
                return (
                  <button
                    key={d.corto}
                    type="button"
                    aria-pressed={sel}
                    className={`aj-dia${sel ? ' aj-dia--sel' : ''}`}
                    onClick={() =>
                      cambiar((l) => {
                        const s = new Set(l.modoFoco.dias)
                        s.has(d.n) ? s.delete(d.n) : s.add(d.n)
                        l.modoFoco.dias = [...s].sort()
                        return l
                      })
                    }
                  >
                    <b>{d.letra}</b>
                    <small>{d.corto}</small>
                  </button>
                )
              })}
            </div>

            <div className="aj-horas aj-horas--reloj">
              <RelojDigital etiqueta="HORA DE INICIO" valor={foco.inicio} onCambio={(v) => cambiar((l) => ((l.modoFoco.inicio = v), l))} />
              <span className="aj-horas__flecha" aria-hidden="true">→</span>
              <RelojDigital etiqueta="HORA DE FIN" valor={foco.fin} onCambio={(v) => cambiar((l) => ((l.modoFoco.fin = v), l))} />
              <span className={`aj-chip-estado ${horas > 0 ? 'aj-chip-estado--verde' : 'aj-chip-estado--rojo'}`}>
                {horas > 0 ? `${Number.isInteger(horas) ? horas : horas.toFixed(1)} h por día` : 'Revisa las horas'}
              </span>
            </div>

            <div className="aj-calendario">
              <div className="aj-calendario__horas">
                {marcas.map((m, i) => (
                  <small key={i}>{m}</small>
                ))}
              </div>
              <div className="aj-calendario__dias">
                {DIAS.map((d) => (
                  <div key={d.corto} className="aj-calendario__dia">
                    <small className="aj-calendario__nombre">{d.corto}</small>
                    <span className="aj-calendario__celda">
                      {foco.dias.includes(d.n) && horas > 0 && (
                        <span className="aj-bloque">
                          <Icono src={iconoFoco} tam={13} />
                          <b>FOCO</b>
                          <small>{foco.inicio}–{foco.fin}</small>
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="aj-foco__resumen">
              <Icono src={iconoCalendario} tam={15} />
              <span>
                <b>{foco.dias.length} días activos · {foco.inicio}–{foco.fin}</b>
                <small>Las notificaciones se silenciarán y se aplicará Fricción Nivel 3.</small>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
