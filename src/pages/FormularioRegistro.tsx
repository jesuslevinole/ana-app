import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import type { Detalle, Registro } from '../types';
import { Plus, Trash2, Save, X, Pencil } from 'lucide-react';

// --- FUNCIONES LOCALES PARA FORZAR LOS FORMATOS ESTRICTOS ---
const miFormatearFecha = (fechaStr: string) => {
  if (!fechaStr || fechaStr === '-') return fechaStr;
  const partes = fechaStr.split('-');
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${mes}/${dia}/${ano}`;
  }
  return fechaStr;
};

const miFormatearMoneda = (valor: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor).replace('$', '$ ');
};

export const FormularioRegistro = () => {
  const contexto = useContext(AppContext);
  const currentYear = new Date().getFullYear();
  
  const isEditing = !!contexto?.registroEditando;
  const initialState = contexto?.registroEditando || { ano: currentYear, mes: 'Enero', taller: '', meta: 0, detalles: [] };

  const [ano, setAno] = useState(initialState.ano);
  const [mes, setMes] = useState(initialState.mes);
  const [taller, setTaller] = useState(initialState.taller);
  const [meta, setMeta] = useState(initialState.meta);
  const [detalles, setDetalles] = useState<Detalle[]>(initialState.detalles as Detalle[]);
  
  // Estados para el detalle
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [vendido, setVendido] = useState(0);
  
  // NUEVO ESTADO: Rastrear qué fila estamos editando
  const [detalleEditandoId, setDetalleEditandoId] = useState<string | null>(null);

  // --- OBTENER TALLERES OFICIALES RESPETANDO EL ORDEN ---
  const talleresDisponibles = useMemo(() => {
    if (!contexto?.talleres) return [];
    return [...contexto.talleres]
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map(t => t.nombre);
  }, [contexto?.talleres]);

  // Cálculos dinámicos (Con soporte para Excedente)
  const logrado = useMemo(() => detalles.reduce((acc, d) => acc + d.vendido, 0), [detalles]);
  const isExcedente = logrado > meta;
  const faltanteReal = isExcedente ? logrado - meta : Math.max(meta - logrado, 0);
  const porcentajeCumplido = meta > 0 ? Number(((logrado / meta) * 100).toFixed(2)) : 0;

  // LÓGICA: Sirve para Agregar o Actualizar
  const guardarDetalle = () => {
    if (!desde || !hasta || vendido <= 0 || meta <= 0 || new Date(hasta) <= new Date(desde)) {
      return alert('Datos inválidos o fechas incorrectas.');
    }

    if (detalleEditandoId) {
      // MODO EDICIÓN
      setDetalles(detalles.map(d => d.id === detalleEditandoId ? {
        ...d,
        desde,
        hasta,
        vendido,
        porcentajeAporte: Number(((vendido / meta) * 100).toFixed(2))
      } : d));
      setDetalleEditandoId(null);
    } else {
      // MODO CREACIÓN
      setDetalles([...detalles, { 
        id: crypto.randomUUID(), 
        desde, 
        hasta, 
        vendido, 
        porcentajeAporte: Number(((vendido / meta) * 100).toFixed(2)) 
      }]);
    }
    
    // Limpiar formulario interno
    setDesde(''); setHasta(''); setVendido(0);
  };

  // Cargar datos del detalle en los inputs
  const iniciarEdicionDetalle = (d: Detalle) => {
    setDetalleEditandoId(d.id);
    setDesde(d.desde);
    setHasta(d.hasta);
    setVendido(d.vendido);
  };

  const cancelarEdicionDetalle = () => {
    setDetalleEditandoId(null);
    setDesde(''); setHasta(''); setVendido(0);
  };

  const guardarRegistro = () => {
    if (!taller || meta <= 0) return alert('Complete Taller y Meta.');
    const registroFinal: Registro = { 
      id: isEditing ? contexto!.registroEditando!.id : crypto.randomUUID(), 
      ano, mes, taller, meta, logrado, faltante: Math.max(meta - logrado, 0), porcentajeCumplido, detalles 
    };
    contexto?.agregarRegistro(registroFinal);
  };

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">{isEditing ? 'Editar Registro' : 'Nuevo Registro'}</h2>
          <p className="page-subtitle">Complete la información solicitada</p>
        </div>
        <button className="btn btn-outline" onClick={() => contexto?.setVista('tabla')}><X size={16} /> Cancelar</button>
      </div>

      <div className="card">
        <h3 className="detail-section-title">Información Principal</h3>
        <div className="grid-layout">
          <div className="form-group">
            <label className="form-label">Año</label>
            <input type="number" className="form-control" value={ano} onChange={e => setAno(Number(e.target.value))} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Mes</label>
            <select className="form-control" value={mes} onChange={e => setMes(e.target.value)}>
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Taller</label>
            <select className="form-control" value={taller} onChange={e => setTaller(e.target.value)}>
              <option value="">Seleccione un taller...</option>
              {talleresDisponibles.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Metas</label>
            <input type="number" className="form-control" value={meta || ''} onChange={e => setMeta(Number(e.target.value))} />
          </div>
        </div>
        
        <div className="grid-layout" style={{ marginTop: '1.5rem', backgroundColor: 'var(--bg-highlight)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
           <div>
             <p className="form-label">Logrado</p>
             <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)' }}>{miFormatearMoneda(logrado)}</h3>
           </div>
           <div>
             <p className="form-label" style={{ color: isExcedente ? 'var(--success)' : 'var(--danger)' }}>
               {isExcedente ? 'Excedente' : 'Faltante'}
             </p>
             <h3 style={{ fontSize: '1.5rem', color: isExcedente ? 'var(--success)' : 'var(--danger)' }}>
               {miFormatearMoneda(faltanteReal)}
             </h3>
           </div>
           <div>
             <p className="form-label">Cumplido</p>
             <h3 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{porcentajeCumplido}%</h3>
           </div>
        </div>
      </div>

      <div className="card">
        <h3 className="detail-section-title">Detalle de Ventas</h3>
        <div className="grid-layout cols-4">
          <div className="form-group">
            <label className="form-label">Desde</label>
            {/* El atributo lang="en-US" fuerza al navegador a usar el formato MM/DD/YYYY internamente */}
            <input type="date" lang="en-US" className="form-control" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hasta</label>
            <input type="date" lang="en-US" className="form-control" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Vendido</label>
            <input type="number" className="form-control" value={vendido || ''} onChange={e => setVendido(Number(e.target.value))} />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end', paddingBottom: '2px' }}>
            <button 
              className="btn btn-outline" 
              style={{ flex: 1, color: 'var(--primary)', borderColor: 'var(--primary)' }} 
              onClick={guardarDetalle}
            >
              {detalleEditandoId ? <Save size={16}/> : <Plus size={16}/>} 
              {detalleEditandoId ? 'Actualizar' : 'Agregar'}
            </button>
            
            {detalleEditandoId && (
              <button 
                className="btn btn-outline" 
                style={{ padding: '0.6rem', color: 'var(--text-muted)', borderColor: 'var(--border)' }} 
                onClick={cancelarEdicionDetalle}
                title="Cancelar edición"
              >
                <X size={16}/>
              </button>
            )}
          </div>
        </div>

        {detalles.length > 0 && (
          <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th style={{textAlign:'right'}}>Vendido</th>
                  <th style={{textAlign:'center'}}>Aporte</th>
                  <th style={{textAlign:'center'}}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map(d => (
                  <tr key={d.id} style={{ backgroundColor: detalleEditandoId === d.id ? 'var(--bg-highlight)' : 'transparent' }}>
                    <td data-label="Desde:">{miFormatearFecha(d.desde)}</td>
                    <td data-label="Hasta:">{miFormatearFecha(d.hasta)}</td>
                    <td data-label="Vendido:" style={{textAlign:'right', fontWeight: 600}}>{miFormatearMoneda(d.vendido)}</td>
                    <td data-label="Aporte:" style={{textAlign:'center'}}><span style={{ color: 'var(--primary)', fontWeight: 600 }}>{d.porcentajeAporte}%</span></td>
                    <td data-label="Acción:" style={{textAlign:'center'}}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{padding: '0.4rem', color: 'var(--primary)', borderColor: 'transparent', backgroundColor: 'rgba(29, 140, 248, 0.1)'}} 
                          onClick={() => iniciarEdicionDetalle(d)}
                          title="Editar Operación"
                        >
                          <Pencil size={15}/>
                        </button>
                        <button 
                          className="btn btn-outline" 
                          style={{padding: '0.4rem', color: 'var(--danger)', borderColor: 'transparent', backgroundColor: 'rgba(255, 76, 76, 0.1)'}} 
                          onClick={() => setDetalles(detalles.filter(x => x.id !== d.id))}
                          title="Eliminar Operación"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={guardarRegistro}><Save size={16}/> {isEditing ? 'Actualizar Registro' : 'Guardar Registro'}</button>
      </div>
    </div>
  );
};