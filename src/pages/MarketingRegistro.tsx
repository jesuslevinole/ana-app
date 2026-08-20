import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MESES } from '../utils/formatters';
import {
  useMarketing, idMarketing, FUENTES_MARKETING, ETIQUETA_SIN_FORMULARIO,
  cantidadFuente, sumaFuentes, totalRegistroMarketing,
  type RegistroMarketing
} from '../hooks/useMarketing';
import { Plus, Save, Trash2, Pencil, X, Search, Megaphone, Info, Users, ClipboardX } from 'lucide-react';
import { useFiltroPresentacion, oPorDefecto } from '../context/filtroPresentacion';

// =========================================================================
//  MARKETING · REGISTRO
//  Captura de dónde vienen los clientes de cada taller, mes a mes.
//  Un registro por taller/mes/año: al guardar dos veces el mismo periodo se
//  actualiza el existente (mismo criterio que Inspecciones).
// =========================================================================

export const MarketingRegistro = () => {
  const contexto = useContext(AppContext);
  const { registros, guardarRegistro, eliminarRegistro } = useMarketing();
  // Nivel de acceso del rol sobre este módulo (Roles y Permisos)
  const { puedeEditar, puedeEliminar } = useAuth();
  const puedoEditar = puedeEditar('marketing');
  const puedoEliminar = puedeEliminar('marketing');

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();

  // --- Filtros y búsqueda ---
  // Filtro heredado de la presentación (taller, año, mes y semanas). Si no se
  // está presentando, cada control arranca con su valor de siempre.
  const filtroPres = useFiltroPresentacion();
  const [filtroAno, setFiltroAno] = useState<string>(oPorDefecto(filtroPres?.ano, 'Todos'));
  const [filtroMes, setFiltroMes] = useState<string>(oPorDefecto(filtroPres?.mes, 'Todos'));
  const [filtroTaller, setFiltroTaller] = useState<string>(oPorDefecto(filtroPres?.taller, 'Todos'));
  const [busqueda, setBusqueda] = useState<string>('');

  // --- Estado del modal / formulario ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [taller, setTaller] = useState<string>('');
  const [ano, setAno] = useState<string>(String(anoActual));
  const [mes, setMes] = useState<string>(MESES[new Date().getMonth()] ?? 'Enero');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [sinFormulario, setSinFormulario] = useState<string>('');

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(registros.map(r => String(r.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [registros, anoActual]);

  // --- Lista filtrada que alimenta la tabla ---
  const lista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return registros
      .filter(r => filtroAno === 'Todos' || String(r.ano) === filtroAno)
      .filter(r => filtroMes === 'Todos' || r.mes === filtroMes)
      .filter(r => filtroTaller === 'Todos' || r.taller === filtroTaller)
      .filter(r => !texto || `${r.taller} ${r.mes} ${r.ano}`.toLowerCase().includes(texto))
      .sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        const im = MESES.indexOf(b.mes) - MESES.indexOf(a.mes);
        if (im !== 0) return im;
        return a.taller.localeCompare(b.taller);
      });
  }, [registros, filtroAno, filtroMes, filtroTaller, busqueda]);

  // Totales de la lista visible (respetan los filtros activos)
  const totales = useMemo(() => {
    const conFormulario = lista.reduce((acc, r) => acc + sumaFuentes(r), 0);
    const sin = lista.reduce((acc, r) => acc + (r.sinFormulario || 0), 0);
    return { conFormulario, sin, total: conFormulario + sin };
  }, [lista]);

  // --- Modal ---
  const limpiarFormulario = () => {
    setTaller(talleresOrdenados[0]?.nombre ?? '');
    setAno(String(anoActual));
    setMes(MESES[new Date().getMonth()] ?? 'Enero');
    setValores({});
    setSinFormulario('');
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    limpiarFormulario();
    setModalAbierto(true);
  };

  const abrirEditar = (r: RegistroMarketing) => {
    setEditandoId(r.id);
    setTaller(r.taller);
    setAno(String(r.ano));
    setMes(r.mes);
    const v: Record<string, string> = {};
    FUENTES_MARKETING.forEach(f => {
      const n = cantidadFuente(r, f.clave);
      v[f.clave] = n > 0 ? String(n) : '';
    });
    setValores(v);
    setSinFormulario(r.sinFormulario > 0 ? String(r.sinFormulario) : '');
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
  };

  const entero = (s: string): number => {
    const v = parseInt(s, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  };

  // Totales en vivo dentro del modal
  const conFormularioModal = FUENTES_MARKETING.reduce((acc, f) => acc + entero(valores[f.clave] ?? ''), 0);
  const sinFormularioModal = entero(sinFormulario);
  const totalModal = conFormularioModal + sinFormularioModal;

  const idActual = taller ? idMarketing(taller, ano, mes) : '';
  const registroExistente = registros.find(r => r.id === idActual) || null;
  const sobrescribe = !editandoId && !!registroExistente;

  const guardar = () => {
    if (!taller) { alert('Selecciona un taller.'); return; }
    if (totalModal <= 0) { alert('Captura al menos un cliente en alguna procedencia.'); return; }

    const fuentes: Record<string, number> = {};
    FUENTES_MARKETING.forEach(f => { fuentes[f.clave] = entero(valores[f.clave] ?? ''); });

    const reg: RegistroMarketing = {
      id: idMarketing(taller, ano, mes),
      taller,
      ano: parseInt(ano, 10),
      mes,
      fuentes,
      sinFormulario: sinFormularioModal,
      conFormulario: conFormularioModal,
      total: totalModal,
    };
    guardarRegistro(reg);
    cerrarModal();
  };

  const pctModal = (n: number) => (totalModal > 0 ? ((n / totalModal) * 100).toFixed(2) : '0.00');

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Megaphone size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Gestión de Marketing</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Registro del origen de los clientes, sincronizado en la nube
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por taller, mes o año..."
              style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.55rem 1rem 0.55rem 2.25rem', fontSize: '0.85rem', outline: 'none', minWidth: '260px' }}
            />
          </div>
          {puedoEditar && (
            <button onClick={abrirNuevo} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Nuevo Registro
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Año</label>
          <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
            <option value="Todos">Todos los años</option>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Mes</label>
          <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="Todos">Todos los meses</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Taller</label>
          <select value={filtroTaller} onChange={(e) => setFiltroTaller(e.target.value)}>
            <option value="Todos">Todos los talleres</option>
            {talleresOrdenados.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* RESUMEN DE LO FILTRADO */}
      <div className="kpi-grid">
        <div className="kpi-card logrado">
          <div className="kpi-title">Total de clientes <Users size={16} /></div>
          <div className="kpi-value">{totales.total.toLocaleString('en-US')}</div>
        </div>
        <div className="kpi-card meta">
          <div className="kpi-title">Con formulario <Megaphone size={16} /></div>
          <div className="kpi-value">{totales.conFormulario.toLocaleString('en-US')}</div>
        </div>
        <div className="kpi-card faltante">
          <div className="kpi-title">Sin formulario <ClipboardX size={16} /></div>
          <div className="kpi-value">{totales.sin.toLocaleString('en-US')}</div>
        </div>
        <div className="kpi-card logrado">
          <div className="kpi-title">Periodos capturados <Info size={16} /></div>
          <div className="kpi-value">{lista.length}</div>
        </div>
      </div>

      {/* TABLA */}
      <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '860px' }}>
          <thead>
            {lista.length > 0 && (
              <tr style={{ backgroundColor: 'var(--bg-highlight)', borderBottom: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '0.85rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Total ({lista.length} registros)</strong>
                </td>
                <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{totales.conFormulario}</td>
                <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--danger)' }}>{totales.sin}</td>
                <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{totales.total}</td>
              </tr>
            )}
            <tr>
              <th style={{ width: '110px' }}>Acciones</th>
              <th>Periodo</th>
              <th>Taller</th>
              <th style={{ textAlign: 'center' }}>Con formulario</th>
              <th style={{ textAlign: 'center' }}>Sin formulario</th>
              <th style={{ textAlign: 'center' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay registros que coincidan con los filtros.</td></tr>
            ) : (
              lista.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--primary)', borderColor: 'transparent', backgroundColor: 'rgba(29, 140, 248, 0.1)', opacity: puedoEditar ? 1 : 0.4, cursor: puedoEditar ? 'pointer' : 'not-allowed' }} disabled={!puedoEditar} onClick={() => abrirEditar(r)} title={puedoEditar ? "Editar" : "Tu rol solo puede consultar"}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--danger)', borderColor: 'transparent', backgroundColor: 'rgba(255, 76, 76, 0.1)', opacity: puedoEliminar ? 1 : 0.4, cursor: puedoEliminar ? 'pointer' : 'not-allowed' }} disabled={!puedoEliminar} onClick={() => { if (confirm(`¿Eliminar el registro de ${r.mes} ${r.ano} de ${r.taller}?`)) eliminarRegistro(r.id); }} title={puedoEliminar ? "Eliminar" : "Tu rol no puede eliminar"}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                  <td><strong style={{ color: 'var(--text-main)' }}>{r.mes}</strong> <span style={{ color: 'var(--text-muted)' }}>{r.ano}</span></td>
                  <td>{r.taller}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{sumaFuentes(r)}</td>
                  <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>{r.sinFormulario || 0}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>{totalRegistroMarketing(r)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===================== MODAL DE CAPTURA ===================== */}
      {modalAbierto && (
        <div
          onClick={cerrarModal}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 1rem', overflowY: 'auto' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-in fade-in"
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '920px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          >
            {/* Header del modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Megaphone size={22} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>{editandoId ? 'Editar Registro' : 'Nuevo Registro'}</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Captura cuántos clientes llegaron por cada medio</p>
                </div>
              </div>
              <button onClick={cerrarModal} className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--text-muted)', borderColor: 'var(--border)' }} title="Cerrar">
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo del modal */}
            <div style={{ padding: '1.5rem' }}>
              {talleresOrdenados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <Info size={36} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
                  <p style={{ color: 'var(--text-muted)' }}>No hay talleres. Crea uno en el módulo "Talleres" para registrar marketing.</p>
                </div>
              ) : (
                <>
                  <h3 className="detail-section-title">Periodo</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Taller</label>
                      <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={taller} onChange={(e) => setTaller(e.target.value)}>
                        <option value="">Seleccione un taller...</option>
                        {talleresOrdenados.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Año</label>
                      <input type="number" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={ano} onChange={(e) => setAno(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Mes</label>
                      <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={mes} onChange={(e) => setMes(e.target.value)}>
                        {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <h3 className="detail-section-title" style={{ marginTop: '1.5rem' }}>¿De dónde vino el cliente?</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    {FUENTES_MARKETING.map(f => {
                      const n = entero(valores[f.clave] ?? '');
                      return (
                        <div className="form-group" key={f.clave} style={{ minWidth: 0 }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', minHeight: '2.2rem', lineHeight: 1.25 }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: f.color, flexShrink: 0, marginTop: '0.2rem' }} />
                            {f.etiqueta}
                          </label>
                          <input
                            type="number"
                            min={0}
                            className="form-control"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            value={valores[f.clave] ?? ''}
                            onChange={(e) => setValores(v => ({ ...v, [f.clave]: e.target.value }))}
                            placeholder="0"
                          />
                          <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {n > 0 ? `${pctModal(n)} % del total` : 'Sin clientes'}
                          </small>
                        </div>
                      );
                    })}
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', minHeight: '2.2rem', lineHeight: 1.25 }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--danger)', flexShrink: 0, marginTop: '0.2rem' }} />
                        {ETIQUETA_SIN_FORMULARIO}
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="form-control"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={sinFormulario}
                        onChange={(e) => setSinFormulario(e.target.value)}
                        placeholder="0"
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {sinFormularioModal > 0 ? `${pctModal(sinFormularioModal)} % del total` : 'Clientes atendidos que no llenaron formulario'}
                      </small>
                    </div>
                  </div>

                  {sobrescribe && registroExistente && (
                    <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Info size={14} color="var(--primary)" />
                      Ya existe un registro de {mes} {ano} para {taller} con {totalRegistroMarketing(registroExistente)} clientes. Al guardar se actualizará.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer del modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button onClick={cerrarModal} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <X size={16} /> Cancelar
              </button>
              <button onClick={guardar} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: puedoEditar ? 1 : 0.5 }} disabled={talleresOrdenados.length === 0 || !puedoEditar}>
                <Save size={16} /> {editandoId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
