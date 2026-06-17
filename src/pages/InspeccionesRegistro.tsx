import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones, idInspeccion, type Inspeccion } from '../hooks/useInspecciones';
import { ClipboardList, Save, Trash2, Pencil, Info } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)',
  padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', width: '100%',
};

export const InspeccionesRegistro = () => {
  const contexto = useContext(AppContext);
  const { inspecciones, guardarInspeccion, eliminarInspeccion } = useInspecciones();

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();

  const [taller, setTaller] = useState<string>('');
  const [ano, setAno] = useState<string>(String(anoActual));
  const [mes, setMes] = useState<string>(MESES[0] ?? 'Enero');
  const [cantidad, setCantidad] = useState<string>('');

  // Si aún no se ha elegido taller, usa el primero disponible
  const tallerSeleccionado = taller || (talleresOrdenados[0]?.nombre ?? '');

  // ¿Ya hay un registro para este taller/año/mes? (se sobrescribirá al guardar)
  const existente = useMemo(
    () => inspecciones.find(i => i.taller === tallerSeleccionado && String(i.ano) === ano && i.mes === mes),
    [inspecciones, tallerSeleccionado, ano, mes]
  );

  const registrosFiltrados = useMemo(() => {
    return inspecciones
      .filter(i => i.taller === tallerSeleccionado && String(i.ano) === ano)
      .sort((a, b) => MESES.indexOf(a.mes) - MESES.indexOf(b.mes));
  }, [inspecciones, tallerSeleccionado, ano]);

  const totalAno = useMemo(() => registrosFiltrados.reduce((acc, r) => acc + r.cantidad, 0), [registrosFiltrados]);

  const guardar = () => {
    if (!tallerSeleccionado) { alert('Primero debes crear o seleccionar un taller.'); return; }
    const cant = parseInt(cantidad, 10);
    if (isNaN(cant) || cant < 0) { alert('Ingresa un número de inspecciones válido.'); return; }
    const insp: Inspeccion = {
      id: idInspeccion(tallerSeleccionado, ano, mes),
      taller: tallerSeleccionado,
      ano: parseInt(ano, 10),
      mes,
      cantidad: cant,
    };
    guardarInspeccion(insp);
    setCantidad('');
  };

  const editar = (i: Inspeccion) => {
    setTaller(i.taller);
    setAno(String(i.ano));
    setMes(i.mes);
    setCantidad(String(i.cantidad));
  };

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ClipboardList size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Registro de Inspecciones</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Captura el número de inspecciones por mes</p>
          </div>
        </div>
      </div>

      {talleresOrdenados.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', marginTop: '1.5rem' }}>
          <Info size={40} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No hay talleres</h3>
          <p style={{ color: 'var(--text-muted)' }}>Crea al menos un taller en el módulo "Talleres" para poder registrar inspecciones.</p>
        </div>
      ) : (
        <>
          {/* FORMULARIO */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 className="detail-section-title">Nueva captura</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>TALLER</label>
                <select style={inputStyle} value={tallerSeleccionado} onChange={(e) => setTaller(e.target.value)}>
                  {talleresOrdenados.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>AÑO</label>
                <input type="number" style={inputStyle} value={ano} onChange={(e) => setAno(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>MES</label>
                <select style={inputStyle} value={mes} onChange={(e) => setMes(e.target.value)}>
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>INSPECCIONES</label>
                <input type="number" min={0} style={inputStyle} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={guardar} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.55rem 1rem', borderRadius: '6px', fontWeight: 600, width: '100%' }}>
                  <Save size={16} /> Guardar
                </button>
              </div>
            </div>
            {existente && (
              <p style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Info size={14} color="var(--primary)" />
                Ya existe un registro para {mes} {ano} con {existente.cantidad} inspecciones. Al guardar se actualizará.
              </p>
            )}
          </div>

          {/* TABLA DE REGISTROS DEL AÑO */}
          <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Inspecciones registradas</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{tallerSeleccionado} — {ano}</span>
            </div>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'center' }}>Inspecciones</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Sin registros para este taller y año.</td></tr>
                ) : (
                  registrosFiltrados.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.mes}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>{r.cantidad}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button onClick={() => editar(r)} title="Editar" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: 'var(--primary)', display: 'inline-flex' }}>
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => { if (confirm(`¿Eliminar el registro de ${r.mes} ${r.ano}?`)) eliminarInspeccion(r.id); }} title="Eliminar" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {registrosFiltrados.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total {ano}</strong></td>
                    <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{totalAno}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
};