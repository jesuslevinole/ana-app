import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import { SECCIONES_ETIQUETAS } from '../config/navegacion';
import { Type, Save, RotateCcw, Lock, Search, CheckCircle2, Info } from 'lucide-react';

// =========================================================================
//  PERSONALIZACIÓN DE NOMBRES
//
//  Permite al administrador renombrar cualquier elemento visible de la app
//  (menú, términos del negocio, acciones). Los cambios se guardan en
//  Firestore y se aplican de inmediato para todos los usuarios.
//
//  Dejar un campo vacío restablece el nombre original.
// =========================================================================

export const Personalizacion = () => {
  const { puedeVer } = useAuth();
  const { etiquetas, t, guardarVarias } = useEtiquetas();

  const secciones = useMemo(() => SECCIONES_ETIQUETAS(), []);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Precarga el borrador con lo que ya está guardado
  useEffect(() => {
    setBorrador({ ...etiquetas });
  }, [etiquetas]);

  if (!puedeVer('personalizacion')) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acceso restringido</h3>
        <p style={{ color: 'var(--text-muted)' }}>Tu rol no tiene permiso para personalizar los nombres del sistema.</p>
      </div>
    );
  }

  // Cambios pendientes de guardar
  const cambios = useMemo(() => {
    const pendientes: Record<string, string> = {};
    Object.keys(borrador).forEach(k => {
      const actual = etiquetas[k] || '';
      if ((borrador[k] || '') !== actual) pendientes[k] = borrador[k] || '';
    });
    return pendientes;
  }, [borrador, etiquetas]);

  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    if (!hayCambios) return;
    setGuardando(true);
    await guardarVarias(cambios);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2200);
  };

  const descartar = () => setBorrador({ ...etiquetas });

  const restablecerTodo = async () => {
    if (!confirm('¿Restablecer TODOS los nombres a sus valores originales?')) return;
    const vacios: Record<string, string> = {};
    secciones.forEach(s => s.items.forEach(i => { vacios[i.clave] = ''; }));
    setGuardando(true);
    await guardarVarias(vacios);
    setBorrador({});
    setGuardando(false);
  };

  const coincide = (texto: string) =>
    !busqueda.trim() || texto.toLowerCase().includes(busqueda.trim().toLowerCase());

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Type size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{t('vista.personalizacion', 'Personalización')}</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Cambia el nombre de cualquier elemento del sistema
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {guardado && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} /> Guardado
            </span>
          )}
          {hayCambios && (
            <button className="btn btn-outline" onClick={descartar} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={16} /> Descartar
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={guardar}
            disabled={!hayCambios || guardando}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (!hayCambios || guardando) ? 0.55 : 1, cursor: (!hayCambios || guardando) ? 'not-allowed' : 'pointer' }}
          >
            <Save size={16} />
            {guardando ? 'Guardando...' : hayCambios ? `Guardar (${Object.keys(cambios).length})` : 'Guardar'}
          </button>
        </div>
      </div>

      {/* AYUDA */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
        padding: '0.85rem 1.1rem', borderRadius: '10px', marginBottom: '1.25rem',
        backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)', borderLeft: '4px solid var(--primary)'
      }}>
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
          Escribe el nombre que quieras usar y presiona <strong>Guardar</strong>. El cambio se aplica de inmediato
          para todos los usuarios. Si dejas un campo <strong>vacío</strong>, vuelve a mostrarse el nombre original.
        </span>
      </div>

      {/* BUSCADOR */}
      <div className="filter-bar" style={{ marginBottom: '1.25rem' }}>
        <div className="filter-group" style={{ flex: 1 }}>
          <label>Buscar elemento</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-control"
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px' }}
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Ej: Taller, Dashboard, Meta..."
            />
          </div>
        </div>
      </div>

      {/* SECCIONES */}
      {secciones.map(sec => {
        const items = sec.items.filter(i => coincide(i.etiqueta) || coincide(borrador[i.clave] || '') || coincide(i.descripcion));
        if (items.length === 0) return null;
        return (
          <div key={sec.seccion} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div className="report-header" style={{ borderTop: '3px solid var(--primary)' }}>
              {sec.seccion.toUpperCase()}
            </div>
            <div style={{ padding: '0.5rem 0' }}>
              {items.map(item => {
                const valor = borrador[item.clave] ?? '';
                const modificado = (etiquetas[item.clave] || '') !== '';
                return (
                  <div
                    key={item.clave}
                    style={{
                      display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)',
                      gap: '1rem', alignItems: 'center',
                      padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {item.etiqueta}
                        {modificado && (
                          <span style={{
                            marginLeft: '0.5rem', fontSize: '0.58rem', fontWeight: 800,
                            color: '#ffbc11', border: '1px solid #ffbc11', borderRadius: '9px', padding: '1px 6px'
                          }}>
                            RENOMBRADO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.descripcion}</div>
                    </div>
                    <input
                      className="form-control"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      value={valor}
                      onChange={e => setBorrador(b => ({ ...b, [item.clave]: e.target.value }))}
                      placeholder={item.etiqueta}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* RESTABLECER TODO */}
      <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
        <button
          className="btn btn-outline"
          onClick={restablecerTodo}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
        >
          <RotateCcw size={16} /> Restablecer todos los nombres
        </button>
      </div>
    </div>
  );
};
