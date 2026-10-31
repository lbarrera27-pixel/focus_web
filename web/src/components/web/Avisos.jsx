// Web/Aviso (Figma e31, e32): avisos flotantes abajo a la derecha.
// Los de éxito e información se van solos a los 5 s; los de error se quedan hasta cerrarlos o reintentar.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import iconoExito from '../../assets/icons/w-aviso-exito.svg'
import iconoInfo from '../../assets/icons/w-aviso-info.svg'
import iconoAlerta from '../../assets/icons/w-aviso-alerta.svg'
import iconoError from '../../assets/icons/w-aviso-error.svg'
import iconoCerrar from '../../assets/icons/w-aviso-cerrar.svg'
import './web.css'

const ICONOS = { exito: iconoExito, info: iconoInfo, alerta: iconoAlerta, error: iconoError }
const DURACION = 5000

const Contexto = createContext(() => {})

// avisar({ tono, titulo, detalle, accion: { texto, alPulsar }, fijo, id }) → id
// Con el mismo id se reemplaza el aviso anterior (p. ej. "Guardando…" → "Guardado")
export const useAvisos = () => useContext(Contexto)

function Aviso({ aviso, onCerrar }) {
  const { id, tono = 'info', titulo, detalle, accion, fijo } = aviso
  useEffect(() => {
    if (fijo || tono === 'error') return
    const t = setTimeout(() => onCerrar(id), DURACION)
    return () => clearTimeout(t)
  }, [aviso, id, fijo, tono, onCerrar])

  return (
    <div className={`w-aviso w-aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <span className="w-aviso__icono"><img src={ICONOS[tono]} alt="" /></span>
      <div className="w-aviso__texto">
        <b>{titulo}</b>
        {detalle && <span>{detalle}</span>}
      </div>
      {accion && (
        <button type="button" className="w-aviso__accion" onClick={() => { onCerrar(id); accion.alPulsar() }}>
          {accion.texto}
        </button>
      )}
      <button type="button" className="w-aviso__cerrar" aria-label="Cerrar aviso" onClick={() => onCerrar(id)}>
        <img src={iconoCerrar} alt="" />
      </button>
    </div>
  )
}

export function ProveedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([])
  const contador = useRef(0)

  const cerrar = useCallback((id) => setAvisos((a) => a.filter((x) => x.id !== id)), [])
  const avisar = useCallback((aviso) => {
    const id = aviso.id ?? `aviso-${++contador.current}`
    // Un objeto nuevo reinicia el temporizador aunque el id se repita
    setAvisos((a) => [...a.filter((x) => x.id !== id), { ...aviso, id }].slice(-3))
    return id
  }, [])
  const valor = useMemo(() => Object.assign(avisar, { cerrar }), [avisar, cerrar])

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="w-avisos" aria-live="polite">
        {avisos.map((a, i) => (
          <div key={a.id} className={i < avisos.length - 1 && a.tono === 'info' ? 'w-aviso--atenuado' : ''}>
            <Aviso aviso={a} onCerrar={cerrar} />
          </div>
        ))}
      </div>
    </Contexto.Provider>
  )
}
