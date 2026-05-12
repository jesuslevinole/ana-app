import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { formatearFecha, formatearMoneda } from '../utils/formatters';
import type { Registro, Detalle } from '../types';
import { FileText, Search, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

export const Registros = () => {
  const contexto = useContext(AppContext);
  const [busqueda, setBusqueda] = useState('');
  const [registroSeleccionado, setRegistroSeleccionado] = useState<Registro | null>(null);

  // --- ESTADOS PARA LOS FILTROS ---
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroTaller, setFiltroTaller] = useState('');

  // Estados para el formulario de detalle rápido dentro del modal
  const [mostrarFormDetalle, setMostrarFormDetalle] = useState(false);
  const [detalleEditandoId, setDetalleEditandoId] = useState<string | null>(null);
  const [nuevoDesde, setNuevoDesde] = useState('');
  const [nuevoHasta, setNuevoHasta] = useState('');
  const [nuevoVendido, setNuevoVendido] = useState<number>(0);

  if (!contexto) return null;

  // --- OBTENER OPCIONES ÚNICAS PARA LOS DROPDOWNS ---
  const anosDisponibles = useMemo(() => {
    const anos = contexto.registros.map(r => r.ano);
    return Array.from(new Set(anos)).sort((a, b) => b - a); // Mayor a menor
  }, [contexto.registros]);

  const mesesDisponibles = useMemo(() => {
    const meses = contexto.registros.map(r => r.mes);
    return Array.from(new Set(meses));
  }, [contexto.registros]);

  const talleresDisponibles = useMemo(() => {
    return [...contexto.talleres]
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map(t => t.nombre);
  }, [contexto.talleres]);

  // --- APLICAR FILTROS Y BÚSQUEDA ---
  const registrosFiltrados = useMemo(() => {
    let resultado = contexto.registros;

    if (filtroAno) resultado = resultado.filter(r => r.ano.toString() === filtroAno);
    if (filtroMes) resultado = resultado.filter(r => r.mes === filtroMes);
    if (filtroTaller) resultado = resultado.filter(r => r.taller === filtroTaller);

    if (busqueda.trim()) {
      const busquedaLower = busqueda.toLowerCase();
      resultado = resultado.filter(r => 
        r.taller.toLowerCase().includes(busquedaLower) || 
        r.mes.toLowerCase().includes(busquedaLower) ||
        r.ano.toString().includes(busquedaLower)
      );
    }

    return resultado;
  }, [contexto.registros, busqueda, filtroAno, filtroMes, filtroTaller]);

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

  // --- LÓGICA DE DETALLES EN MODAL (AGREGAR Y EDITAR) ---
  const toggleFormDetalle = () => {
    if (mostrarFormDetalle) {
      setMostrarFormDetalle(false);
      setDetalleEditandoId(null);
      setNuevoDesde('');
      setNuevoHasta('');
      setNuevoVendido(0);
    } else {
      setMostrarFormDetalle(true);
    }
  };

  const iniciarEdicionDetalle = (det: Detalle) => {
    setDetalleEditandoId(det.id);
    setNuevoDesde(det.desde);
    setNuevoHasta(det.hasta);
    setNuevoVendido(det.vendido);
    setMostrarFormDetalle(true);
  };

  const guardarDetalleRapido = async () => {
    if (!registroSeleccionado || !nuevoDesde || !nuevoHasta || nuevoVendido <= 0) {
      return alert('Complete todos los campos con valores válidos.');
    }

    let nuevosDetalles = [...registroSeleccionado.detalles];

    if (detalleEditandoId) {
      // Modo Edición: Actualizar detalle existente
      nuevosDetalles = nuevosDetalles.map(d => {
        if (d.id === detalleEditandoId) {
          return {
            ...d,
            desde: nuevoDesde,
            hasta: nuevoHasta,
            vendido: nuevoVendido,
            porcentajeAporte: Number(((nuevoVendido / registroSeleccionado.meta) * 100).toFixed(2))
          };
        }
        return d;
      });
    } else {
      // Modo Agregar: Nuevo detalle
      const nuevoItemDetalle: Detalle = {
        id: crypto.randomUUID(),
        desde: nuevoDesde,
        hasta: nuevoHasta,
        vendido: nuevoVendido,
        porcentajeAporte: Number(((nuevoVendido / registroSeleccionado.meta) * 100).toFixed(2))
      };
      nuevosDetalles.push(nuevoItemDetalle);
    }

    const nuevoLogrado = nuevosDetalles.reduce((acc, d) => acc + d.vendido, 0);
    
    const registroActualizado: Registro = {
      ...registroSeleccionado,
      detalles: nuevosDetalles,
      logrado: nuevoLogrado,
      faltante: Math.max(registroSeleccionado.meta - nuevoLogrado, 0),
      porcentajeCumplido: Number(((nuevoLogrado / registroSeleccionado.meta) * 100).toFixed(2))
    };

    await contexto.agregarRegistro(registroActualizado);
    setRegistroSeleccionado(registroActualizado);
    
    setNuevoDesde(''); setNuevoHasta(''); setNuevoVendido(0);
    setDetalleEditandoId(null);
    setMostrarFormDetalle(false);
  };

  const eliminarDetalleRapido = async (idDetalle: string) => {
    if (!registroSeleccionado) return;
    if (!window.confirm('¿Está seguro de eliminar esta operación?')) return;

    const nuevosDetalles = registroSeleccionado.detalles.filter(d => d.id !== idDetalle);
    const nuevoLogrado = nuevosDetalles.reduce((acc, d) => acc + d.vendido, 0);

    const registroActualizado: Registro = {
      ...registroSeleccionado,
      detalles: nuevosDetalles,
      logrado: nuevoLogrado,
      faltante: Math.max(registroSeleccionado.meta - nuevoLogrado, 0),
      porcentajeCumplido: Number(((nuevoLogrado / registroSeleccionado.meta) * 100).toFixed(2))
    };

    await contexto.agregarRegistro(registroActualizado);
    setRegistroSeleccionado(registroActualizado);
  };

  return (
    <div className="animate-in fade-in">
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div className="page-title">
          <FileText color="var(--primary)" size={24} />
          <div>
            <h2>Gestión de Registros</h2>
            <p className="page-subtitle">Explorador de datos sincronizado en la nube</p>
          </div>
        </div>
        
        <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
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

      <div style={{
        backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', border: '1px solid var(--border)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Año</label>
          <select 
            className="form-control" 
            style={{ width: '100%', backgroundColor: 'var(--bg-body)', padding: '0.8rem', borderRadius: '8px', color: 'var(--text-main)' }}
            value={filtroAno} onChange={e => setFiltroAno(e.target.value)}
          >
            <option value="">Todos los años</option>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Mes</label>
          <select 
            className="form-control" 
            style={{ width: '100%', backgroundColor: 'var(--bg-body)', padding: '0.8rem', borderRadius: '8px', color: 'var(--text-main)' }}
            value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          >
            <option value="">Todos los meses</option>
            {mesesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Taller</label>
          <select 
            className="form-control" 
            style={{ width: '100%', backgroundColor: 'var(--bg-body)', padding: '0.8rem', borderRadius: '8px', color: 'var(--text-main)' }}
            value={filtroTaller} onChange={e => setFiltroTaller(e.target.value)}
          >
            <option value="">Todos los talleres</option>
            {talleresDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

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
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Sin resultados.</td></tr>
            ) : (
              registrosFiltrados.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setRegistroSeleccionado(r)}>
                  <td style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleEditar(r); }} style={{ background: 'rgba(29, 140, 248, 0.1)', border: 'none', color: 'var(--primary)', padding: '0.4rem', borderRadius: '6px' }} title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleEliminar(r.id); }} style={{ background: 'rgba(255, 76, 76, 0.1)', border: 'none', color: 'var(--danger)', padding: '0.4rem', borderRadius: '6px' }} title="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  </td>
                  <td><strong>{r.mes}</strong> <span style={{color: 'var(--text-muted)'}}>{r.ano}</span></td>
                  <td>{r.taller}</td>
                  <td style={{textAlign:'right'}}>{formatearMoneda(r.meta)}</td>
                  <td style={{textAlign:'right'}}>{formatearMoneda(r.logrado)}</td>
                  <td>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: r.porcentajeCumplido >= 100 ? 'rgba(0, 214, 180, 0.15)' : 'rgba(29, 140, 248, 0.15)', color: r.porcentajeCumplido >= 100 ? 'var(--success)' : 'var(--primary)' }}>
                      {r.porcentajeCumplido.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {registroSeleccionado && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(10, 11, 14, 0.9)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="animate-in zoom-in-95" style={{ backgroundColor: 'var(--bg-body)', borderRadius: '24px', width: '100%', maxWidth: '950px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', overflow: 'hidden' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Detalles del Registro</h2>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={() => handleEditar(registroSeleccionado)}><Pencil size={16} /> Editar</button>
                <button className="btn btn-danger" onClick={() => handleEliminar(registroSeleccionado.id)}><Trash2 size={16} /> Eliminar</button>
                <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)' }}></div>
                <button onClick={() => { setRegistroSeleccionado(null); setMostrarFormDetalle(false); setDetalleEditandoId(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={24} /></button>
              </div>
            </div>

            <div style={{ padding: '2.5rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem', marginBottom: '3.5rem' }}>
                {/* KPIs del Modal (Fecha, Taller, Estatus, Meta, Logrado, Faltante) */}
                <div><label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fecha:</label><div style={{ fontSize: '1.15rem' }}>{registroSeleccionado.mes} {registroSeleccionado.ano}</div></div>
                <div><label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Taller:</label><div style={{ fontSize: '1.15rem', color: 'var(--primary)', fontWeight: 700 }}>{registroSeleccionado.taller}</div></div>
                <div><label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estatus:</label><br/><span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: registroSeleccionado.porcentajeCumplido >= 100 ? 'rgba(0, 214, 180, 0.1)' : 'rgba(255, 141, 114, 0.1)', color: registroSeleccionado.porcentajeCumplido >= 100 ? 'var(--success)' : 'var(--danger)' }}>{registroSeleccionado.porcentajeCumplido >= 100 ? 'LOGRADO' : 'PENDIENTE'}</span></div>
                <div><label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Meta:</label><div style={{ fontSize: '1.35rem' }}>{formatearMoneda(registroSeleccionado.meta)}</div></div>
                <div><label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Logrado:</label><div style={{ fontSize: '1.35rem', color: 'var(--primary)', fontWeight: 700 }}>{formatearMoneda(registroSeleccionado.logrado)}</div></div>
                <div><label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pendiente:</label><div style={{ fontSize: '1.35rem', color: 'var(--danger)' }}>{formatearMoneda(registroSeleccionado.faltante)}</div></div>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid var(--border)', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Operaciones Relacionadas</h3>
                  <button onClick={toggleFormDetalle} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', borderRadius: '10px', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                    {mostrarFormDetalle ? <X size={14} /> : <Plus size={14} />} {mostrarFormDetalle ? 'Cancelar' : 'Agregar Operación'}
                  </button>
                </div>

                {mostrarFormDetalle && (
                  <div className="animate-in slide-in-from-top-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', padding: '1.25rem', backgroundColor: 'var(--bg-body)', borderRadius: '12px', border: '1px solid var(--primary)', marginBottom: '1.5rem', alignItems: 'end' }}>
                    <div style={{display:'flex', flexDirection:'column'}}><label style={{fontSize:'0.7rem'}}>Desde</label><input type="date" className="form-control" value={nuevoDesde} onChange={e => setNuevoDesde(e.target.value)} /></div>
                    <div style={{display:'flex', flexDirection:'column'}}><label style={{fontSize:'0.7rem'}}>Hasta</label><input type="date" className="form-control" value={nuevoHasta} onChange={e => setNuevoHasta(e.target.value)} /></div>
                    <div style={{display:'flex', flexDirection:'column'}}><label style={{fontSize:'0.7rem'}}>Monto</label><input type="number" className="form-control" value={nuevoVendido || ''} onChange={e => setNuevoVendido(Number(e.target.value))} /></div>
                    <button className="btn btn-primary" onClick={guardarDetalleRapido} title={detalleEditandoId ? "Actualizar" : "Guardar"}><Save size={16} /></button>
                  </div>
                )}
                
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr><th style={{ width: '60px' }}>#</th><th>FECHA DESDE</th><th>FECHA HASTA</th><th style={{ textAlign: 'right' }}>MONTO</th><th style={{ textAlign: 'center' }}>%</th><th style={{ textAlign: 'center' }}>ACCIONES</th></tr>
                  </thead>
                  <tbody>
                    {registroSeleccionado.detalles.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay operaciones.</td></tr>
                    ) : (
                      registroSeleccionado.detalles.map((det, idx) => (
                        <tr key={det.id} style={{ backgroundColor: detalleEditandoId === det.id ? 'var(--bg-highlight)' : 'transparent' }}>
                          <td>{String(idx + 1).padStart(3, '0')}</td>
                          <td>{formatearFecha(det.desde)}</td>
                          <td>{formatearFecha(det.hasta)}</td>
                          <td style={{ textAlign: 'right' }}>{formatearMoneda(det.vendido)}</td>
                          <td style={{ textAlign: 'center' }}><span style={{ color: 'var(--primary)', fontWeight: 800 }}>{det.porcentajeAporte.toFixed(2)}%</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button onClick={() => iniciarEdicionDetalle(det)} style={{ background: 'rgba(29, 140, 248, 0.1)', border: 'none', color: 'var(--primary)', padding: '0.4rem', borderRadius: '6px' }} title="Editar"><Pencil size={14} /></button>
                              <button onClick={() => eliminarDetalleRapido(det.id)} style={{ background: 'rgba(255, 76, 76, 0.1)', border: 'none', color: 'var(--danger)', padding: '0.4rem', borderRadius: '6px' }} title="Eliminar"><Trash2 size={14} /></button>
                            </div>
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