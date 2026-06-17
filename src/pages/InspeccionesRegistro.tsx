import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones, idInspeccion, type Inspeccion } from '../hooks/useInspecciones';
import { Plus, Save, Trash2, Pencil, X, Search, ClipboardList, Info } from 'lucide-react';

export const InspeccionesRegistro = () => {
  const contexto = useContext(AppContext);
  const { inspecciones, guardarInspeccion, eliminarInspeccion } = useInspecciones();

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();

  // --- Filtros y búsqueda (vista tipo "Gestión de Registros") ---
  const [filtroAno, setFiltroAno] = useState<string>('Todos');
  const [filtroMes, setFiltroMes] = useState<string>('Todos');
  const [filtroTaller, setFiltroTaller] = useState<string>('Todos');
  const [busqueda, setBusqueda] = useState<string>('');

  // --- Estado del modal / formulario ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [taller, setTaller] = useState<string>('');
  const [ano, setAno] = useState<string>(String(anoActual));
  const [mes, setMes] = useState<string>(MESES[0] ?? 'Enero');
  const [cantidad, setCantidad] = useState<string>('');

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(inspecciones.map(i => String(i.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [inspecciones, anoActual]);

  const lista = useMemo(() => {
    let arr = [...inspecciones];
    if (filtroAno !== 'Todos') arr = arr.filter(i => String(i.ano) === filtroAno);
    if (filtroMes !== 'Todos') arr = arr.filter(i => i.mes === filtroMes);
    if (filtroTaller !== 'Todos') arr = arr.filter(i => i.taller === filtroTaller);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      arr = arr.filter(i =>
        i.taller.toLowerCase().includes(q) ||
        i.mes.toLowerCase().includes(q) ||
        String(i.ano).includes(q)
      );
    }
    return arr.sort((a, b) =>
      (b.ano - a.ano) ||
      (MESES.indexOf(a.mes) - MESES.indexOf(b.mes)) ||
      a.taller.localeCompare(b.taller)
    );
  }, [inspecciones, filtroAno, filtroMes, filtroTaller, busqueda]);

  const totalLista = useMemo(() => lista.reduce((acc, r) => acc + r.cantidad, 0), [lista]);

  // --- Acciones del modal ---
  const abrirNuevo = () => {
    setEditandoId(null);
    setTaller(talleresOrdenados[0]?.nombre ?? '');
    setAno(filtroAno !== 'Todos' ? filtroAno : String(anoActual));
    setMes(filtroMes !== 'Todos' ? filtroMes : (MESES[0] ?? 'Enero'));
    setCantidad('');
    setModalAbierto(true);
  };

  const abrirEditar = (i: Inspeccion) => {
    setEditandoId(i.id);
    setTaller(i.taller);
    setAno(String(i.ano));
    setMes(i.mes);
    setCantidad(String(i.cantidad));
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
  };

  const idActual = idInspeccion(taller, ano, mes);
  const registroExistente = inspecciones.find(i => i.id === idActual);
  const sobrescribe = !!registroExistente && editandoId !== idActual;

  const guardar = () => {
    if (!taller) { alert('Selecciona un taller.'); return; }
    const cant = parseInt(cantidad, 10);
    if (isNaN(cant) || cant < 0) { alert('Ingresa un número de inspecciones válido.'); return; }
    const insp: Inspeccion = {
      id: idActual,
      taller,
      ano: parseInt(ano, 10),
      mes,
      cantidad: cant,
    };
    guardarInspeccion(insp);
    cerrarModal();
  };

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO ESTILO "GESTIÓN DE REGISTROS" */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ClipboardList size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Gestión de Inspecciones</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Explorador de inspecciones sincronizado en la nube</p>
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
          <button onClick={abrirNuevo} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <Plus size={18} /> Nueva Inspección
          </button>
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

      {/* TABLA */}
      <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '110px' }}>Acciones</th>
              <th>Periodo</th>
              <th>Taller</th>
              <th style={{ textAlign: 'center' }}>Inspecciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay inspecciones que coincidan con los filtros.</td></tr>
            ) : (
              lista.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--primary)', borderColor: 'transparent', backgroundColor: 'rgba(29, 140, 248, 0.1)' }} onClick={() => abrirEditar(r)} title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--danger)', borderColor: 'transparent', backgroundColor: 'rgba(255, 76, 76, 0.1)' }} onClick={() => { if (confirm(`¿Eliminar el registro de ${r.mes} ${r.ano} de ${r.taller}?`)) eliminarInspeccion(r.id); }} title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                  <td><strong style={{ color: 'var(--text-main)' }}>{r.mes}</strong> <span style={{ color: 'var(--text-muted)' }}>{r.ano}</span></td>
                  <td>{r.taller}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>{r.cantidad}</td>
                </tr>
              ))
            )}
          </tbody>
          {lista.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total ({lista.length} registros)</strong></td>
                <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{totalLista}</td>
              </tr>
            </tfoot>
          )}
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
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '640px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          >
            {/* Header del modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ClipboardList size={22} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>{editandoId ? 'Editar Inspección' : 'Nueva Inspección'}</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Captura el número de inspecciones del mes</p>
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
                  <p style={{ color: 'var(--text-muted)' }}>No hay talleres. Crea uno en el módulo "Talleres" para registrar inspecciones.</p>
                </div>
              ) : (
                <>
                  <h3 className="detail-section-title">Información Principal</h3>
                  <div className="grid-layout" style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Taller</label>
                      <select className="form-control" value={taller} onChange={(e) => setTaller(e.target.value)}>
                        <option value="">Seleccione un taller...</option>
                        {talleresOrdenados.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Año</label>
                      <input type="number" className="form-control" value={ano} onChange={(e) => setAno(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mes</label>
                      <select className="form-control" value={mes} onChange={(e) => setMes(e.target.value)}>
                        {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Inspecciones</label>
                      <input type="number" min={0} className="form-control" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  {sobrescribe && registroExistente && (
                    <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Info size={14} color="var(--primary)" />
                      Ya existe un registro para {mes} {ano} de {taller} con {registroExistente.cantidad} inspecciones. Al guardar se actualizará.
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
              <button onClick={guardar} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} disabled={talleresOrdenados.length === 0}>
                <Save size={16} /> {editandoId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};