import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useFiltroPresentacion, oPorDefecto } from '../context/filtroPresentacion';
import { MESES } from '../utils/formatters';
import {
  useMarketingGastos, idGastoMarketing, PORCENTAJE_MARKETING,
  aporteMarketing, totalExpensesMarketing, fondosMarketing,
  type GastoMarketing
} from '../hooks/useMarketingGastos';
import {
  Plus, Save, Trash2, Pencil, X, Search, DollarSign, Info, Wallet, Receipt, PiggyBank
} from 'lucide-react';

// =========================================================================
//  MARKETING · GASTOS
//  Captura del dinero de marketing de cada taller, mes a mes:
//  cuánto aporta la venta (3 %), en qué se gastó y cuánto le queda al taller.
// =========================================================================

const fmtMoneda = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MarketingGastos = () => {
  const contexto = useContext(AppContext);
  const { gastos, guardarGasto, eliminarGasto } = useMarketingGastos();

  const filtroPres = useFiltroPresentacion();
  const { puedeEditar, puedeEliminar } = useAuth();
  const puedoEditar = puedeEditar('marketingGastos');
  const puedoEliminar = puedeEliminar('marketingGastos');

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();

  // --- Filtros ---
  const [filtroAno, setFiltroAno] = useState<string>(oPorDefecto(filtroPres?.ano, 'Todos'));
  const [filtroMes, setFiltroMes] = useState<string>(oPorDefecto(filtroPres?.mes, 'Todos'));
  const [filtroTaller, setFiltroTaller] = useState<string>(oPorDefecto(filtroPres?.taller, 'Todos'));
  const [busqueda, setBusqueda] = useState<string>('');

  // --- Modal ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [taller, setTaller] = useState<string>('');
  const [ano, setAno] = useState<string>(String(anoActual));
  const [mes, setMes] = useState<string>(MESES[new Date().getMonth()] ?? 'Enero');
  const [gross, setGross] = useState<string>('');
  const [porcentaje, setPorcentaje] = useState<string>(String(PORCENTAJE_MARKETING));
  const [facebook, setFacebook] = useState<string>('');
  const [expenses, setExpenses] = useState<string>('');
  const [pagoMelvin, setPagoMelvin] = useState<string>('');
  const [notas, setNotas] = useState<string>('');

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(gastos.map(g => String(g.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [gastos, anoActual]);

  const lista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return gastos
      .filter(g => filtroAno === 'Todos' || String(g.ano) === filtroAno)
      .filter(g => filtroMes === 'Todos' || g.mes === filtroMes)
      .filter(g => filtroTaller === 'Todos' || g.taller === filtroTaller)
      .filter(g => !texto || `${g.taller} ${g.mes} ${g.ano}`.toLowerCase().includes(texto))
      .sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        const im = MESES.indexOf(b.mes) - MESES.indexOf(a.mes);
        if (im !== 0) return im;
        return a.taller.localeCompare(b.taller);
      });
  }, [gastos, filtroAno, filtroMes, filtroTaller, busqueda]);

  const totales = useMemo(() => lista.reduce((acc, g) => ({
    gross: acc.gross + g.gross,
    aporte: acc.aporte + aporteMarketing(g),
    facebook: acc.facebook + g.facebook,
    expenses: acc.expenses + g.expenses,
    melvin: acc.melvin + g.pagoMelvin,
    total: acc.total + totalExpensesMarketing(g),
    fondos: acc.fondos + fondosMarketing(g),
  }), { gross: 0, aporte: 0, facebook: 0, expenses: 0, melvin: 0, total: 0, fondos: 0 }), [lista]);

  // --- Modal ---
  const limpiar = () => {
    setTaller(talleresOrdenados[0]?.nombre ?? '');
    setAno(String(anoActual));
    setMes(MESES[new Date().getMonth()] ?? 'Enero');
    setGross(''); setPorcentaje(String(PORCENTAJE_MARKETING));
    setFacebook(''); setExpenses(''); setPagoMelvin(''); setNotas('');
  };

  const abrirNuevo = () => { setEditandoId(null); limpiar(); setModalAbierto(true); };

  const abrirEditar = (g: GastoMarketing) => {
    setEditandoId(g.id);
    setTaller(g.taller);
    setAno(String(g.ano));
    setMes(g.mes);
    setGross(g.gross ? String(g.gross) : '');
    setPorcentaje(String(g.porcentaje ?? PORCENTAJE_MARKETING));
    setFacebook(g.facebook ? String(g.facebook) : '');
    setExpenses(g.expenses ? String(g.expenses) : '');
    setPagoMelvin(g.pagoMelvin ? String(g.pagoMelvin) : '');
    setNotas(g.notas || '');
    setModalAbierto(true);
  };

  const dec = (s: string): number => {
    const v = parseFloat(s);
    return isNaN(v) || v < 0 ? 0 : v;
  };

  // Cálculos en vivo del modal
  const grossModal = dec(gross);
  const pctModal = dec(porcentaje);
  const aporteModal = (grossModal * pctModal) / 100;
  const gastosModal = dec(facebook) + dec(expenses) + dec(pagoMelvin);
  const totalModal = aporteModal + gastosModal;
  const fondosModal = aporteModal - gastosModal;

  const guardar = () => {
    if (!taller) { alert('Selecciona un taller.'); return; }
    if (grossModal <= 0 && gastosModal <= 0) { alert('Captura al menos la venta bruta o algún gasto.'); return; }

    guardarGasto({
      id: idGastoMarketing(taller, ano, mes),
      taller,
      ano: parseInt(ano, 10),
      mes,
      gross: grossModal,
      porcentaje: pctModal,
      facebook: dec(facebook),
      expenses: dec(expenses),
      pagoMelvin: dec(pagoMelvin),
      notas: notas.trim(),
    });
    setModalAbierto(false);
  };

  const idActual = taller ? idGastoMarketing(taller, ano, mes) : '';
  const yaExiste = !editandoId && gastos.some(g => g.id === idActual);

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <DollarSign size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Gastos de Marketing</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Aporte del {PORCENTAJE_MARKETING} % de la venta, gastos del mes y fondos de cada taller
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
            <button onClick={abrirNuevo} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Nuevo Gasto
            </button>
          )}
        </div>
      </div>

      {/* FILTROS */}
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

      {/* RESUMEN */}
      <div className="kpi-grid">
        <div className="kpi-card meta">
          <div className="kpi-title">Aporte de marketing <Wallet size={16} /></div>
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>{fmtMoneda(totales.aporte)}</div>
          <small style={{ color: 'var(--text-muted)' }}>Sobre una venta de {fmtMoneda(totales.gross)}</small>
        </div>
        <div className="kpi-card faltante">
          <div className="kpi-title">Gastado <Receipt size={16} /></div>
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>{fmtMoneda(totales.facebook + totales.expenses + totales.melvin)}</div>
          <small style={{ color: 'var(--text-muted)' }}>Facebook, expenses y Sr. Melvin</small>
        </div>
        <div className="kpi-card logrado">
          <div className="kpi-title">Fondos disponibles <PiggyBank size={16} /></div>
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>{fmtMoneda(totales.fondos)}</div>
          <small style={{ color: 'var(--text-muted)' }}>Aporte menos lo gastado</small>
        </div>
        <div className="kpi-card logrado">
          <div className="kpi-title">Total de expenses <Info size={16} /></div>
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>{fmtMoneda(totales.total)}</div>
          <small style={{ color: 'var(--text-muted)' }}>{lista.length} {lista.length === 1 ? 'registro' : 'registros'}</small>
        </div>
      </div>

      {/* TABLA */}
      <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '1020px' }}>
          <thead>
            {lista.length > 0 && (
              <tr style={{ backgroundColor: 'var(--bg-highlight)', borderBottom: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '0.85rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Total ({lista.length})</strong>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>{fmtMoneda(totales.gross)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{fmtMoneda(totales.aporte)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>{fmtMoneda(totales.facebook)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>{fmtMoneda(totales.expenses)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>{fmtMoneda(totales.melvin)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--danger)' }}>{fmtMoneda(totales.total)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>{fmtMoneda(totales.fondos)}</td>
              </tr>
            )}
            <tr>
              <th style={{ width: '100px' }}>Acciones</th>
              <th>Periodo</th>
              <th>Taller</th>
              <th style={{ textAlign: 'right' }}>Gross</th>
              <th style={{ textAlign: 'right' }}>Aporte %</th>
              <th style={{ textAlign: 'right' }}>Facebook</th>
              <th style={{ textAlign: 'right' }}>Expenses</th>
              <th style={{ textAlign: 'right' }}>Sr. Melvin</th>
              <th style={{ textAlign: 'right' }}>Total expenses</th>
              <th style={{ textAlign: 'right' }}>Fondos</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay gastos capturados con estos filtros.</td></tr>
            ) : (
              lista.map(g => {
                const fondos = fondosMarketing(g);
                return (
                  <tr key={g.id}>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.4rem', color: 'var(--primary)', borderColor: 'transparent', backgroundColor: 'rgba(29, 140, 248, 0.1)', opacity: puedoEditar ? 1 : 0.4, cursor: puedoEditar ? 'pointer' : 'not-allowed' }}
                          disabled={!puedoEditar}
                          onClick={() => abrirEditar(g)}
                          title={puedoEditar ? 'Editar' : 'Tu rol solo puede consultar'}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.4rem', color: 'var(--danger)', borderColor: 'transparent', backgroundColor: 'rgba(255, 76, 76, 0.1)', opacity: puedoEliminar ? 1 : 0.4, cursor: puedoEliminar ? 'pointer' : 'not-allowed' }}
                          disabled={!puedoEliminar}
                          onClick={() => { if (confirm(`¿Eliminar los gastos de ${g.mes} ${g.ano} de ${g.taller}?`)) eliminarGasto(g.id); }}
                          title={puedoEliminar ? 'Eliminar' : 'Tu rol no puede eliminar'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                    <td><strong style={{ color: 'var(--text-main)' }}>{g.mes}</strong> <span style={{ color: 'var(--text-muted)' }}>{g.ano}</span></td>
                    <td>{g.taller}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoneda(g.gross)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>
                      {fmtMoneda(aporteMarketing(g))}
                      <small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 500 }}>{g.porcentaje} %</small>
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtMoneda(g.facebook)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoneda(g.expenses)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoneda(g.pagoMelvin)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{fmtMoneda(totalExpensesMarketing(g))}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: fondos >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtMoneda(fondos)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ===================== MODAL ===================== */}
      {modalAbierto && (
        <div
          onClick={() => setModalAbierto(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 1rem', overflowY: 'auto' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-in fade-in"
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '880px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <DollarSign size={22} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>{editandoId ? 'Editar Gastos' : 'Nuevos Gastos'}</h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>El aporte y los fondos se calculan solos</p>
                </div>
              </div>
              <button onClick={() => setModalAbierto(false)} className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--text-muted)' }} title="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {talleresOrdenados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <Info size={36} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
                  <p style={{ color: 'var(--text-muted)' }}>No hay talleres. Crea uno en el módulo "Talleres" primero.</p>
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

                  <h3 className="detail-section-title" style={{ marginTop: '1.5rem' }}>Venta y aporte</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Gross (venta bruta)</label>
                      <input type="number" min={0} step="0.01" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Porcentaje de marketing</label>
                      <input type="number" min={0} step="0.01" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} placeholder="3" />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Aporte calculado</label>
                      <div className="form-control" style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-highlight)', color: 'var(--primary)', fontWeight: 800 }}>
                        {fmtMoneda(aporteModal)}
                      </div>
                    </div>
                  </div>

                  <h3 className="detail-section-title" style={{ marginTop: '1.5rem' }}>Gastos del mes</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Facebook</label>
                      <input type="number" min={0} step="0.01" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Expenses</label>
                      <input type="number" min={0} step="0.01" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Pago a Sr. Melvin</label>
                      <input type="number" min={0} step="0.01" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={pagoMelvin} onChange={(e) => setPagoMelvin(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">Observaciones <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
                    <input className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: campaña especial de julio" />
                  </div>

                  {/* RESULTADO EN VIVO */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: '3px solid var(--danger)' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Total de expenses</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--danger)' }}>{fmtMoneda(totalModal)}</div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: `3px solid ${fondosModal >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Fondos del taller</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: fondosModal >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtMoneda(fondosModal)}</div>
                    </div>
                  </div>

                  {yaExiste && (
                    <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Info size={14} color="var(--primary)" />
                      Ya hay gastos capturados de {mes} {ano} para {taller}. Al guardar se actualizarán.
                    </p>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setModalAbierto(false)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
