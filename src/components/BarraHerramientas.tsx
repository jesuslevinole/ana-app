import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import { Pencil, Eye, EyeOff, X, ChevronUp, ChevronDown, Wrench } from 'lucide-react';

// =========================================================================
//  BARRA DE HERRAMIENTAS DE ADMINISTRACIÓN
//
//  Barra flotante en la esquina inferior derecha con dos funciones:
//
//   1. MODO EDICIÓN  — activa los lápices para renombrar títulos, tarjetas
//      y gráficas directamente en cada vista.
//      Requiere la capacidad "editarEtiquetas".
//
//   2. VER COMO      — navega la aplicación con los permisos de otro rol,
//      para comprobar qué ve cada quien sin cerrar sesión.
//      Requiere la capacidad "verComo".
//
//  Si el rol no tiene ninguna de las dos capacidades, la barra no aparece.
// =========================================================================

export const BarraHerramientas = () => {
  const {
    roles, rolReal, rol,
    estaSimulando, rolSimuladoId, simularRol, detenerSimulacion,
  } = useAuth();
  const { modoEdicion, setModoEdicion } = useEtiquetas();

  const [abierta, setAbierta] = useState(false);

  // Las capacidades se evalúan sobre el ROL REAL: si estás simulando un rol
  // limitado, la barra sigue disponible para poder salir de la simulación.
  const puedeEditar = rolReal?.esAdmin || !!rolReal?.acciones?.editarEtiquetas;
  const puedeVerComo = rolReal?.esAdmin || !!rolReal?.acciones?.verComo;

  if (!puedeEditar && !puedeVerComo) return null;

  const rolesOrdenados = [...roles].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <>
      {/* CINTA SUPERIOR CUANDO SE ESTÁ SIMULANDO UN ROL */}
      {estaSimulando && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem',
          padding: '0.45rem 1rem', backgroundColor: '#7c3aed', color: '#fff',
          fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.3px'
        }}>
          <Eye size={15} />
          Viendo la aplicación como: {rol?.nombre || 'Rol'}
          <button
            onClick={detenerSimulacion}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff', borderRadius: '12px', padding: '2px 10px',
              fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer'
            }}
          >
            <X size={12} /> Salir
          </button>
        </div>
      )}

      {/* BARRA FLOTANTE */}
      <div style={{
        position: 'fixed', right: '18px', bottom: '18px', zIndex: 95,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem'
      }}>
        {abierta && (
          <div style={{
            backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '0.9rem 1rem', minWidth: '260px',
            boxShadow: '0 12px 34px rgba(0,0,0,0.45)'
          }}>
            {/* MODO EDICIÓN */}
            {puedeEditar && (
              <div style={{ marginBottom: puedeVerComo ? '1rem' : 0 }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.5rem' }}>
                  Editar nombres
                </div>
                <button
                  onClick={() => setModoEdicion(!modoEdicion)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '0.6rem', padding: '0.55rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                    backgroundColor: modoEdicion ? 'var(--primary)' : 'var(--bg-body)',
                    border: `1px solid ${modoEdicion ? 'var(--primary)' : 'var(--border)'}`,
                    color: modoEdicion ? '#fff' : 'var(--text-main)',
                    fontSize: '0.82rem', fontWeight: 700
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Pencil size={15} /> Modo edición
                  </span>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.5px',
                    padding: '2px 8px', borderRadius: '10px',
                    backgroundColor: modoEdicion ? 'rgba(255,255,255,0.25)' : 'var(--bg-highlight)',
                    color: modoEdicion ? '#fff' : 'var(--text-muted)'
                  }}>
                    {modoEdicion ? 'ACTIVO' : 'APAGADO'}
                  </span>
                </button>
                {modoEdicion && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Haz clic en el lápiz junto a cualquier texto para renombrarlo. Enter guarda, Esc cancela.
                  </p>
                )}
              </div>
            )}

            {/* VER COMO */}
            {puedeVerComo && (
              <div>
                <div style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.5rem' }}>
                  Ver como
                </div>
                <select
                  value={rolSimuladoId}
                  onChange={e => {
                    const v = e.target.value;
                    if (v) simularRol(v); else detenerSimulacion();
                  }}
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.82rem' }}
                >
                  <option value="">Mi rol ({rolReal?.nombre || 'Sin rol'})</option>
                  {rolesOrdenados.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  El menú y las vistas se ajustan a los permisos del rol elegido.
                </p>
              </div>
            )}
          </div>
        )}

        {/* BOTÓN PARA ABRIR / CERRAR */}
        <button
          onClick={() => setAbierta(a => !a)}
          title="Herramientas de administración"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1rem', borderRadius: '24px', cursor: 'pointer', border: 'none',
            backgroundColor: (modoEdicion || estaSimulando) ? '#7c3aed' : 'var(--primary)',
            color: '#fff', fontWeight: 800, fontSize: '0.8rem',
            boxShadow: '0 8px 22px rgba(0,0,0,0.4)'
          }}
        >
          {modoEdicion ? <Pencil size={16} /> : estaSimulando ? <EyeOff size={16} /> : <Wrench size={16} />}
          {modoEdicion ? 'Editando' : estaSimulando ? 'Simulando' : 'Herramientas'}
          {abierta ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
    </>
  );
};
