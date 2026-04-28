import { useState, useContext, Fragment } from 'react';
import { AppContext } from '../context/AppContext';
import { formatearFecha, formatearMoneda } from '../utils/formatters';
import type { Registro } from '../types';
import { FileText, Search, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export const Registros = () => {
  const contexto = useContext(AppContext);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!contexto) return null;

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);
  
  const handleEditar = (registro: Registro) => { 
    contexto.setRegistroEditando(registro); 
    contexto.setVista('formulario'); 
  };
  
  const handleEliminar = (id: string) => { 
    if (confirm('¿Eliminar este registro y sus detalles de la base de datos?')) { 
      contexto.eliminarRegistro(id); 
      setExpandedId(null); 
    } 
  };

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title">
          <FileText size={24} color="var(--primary)" />
          <div>
            <h2>Gestión de Registros</h2>
            <p className="page-subtitle">Explorador de datos sincronizado en la nube</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <Search size={16} />
            <input type="text" placeholder="Buscar registros..." />
          </div>
          <button className="btn btn-primary" onClick={() => { contexto.setRegistroEditando(null); contexto.setVista('formulario'); }}>
            <Plus size={16} /> Nuevo Registro
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Periodo</th>
              <th>Taller</th>
              <th style={{textAlign:'right'}}>Meta</th>
              <th style={{textAlign:'right'}}>Logrado</th>
              <th>Cumplido</th>
            </tr>
          </thead>
          <tbody>
            {contexto.registros.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay registros activos en la base de datos.</td></tr>
            ) : (
              contexto.registros.map(r => (
                <Fragment key={r.id}>
                  <tr className="clickable" onClick={() => toggleExpand(r.id)}>
                    <td data-label="Detalle:" style={{ color: 'var(--text-muted)' }}>
                      {expandedId === r.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
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

                  {expandedId === r.id && (
                    <tr className="detail-row">
                      <td colSpan={6}>
                        <div className="detail-panel animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="detail-grid">
                            <div>
                              <h4 className="detail-section-title">Contexto</h4>
                              <p className="detail-text"><strong style={{color:'var(--text-muted)'}}>Taller:</strong><br/>{r.taller}</p>
                              <p className="detail-text" style={{marginTop:'1rem'}}><strong style={{color:'var(--text-muted)'}}>Período:</strong><br/>{r.mes} {r.ano}</p>
                            </div>
                            <div>
                              <h4 className="detail-section-title">Resumen</h4>
                              <p className="detail-text"><strong style={{color:'var(--text-muted)'}}>Meta Inicial:</strong> {formatearMoneda(r.meta)}</p>
                              <p className="detail-text"><strong style={{color:'var(--text-muted)'}}>Logrado:</strong> <span style={{color: 'var(--primary)', fontWeight:600}}>{formatearMoneda(r.logrado)}</span></p>
                              <p className="detail-text"><strong style={{color:'var(--text-muted)'}}>Faltante:</strong> <span style={{color: 'var(--danger)', fontWeight:600}}>{formatearMoneda(r.faltante)}</span></p>
                            </div>
                            <div>
                              <h4 className="detail-section-title">Operaciones</h4>
                              {r.detalles.length === 0 ? (
                                <p className="detail-text" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Sin operaciones.</p>
                              ) : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                  {r.detalles.map(det => (
                                    <li key={det.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatearFecha(det.desde)} - {formatearFecha(det.hasta)}</span>
                                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{formatearMoneda(det.vendido)}</strong>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                          <div className="detail-actions">
                            <button className="btn btn-outline" onClick={() => handleEditar(r)}><Pencil size={16} /> Editar</button>
                            <button className="btn btn-danger" onClick={() => handleEliminar(r.id)}><Trash2 size={16} /> Eliminar</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};