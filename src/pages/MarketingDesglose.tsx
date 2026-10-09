import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useFiltroPresentacion, oPorDefecto } from '../context/filtroPresentacion';
import { MESES } from '../utils/formatters';
import { PORCENTAJE_MARKETING } from '../hooks/useMarketingGastos';
import { useMarketingDesglose, idDesglose, facebookDeTaller, type DesgloseMes } from '../hooks/useMarketingDesglose';
import { TextoEditable } from '../components/TextoEditable';
import { Receipt, Pencil, Save, X, Info, Power, PowerOff } from 'lucide-react';

// =========================================================================
//  MARKETING · DESGLOSE DE EXPENSES
//
//  Réplica del formato de Excel de la gerencia: una fila por taller con
//    · Gross:    el logrado mensual capturado en Taller → Registros
//    · Aporte:   el 3 % de ese gross (disponible para marketing)
//    · Facebook: gasto capturado a mano con el formulario
//    · Fondos:   aporte − Facebook
//  y la fila TOTAL al final. Solo Facebook es manual; todo lo demás se
//  calcula solo y se actualiza cuando cambian las ventas.
// =========================================================================

const fmtMoneda = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MarketingDesglose = () => {
  const contexto = useContext(AppContext);
  const { desgloses, guardarDesglose, desactivados, alternarTaller } = useMarketingDesglose();
  const filtroPres = useFiltroPresentacion();
  const { puedeEditar } = useAuth();
  const puedoEditar = puedeEditar('marketingDesglose');

  const registros = contexto?.registros ?? [];
  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();
  const mesActual = MESES[new Date().getMonth()] ?? 'Enero';

  // --- Filtros (abren con el filtro global de la presentación si existe) ---
  const [filtroAno, setFiltroAno] = useState<string>(oPorDefecto(filtroPres?.ano, String(anoActual)));
  const [filtroMes, setFiltroMes] = useState<string>(oPorDefecto(filtroPres?.mes, mesActual));

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(registros.map(r => String(r.ano)));
    desgloses.forEach(d => set.add(String(d.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [registros, desgloses, anoActual]);

  const esMesEspecifico = filtroMes !== 'Todos';

  // --- Pestañas: talleres activos (suman al total) y desactivados ---
  const [pestana, setPestana] = useState<'activos' | 'desactivados'>('activos');

  // Documentos de desglose que caen dentro del filtro (1 si es un mes, varios si es todo el año)
  const desglosesFiltrados = useMemo(
    () => desgloses
      .filter(d => String(d.ano) === filtroAno)
      .filter(d => !esMesEspecifico || d.mes === filtroMes),
    [desgloses, filtroAno, filtroMes, esMesEspecifico]
  );

  // --- Filas del reporte: una por taller ---
  const filas = useMemo(() => {
    return talleresOrdenados.map(t => {
      const gross = registros
        .filter(r => r.taller === t.nombre)
        .filter(r => String(r.ano) === filtroAno)
        .filter(r => !esMesEspecifico || r.mes === filtroMes)
        .reduce((acc, r) => acc + (typeof r.logrado === 'number' && isFinite(r.logrado) ? r.logrado : 0), 0);
      const aporte = (gross * PORCENTAJE_MARKETING) / 100;
      const facebook = desglosesFiltrados.reduce((acc, d) => acc + facebookDeTaller(d, t.nombre), 0);
      return { taller: t.nombre, gross, aporte, facebook, fondos: aporte - facebook };
    });
  }, [talleresOrdenados, registros, desglosesFiltrados, filtroAno, filtroMes, esMesEspecifico]);

  // Los talleres desactivados se muestran en su pestaña y NO suman al total
  const filasActivas = useMemo(() => filas.filter(f => !desactivados.includes(f.taller)), [filas, desactivados]);
  const filasInactivas = useMemo(() => filas.filter(f => desactivados.includes(f.taller)), [filas, desactivados]);
  const filasVisibles = pestana === 'activos' ? filasActivas : filasInactivas;

  const totales = useMemo(() => filasActivas.reduce((acc, f) => ({
    gross: acc.gross + f.gross,
    aporte: acc.aporte + f.aporte,
    facebook: acc.facebook + f.facebook,
    fondos: acc.fondos + f.fondos,
  }), { gross: 0, aporte: 0, facebook: 0, fondos: 0 }), [filasActivas]);

  const hayDatos = filas.some(f => f.gross > 0 || f.facebook > 0);

  // --- Formulario de Facebook (un monto por taller, del mes filtrado) ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [valoresForm, setValoresForm] = useState<Record<string, string>>({});

  const desgloseDelMes = useMemo(
    () => (esMesEspecifico ? desgloses.find(d => d.id === idDesglose(filtroAno, filtroMes)) : undefined),
    [desgloses, filtroAno, filtroMes, esMesEspecifico]
  );

  const talleresActivos = useMemo(
    () => talleresOrdenados.filter(t => !desactivados.includes(t.nombre)),
    [talleresOrdenados, desactivados]
  );

  const abrirFormulario = () => {
    const iniciales: Record<string, string> = {};
    talleresActivos.forEach(t => {
      const v = facebookDeTaller(desgloseDelMes, t.nombre);
      iniciales[t.nombre] = v > 0 ? String(v) : '';
    });
    setValoresForm(iniciales);
    setModalAbierto(true);
  };

  const dec = (s: string): number => {
    const v = parseFloat(s);
    return isNaN(v) || v < 0 ? 0 : v;
  };

  const guardar = () => {
    const facebook: Record<string, number> = { ...(desgloseDelMes?.facebook || {}) };
    talleresActivos.forEach(t => { facebook[t.nombre] = dec(valoresForm[t.nombre] || ''); });
    const reg: DesgloseMes = {
      id: idDesglose(filtroAno, filtroMes),
      ano: parseInt(filtroAno, 10),
      mes: filtroMes,
      facebook,
    };
    guardarDesglose(reg);
    setModalAbierto(false);
  };

  const etiquetaPeriodo = esMesEspecifico ? `${filtroMes} ${filtroAno}` : `Año ${filtroAno} (acumulado)`;

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Receipt size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}><TextoEditable clave="mkt.desglose.titulo" defecto="Desglose de Expenses" /></h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              <TextoEditable clave="mkt.desglose.subtitulo" defecto={`Logrado por taller, aporte del ${PORCENTAJE_MARKETING} % y gasto de Facebook del mes`} />
            </p>
          </div>
        </div>

        {puedoEditar && (
          <button
            onClick={abrirFormulario}
            className="btn btn-primary"
            disabled={!esMesEspecifico}
            title={esMesEspecifico ? 'Capturar el gasto de Facebook de cada taller' : 'Selecciona un mes específico para capturar Facebook'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', opacity: esMesEspecifico ? 1 : 0.55 }}
          >
            <Pencil size={16} /> <TextoEditable clave="mkt.desglose.btnCapturar" defecto="Capturar Facebook" />
          </button>
        )}
      </div>

      {/* FILTROS */}
      <div className="filter-bar">
        <div className="filter-group">
          <label><TextoEditable clave="mkt.desglose.filtro.ano" defecto="Año" /></label>
          <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label><TextoEditable clave="mkt.desglose.filtro.mes" defecto="Mes" /></label>
          <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="Todos">Todo el año (acumulado)</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* PESTAÑAS: ACTIVOS / DESACTIVADOS */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setPestana('activos')}
          className="btn"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            border: `1px solid ${pestana === 'activos' ? 'var(--primary)' : 'var(--border)'}`,
            backgroundColor: pestana === 'activos' ? 'var(--primary)' : 'var(--bg-panel)',
            color: pestana === 'activos' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Power size={15} /> <TextoEditable clave="mkt.desglose.tab.activos" defecto="Talleres activos" /> ({filasActivas.length})
        </button>
        <button
          onClick={() => setPestana('desactivados')}
          className="btn"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            border: `1px solid ${pestana === 'desactivados' ? 'var(--danger)' : 'var(--border)'}`,
            backgroundColor: pestana === 'desactivados' ? 'var(--danger)' : 'var(--bg-panel)',
            color: pestana === 'desactivados' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <PowerOff size={15} /> <TextoEditable clave="mkt.desglose.tab.desactivados" defecto="Desactivados" /> ({filasInactivas.length})
        </button>
      </div>

      {/* TABLA ESTILO EXCEL */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="report-header" style={{ borderTop: `3px solid ${pestana === 'activos' ? 'var(--danger)' : 'var(--text-muted)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span>
            {pestana === 'activos'
              ? <TextoEditable clave="mkt.desglose.seccion" defecto="DESGLOSE · TOTAL DE EXPENSES" />
              : <TextoEditable clave="mkt.desglose.seccionDesactivados" defecto="TALLERES DESACTIVADOS · NO SUMAN AL TOTAL" />}
          </span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
            color: 'var(--text-muted)', backgroundColor: 'var(--bg-highlight)',
            border: '1px solid var(--border)', borderRadius: '999px', padding: '0.3rem 0.9rem'
          }}>
            {etiquetaPeriodo}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table tabla-desglose" style={{ width: '100%', minWidth: '720px' }}>
            <thead>
              <tr>
                {puedoEditar && <th style={{ width: '70px', textAlign: 'center' }}><TextoEditable clave="mkt.desglose.col.estado" defecto="Estado" /></th>}
                <th><TextoEditable clave="mkt.desglose.col.sucursal" defecto="Sucursal" /></th>
                <th style={{ textAlign: 'right' }}>
                  <TextoEditable clave="mkt.desglose.col.gross" defecto="Gross" />
                  <small style={{ display: 'block', fontWeight: 500, textTransform: 'none', color: 'inherit', opacity: 0.75, fontSize: '0.68rem' }}>
                    <TextoEditable clave="mkt.desglose.col.grossNota" defecto="(logrado del mes en Registros)" />
                  </small>
                </th>
                <th style={{ textAlign: 'right' }}><TextoEditable clave="mkt.desglose.col.aporte" defecto={`${PORCENTAJE_MARKETING} %`} /></th>
                <th style={{ textAlign: 'right' }}><TextoEditable clave="mkt.desglose.col.facebook" defecto="Facebook" /></th>
                <th style={{ textAlign: 'right' }}><TextoEditable clave="mkt.desglose.col.fondos" defecto="Fondos de cada taller" /></th>
              </tr>
            </thead>
            <tbody>
              {filasVisibles.map(f => (
                <tr key={f.taller} style={{ opacity: pestana === 'desactivados' ? 0.65 : 1 }}>
                  {puedoEditar && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => alternarTaller(f.taller)}
                        className="btn btn-outline"
                        title={pestana === 'activos' ? 'Desactivar: pasa a la pestaña Desactivados y deja de sumar al total' : 'Activar: vuelve al desglose y suma al total'}
                        style={{ padding: '0.35rem 0.5rem', color: pestana === 'activos' ? 'var(--success)' : 'var(--text-muted)' }}
                      >
                        {pestana === 'activos' ? <Power size={16} /> : <PowerOff size={16} />}
                      </button>
                    </td>
                  )}
                  <td><strong style={{ color: 'var(--text-main)' }}>{f.taller}</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: f.gross > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {f.gross > 0 ? fmtMoneda(f.gross) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                    {fmtMoneda(f.aporte)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: f.facebook > 0 ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {f.facebook > 0 ? fmtMoneda(f.facebook) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: f.fondos >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                    {fmtMoneda(f.fondos)}
                  </td>
                </tr>
              ))}
              {filasVisibles.length === 0 && (
                <tr>
                  <td colSpan={puedoEditar ? 6 : 5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {pestana === 'activos' ? 'No hay talleres activos.' : 'No hay talleres desactivados.'}
                  </td>
                </tr>
              )}
            </tbody>
            {pestana === 'activos' && filasActivas.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                  {puedoEditar && <td></td>}
                  <td style={{ padding: '1rem' }}><strong style={{ fontSize: '1rem' }}><TextoEditable clave="mkt.desglose.fila.total" defecto="TOTAL" /></strong></td>
                  <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{fmtMoneda(totales.gross)}</td>
                  <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{fmtMoneda(totales.aporte)}</td>
                  <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{fmtMoneda(totales.facebook)}</td>
                  <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 800, color: totales.fondos >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>{fmtMoneda(totales.fondos)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p style={{ margin: 0, padding: '0.75rem 1.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={13} style={{ flexShrink: 0 }} />
          {pestana === 'activos'
            ? <TextoEditable clave="mkt.desglose.nota" defecto={`El Gross es el logrado mensual capturado en Taller → Registros; el ${PORCENTAJE_MARKETING} % es lo disponible para marketing. Facebook se captura a mano y los fondos son el aporte menos lo gastado en Facebook.`} />
            : <TextoEditable clave="mkt.desglose.notaDesactivados" defecto="Estos talleres no suman al total del desglose ni aparecen en el formulario de Facebook. Actívalos de nuevo con el botón de encendido." />}
        </p>
      </div>

      {!hayDatos && (
        <p style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Sin ventas ni gastos capturados para {etiquetaPeriodo}.
        </p>
      )}

      {/* MODAL: CAPTURA DE FACEBOOK POR TALLER */}
      {modalAbierto && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pencil size={18} color="var(--primary)" /> Facebook · {filtroMes} {filtroAno}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="btn btn-outline" style={{ padding: '0.35rem' }} title="Cerrar">
                <X size={16} />
              </button>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Captura lo gastado en Facebook por cada taller este mes. Deja vacío lo que no aplique.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {talleresActivos.map(t => (
                <div key={t.id} className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label className="form-label" style={{ flex: 1, margin: 0 }}>{t.nombre}</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={valoresForm[t.nombre] ?? ''}
                    onChange={e => setValoresForm(v => ({ ...v, [t.nombre]: e.target.value }))}
                    style={{ width: '160px', textAlign: 'right', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              {talleresActivos.length === 0 && (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay talleres activos.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setModalAbierto(false)} className="btn btn-outline">Cancelar</button>
              <button onClick={guardar} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Save size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
