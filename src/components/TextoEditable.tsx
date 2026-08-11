import { useState, useEffect, useRef, type CSSProperties, type ElementType } from 'react';
import { useEtiquetas } from '../context/EtiquetasContext';
import { useAuth } from '../context/AuthContext';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';

// =========================================================================
//  TEXTO EDITABLE
//
//  Envuelve cualquier texto de la aplicación para que pueda renombrarse
//  directamente desde la pantalla, sin entrar a Personalización.
//
//  Uso:
//     <TextoEditable clave="kpi.metaAnual" defecto="Meta anual" />
//     <TextoEditable clave="seccion.evolucion" defecto="Evolución" as="h3"
//                    style={{ fontSize: '1rem' }} />
//
//  El lápiz solo aparece cuando:
//     1. El modo edición está encendido (barra flotante de administración), y
//     2. El rol del usuario tiene la capacidad "editarEtiquetas".
//
//  Fuera del modo edición se comporta como un texto normal: no agrega
//  márgenes, bordes ni cambia el diseño.
// =========================================================================

interface Props {
  clave: string;             // identificador único de la etiqueta
  defecto: string;           // texto original (si no se ha renombrado)
  as?: ElementType;          // etiqueta HTML a usar (span por defecto)
  style?: CSSProperties;
  className?: string;
  title?: string;
}

export const TextoEditable = ({ clave, defecto, as, style, className, title }: Props) => {
  const { t, modoEdicion, guardarEtiqueta, etiquetas } = useEtiquetas();
  const { puedeAccion } = useAuth();

  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const texto = t(clave, defecto);
  const puedeEditar = modoEdicion && puedeAccion('editarEtiquetas');
  const fueRenombrado = !!etiquetas[clave];

  const Etiqueta = (as || 'span') as ElementType;

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editando]);

  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setValor(texto);
    setEditando(true);
  };

  const guardar = async () => {
    await guardarEtiqueta(clave, valor.trim());
    setEditando(false);
  };

  const restablecer = async () => {
    await guardarEtiqueta(clave, '');
    setEditando(false);
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); guardar(); }
    if (e.key === 'Escape') { e.preventDefault(); setEditando(false); }
  };

  // --- EDICIÓN ABIERTA ---
  if (editando) {
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={alTeclear}
          placeholder={defecto}
          style={{
            backgroundColor: 'var(--bg-body)', color: 'var(--text-main)',
            border: '2px solid var(--primary)', borderRadius: '6px',
            padding: '2px 7px', fontSize: 'inherit', fontWeight: 'inherit',
            fontFamily: 'inherit', outline: 'none', minWidth: '110px',
            maxWidth: '260px', width: `${Math.max(valor.length + 2, 10)}ch`,
          }}
        />
        <button onClick={guardar} title="Guardar (Enter)"
          style={{ display: 'inline-flex', background: '#22c55e', border: 'none', borderRadius: '5px', color: '#fff', cursor: 'pointer', padding: '3px' }}>
          <Check size={13} />
        </button>
        <button onClick={() => setEditando(false)} title="Cancelar (Esc)"
          style={{ display: 'inline-flex', background: 'var(--bg-highlight)', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}>
          <X size={13} />
        </button>
        {fueRenombrado && (
          <button onClick={restablecer} title="Restablecer el nombre original"
            style={{ display: 'inline-flex', background: 'var(--bg-highlight)', border: '1px solid var(--border)', borderRadius: '5px', color: '#ffbc11', cursor: 'pointer', padding: '3px' }}>
            <RotateCcw size={13} />
          </button>
        )}
      </span>
    );
  }

  // --- MODO EDICIÓN ENCENDIDO (aún sin abrir) ---
  if (puedeEditar) {
    return (
      <Etiqueta className={className} title={title || 'Clic en el lápiz para renombrar'} style={style}>
        <span
          onClick={abrir}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
            borderBottom: `1px dashed ${fueRenombrado ? '#ffbc11' : 'var(--primary)'}`,
            borderRadius: '3px', padding: '0 2px',
          }}
        >
          {texto}
          <Pencil size={11} color={fueRenombrado ? '#ffbc11' : 'var(--primary)'} style={{ flexShrink: 0 }} />
        </span>
      </Etiqueta>
    );
  }

  // --- NORMAL ---
  return <Etiqueta className={className} style={style} title={title}>{texto}</Etiqueta>;
};
