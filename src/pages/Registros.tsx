import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { formatearFecha, formatearMoneda } from '../utils/formatters';
import type { Registro, Detalle } from '../types';
import { FileText, Search, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

export const Registros = () => {
  const contexto = useContext(AppContext);
  const [busqueda, setBusqueda] = useState('');
  const [registroSeleccionado, setRegistroSeleccionado] = useState<Registro | null>(null);

  // Estados para el nuevo detalle rápido dentro del modal
  const [mostrarFormDetalle, setMostrarFormDetalle] = useState(false);
  const [nuevoDesde, setNuevoDesde] = useState('');
  const [nuevoHasta, setNuevoHasta] = useState('');
  const [nuevoVendido, setNuevoVendido] = useState<number>(0);

  if (!contexto) return null;

  const registrosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return contexto.registros;
    const busquedaLower = busqueda.toLowerCase();
    return contexto.registros.filter(r => 
      r.taller.toLowerCase().includes(busquedaLower) || 
      r.mes.toLowerCase().includes(busquedaLower) ||
      r.ano.toString().includes(busquedaLower)
    );
  }, [contexto.registros, busqueda]);

  const handleEditar = (registro: Registro) => { 
    contexto.setRegistroEditando(registro); 
    contexto.setVista('formulario'); 
  };
  
  const handleEliminar = (id: string) => { 
    if (window.confirm('¿Eliminar este registro y sus detalles de la base de datos?')) { 
      contexto.eliminarRegistro(id); 
      setRegistroSeleccionado(null); 
    } 
  };

  // --- LÓGICA PARA AGREGAR DETALLE DESDE EL MODAL ---
  const agregarDetalleRapido = async () => {
    if (!registroSeleccionado || !nuevoDesde || !nuevoHasta || nuevoVendido <= 0) {
      return alert('Complete todos los campos con valores válidos.');
    }

    const nuevoItemDetalle: Detalle = {
      id: crypto.randomUUID(),
      desde: nuevoDesde,
      hasta: nuevoHasta,
      vendido: nuevoVendido,
      porcentajeAporte: Number(((nuevoVendido / registroSeleccionado.meta) * 100).toFixed(2))
    };

    const nuevosDetalles = [...registroSeleccionado.detalles, nuevoItemDetalle];
    const nuevoLogrado = nuevosDetalles.reduce((acc, d) => acc + d.vendido, 0);
    
    const registroActualizado: Registro = {
      ...registroSeleccionado,
      detalles: nuevosDetalles,
      logrado: nuevoLogrado,
      faltante: Math.max(registroSeleccionado.meta - nuevoLogrado, 0),
      porcentajeCumplido: Number(((nuevoLogrado / registroSeleccionado.meta) * 100).toFixed(2))
    };

    // Sincronizar con Firebase
    await contexto.agregarRegistro(registroActualizado);
    
    // Actualizar estado local del modal para reflejar cambios
    setRegistroSeleccionado(registroActualizado);
    
    // Limpiar formulario interno
    setNuevoDesde(''); setNuevoHasta(''); setNuevoVendido(0);
    setMostrarFormDetalle(false);
  };

  return (
    <div className="animate-in fade-in">
      {/* HEADER PRINCIPAL */}
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div className="page-title">
          <FileText size={24} color="var(--primary)" />
          <div>
            <h2>Gestión de Registros</h2>
            <p className="page-subtitle">Explorador de datos sincronizado en la nube</p>
          </div>
        </div>
        
        <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por taller, mes o año..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem',
                borderRadius: '24px', border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)',
                outline: 'none', transition: 'all 0.3s ease', fontSize: '0.85rem',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button className="btn btn-primary" onClick={() => { contexto.setRegistroEditando(null); contexto.setVista('formulario'); }}>
            <Plus size={16} /> Nuevo Registro
          </button>
        </div>
      </div>

      {/* TABLA DE REGISTROS CON ACCIONES INTEGRADAS */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '90px', textAlign: 'center' }}>Acciones</th>
              <th>Periodo</th>
              <th>Taller</th>
              <th style={{textAlign:'right'}}>Meta</th>
              <th style={{textAlign:'right'}}>Logrado</th>
              <th>Cumplido</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros.</td></tr>
            ) : (
              registrosFiltrados.map((r) => (
                <tr 
                  key={r.id} 
                  className="clickable" 
                  onClick={() => setRegistroSeleccionado(r)}
                  style={{ transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-highlight)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                    {/* El stopPropagation evita que se abra el modal de detalle al hacer clic en editar/eliminar */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditar(r); }}
                      style={{ background: 'rgba(29, 140, 248, 0.1)', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Editar Registro"
                    >
                      <Pencil size={15} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEliminar(r.id); }}
                      style={{ background: 'rgba(255, 76, 76, 0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Eliminar Registro"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                  <td data-label="Periodo:">
                    <strong style={{color: 'var(--text-main)'}}>{r.mes}</strong> <span style={{color: 'var(--text-muted)'}}>{r.ano}</span>
                  </td>
                  <td data-label="Taller:">{r.taller}</td>
                  <td data-label="Meta:" style={{textAlign:'right', color: 'var(--text-muted)'}}>
                    {formatearMoneda(r.meta)}
                  </td>
                  <td data-label="Logrado:" style={{textAlign:'right', color: 'var(--text-main)', fontWeight: 600}}>
                    {formatearMoneda(r.logrado)}
                  </td>
                  <td data-label="Cumplido:">
                    <span style={{ 
                      padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, 
                      backgroundColor: r.porcentajeCumplido >= 100 ? 'rgba(0, 214, 180, 0.15)' : 'rgba(29, 140, 248, 0.15)', 
                      color: r.porcentajeCumplido >= 100 ? 'var(--success)' : 'var(--primary)' 
                    }}>
                      {r.porcentajeCumplido.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE DETALLES SUPER ELEGANTE */}
      {registroSeleccionado && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(10, 11, 14, 0.9)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="animate-in zoom-in-95 duration-300" style={{
            backgroundColor: 'var(--bg-body)', borderRadius: '24px', width: '100%', maxWidth: '950px',
            maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
            boxShadow: '0 0 50px rgba(0,0,0,0.6)', overflow: 'hidden'
          }}>
            
            {/* CABECERA MODAL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{registroSeleccionado.ano}</span> Detalles del Registro
              </h2>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={() => handleEditar(registroSeleccionado)} style={{ borderRadius: '10px' }}>
                  <Pencil size={16} /> Editar
                </button>
                <button className="btn btn-danger" onClick={() => handleEliminar(registroSeleccionado.id)} style={{ borderRadius: '10px' }}>
                  <Trash2 size={16} /> Eliminar
                </button>
                <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 0.5rem' }}></div>
                <button onClick={() => setRegistroSeleccionado(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* CUERPO MODAL */}
            <div style={{ padding: '2.5rem', overflowY: 'auto' }}>
              
              {/* GRID SUPERIOR DE KPIS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem', marginBottom: '3.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Fecha de Registro:</label>
                  <div style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 500 }}>{registroSeleccionado.mes} {registroSeleccionado.ano}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Sucursal / Taller:</label>
                  <div style={{ fontSize: '1.15rem', color: 'var(--primary)', fontWeight: 700 }}>{registroSeleccionado.taller}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Estatus:</label>
                  <span style={{ 
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, 
                    backgroundColor: registroSeleccionado.porcentajeCumplido >= 100 ? 'rgba(0, 214, 180, 0.1)' : 'rgba(255, 141, 114, 0.1)',
                    color: registroSeleccionado.porcentajeCumplido >= 100 ? 'var(--success)' : 'var(--danger)',
                    border: `1px solid ${registroSeleccionado.porcentajeCumplido >= 100 ? 'rgba(0,214,180,0.2)' : 'rgba(255,141,114,0.2)'}`
                  }}>
                    {registroSeleccionado.porcentajeCumplido >= 100 ? 'LOGRADO' : 'PENDIENTE'}
                  </span>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Meta Inicial:</label>
                  <div style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 600 }}>{formatearMoneda(registroSeleccionado.meta)}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Logrado:</label>
                  <div style={{ fontSize: '1.35rem', color: 'var(--primary)', fontWeight: 700 }}>{formatearMoneda(registroSeleccionado.logrado)}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Trabajo Pendiente:</label>
                  <div style={{ fontSize: '1.35rem', color: 'var(--danger)', fontWeight: 600 }}>{formatearMoneda(registroSeleccionado.faltante)}</div>
                </div>
              </div>

              {/* SECCIÓN DE OPERACIONES */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid var(--border)', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>Operaciones Relacionadas</h3>
                  <button 
                    onClick={() => setMostrarFormDetalle(!mostrarFormDetalle)}
                    className="btn btn-outline" 
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', borderRadius: '10px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                  >
                    {mostrarFormDetalle ? <X size={14} /> : <Plus size={14} />} {mostrarFormDetalle ? 'Cancelar' : 'Agregar Operación'}
                  </button>
                </div>

                {/* FORMULARIO INLINE DE AGREGAR DETALLE */}
                {mostrarFormDetalle && (
                  <div className="animate-in slide-in-from-top-2" style={{ 
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', 
                    padding: '1.25rem', backgroundColor: 'var(--bg-body)', borderRadius: '12px', 
                    border: '1px solid var(--primary)', marginBottom: '1.5rem', alignItems: 'end'
                  }}>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label className="form-label" style={{fontSize:'0.7rem'}}>Desde</label>
                      <input type="date" className="form-control" value={nuevoDesde} onChange={e => setNuevoDesde(e.target.value)} />
                    </div>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label className="form-label" style={{fontSize:'0.7rem'}}>Hasta</label>
                      <input type="date" className="form-control" value={nuevoHasta} onChange={e => setNuevoHasta(e.target.value)} />
                    </div>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label className="form-label" style={{fontSize:'0.7rem'}}>Monto Vendido</label>
                      <input type="number" className="form-control" value={nuevoVendido || ''} onChange={e => setNuevoVendido(Number(e.target.value))} />
                    </div>
                    <button className="btn btn-primary" onClick={agregarDetalleRapido} style={{padding:'0.65rem 1.25rem', borderRadius:'8px'}}>
                      <Save size={16} />
                    </button>
                  </div>
                )}
                
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '1rem 0.5rem', width: '60px', color: 'var(--text-muted)' }}>#</th>
                      <th style={{ padding: '1rem 0.5rem', textAlign: 'left' }}>FECHA DESDE</th>
                      <th style={{ padding: '1rem 0.5rem', textAlign: 'left' }}>FECHA HASTA</th>
                      <th style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>MONTO VENDIDO</th>
                      <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>% APORTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registroSeleccionado.detalles.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay operaciones registradas.</td></tr>
                    ) : (
                      registroSeleccionado.detalles.map((det, idx) => (
                        <tr key={det.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '1.25rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>{String(idx + 1).padStart(3, '0')}</td>
                          <td style={{ padding: '1.25rem 0.5rem', fontSize: '0.9rem' }}>{formatearFecha(det.desde)}</td>
                          <td style={{ padding: '1.25rem 0.5rem', fontSize: '0.9rem' }}>{formatearFecha(det.hasta)}</td>
                          <td style={{ padding: '1.25rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>{formatearMoneda(det.vendido)}</td>
                          <td style={{ padding: '1.25rem 0.5rem', textAlign: 'center' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>{det.porcentajeAporte.toFixed(2)}%</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};