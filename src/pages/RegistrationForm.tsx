import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { formatearFecha, formatearMoneda, MESES } from '../utils/formatters';
import type { Detalle, Registro } from '../types';
import { Plus, Trash2, Save, X } from 'lucide-react';

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
  
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [vendido, setVendido] = useState(0);

  const logrado = useMemo(() => detalles.reduce((acc, d) => acc + d.vendido, 0), [detalles]);
  const faltante = Math.max(meta - logrado, 0);
  const porcentajeCumplido = meta > 0 ? Number(((logrado / meta) * 100).toFixed(2)) : 0;

  const agregarDetalle = () => {
    if (!desde || !hasta || vendido <= 0 || meta <= 0 || new Date(hasta) <= new Date(desde)) return alert('Datos inválidos o fechas incorrectas.');
    setDetalles([...detalles, { id: crypto.randomUUID(), desde, hasta, vendido, porcentajeAporte: Number(((vendido / meta) * 100).toFixed(2)) }]);
    setDesde(''); setHasta(''); setVendido(0);
  };

  const guardarRegistro = () => {
    if (!taller || meta <= 0) return alert('Complete Taller y Meta.');
    const registroFinal: Registro = { id: isEditing ? contexto!.registroEditando!.id : crypto.randomUUID(), ano, mes, taller, meta, logrado, faltante, porcentajeCumplido, detalles };
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
          <div className="form-group"><label className="form-label">Año</label><input type="number" className="form-control" value={ano} onChange={e => setAno(Number(e.target.value))} /></div>
          <div className="form-group"><label className="form-label">Mes</label>
            <select className="form-control" value={mes} onChange={e => setMes(e.target.value)}>
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Taller</label><input type="text" className="form-control" value={taller} onChange={e => setTaller(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Metas</label><input type="number" className="form-control" value={meta || ''} onChange={e => setMeta(Number(e.target.value))} /></div>
        </div>
        
        <div className="grid-layout" style={{ marginTop: '1.5rem', backgroundColor: 'var(--bg-highlight)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
           <div><p className="form-label">Logrado</p><h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)' }}>{formatearMoneda(logrado)}</h3></div>
           <div><p className="form-label">Faltante</p><h3 style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>{formatearMoneda(faltante)}</h3></div>
           <div><p className="form-label">Cumplido</p><h3 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{porcentajeCumplido}%</h3></div>
        </div>
      </div>

      <div className="card">
        <h3 className="detail-section-title">Detalle de Ventas</h3>
        <div className="grid-layout cols-4">
          <div className="form-group"><label className="form-label">Desde</label><input type="date" className="form-control" value={desde} onChange={e => setDesde(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Hasta</label><input type="date" className="form-control" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Vendido</label><input type="number" className="form-control" value={vendido || ''} onChange={e => setVendido(Number(e.target.value))} /></div>
          <button className="btn btn-outline" style={{ height: 'max-content', alignSelf: 'flex-end', color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={agregarDetalle}><Plus size={16}/> Agregar</button>
        </div>

        {detalles.length > 0 && (
          <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
            <table className="table">
              <thead><tr><th>Desde</th><th>Hasta</th><th style={{textAlign:'right'}}>Vendido</th><th>Aporte</th><th>Acción</th></tr></thead>
              <tbody>
                {detalles.map(d => (
                  <tr key={d.id}>
                    <td data-label="Desde:">{formatearFecha(d.desde)}</td>
                    <td data-label="Hasta:">{formatearFecha(d.hasta)}</td>
                    <td data-label="Vendido:" style={{textAlign:'right', fontWeight: 600}}>{formatearMoneda(d.vendido)}</td>
                    <td data-label="Aporte:"><span style={{ color: 'var(--primary)', fontWeight: 600 }}>{d.porcentajeAporte}%</span></td>
                    <td data-label="Acción:">
                      <button className="btn btn-outline" style={{padding: '0.4rem', color: 'var(--danger)', borderColor: 'transparent'}} onClick={() => setDetalles(detalles.filter(x => x.id !== d.id))}><Trash2 size={16}/></button>
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