// Tarjeta base del portal: etiqueta en ámbar, título (con ayuda "?" opcional) y un elemento a la derecha.
export default function Card({ etiqueta, titulo, ayuda, extra, className = '', children }) {
  return (
    <section className={`card ${className}`}>
      <header className="card__header">
        <div className="card__titulos">
          <p className="card__etiqueta">{etiqueta}</p>
          <div className="card__titulo-fila">
            <h2 className="card__titulo">{titulo}</h2>
            {ayuda}
          </div>
        </div>
        {extra}
      </header>
      {children}
    </section>
  )
}

export function Insignia({ children, vivo = false }) {
  return (
    <span className={`insignia${vivo ? ' insignia--vivo' : ''}`}>
      {vivo && <span className="estado__punto" aria-hidden="true" />}
      {children}
    </span>
  )
}
