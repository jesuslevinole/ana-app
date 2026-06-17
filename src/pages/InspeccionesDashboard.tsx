import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones } from '../hooks/useInspecciones';
import { LineChart, TrendingUp, TrendingDown, Award, Sigma, Filter } from 'lucide-react';

type Modo = 'enteros' | 'porcentual';

export const InspeccionesDashboard = () => {
  const contexto = useContext(AppContext);
  const { inspecciones } = useInspecciones();

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();
  const [taller, setTaller] = useState<string>('');
  const [ano, setAno] = useState<string>(String(anoActual));
  const [modo, setModo] = useState<Modo>('enteros');

  const tallerSeleccionado = taller || (talleresOrdenados[0]?.nombre ?? '');

  // Años disponibles según los datos (más el año actual)
  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(inspecciones.filter(i => i.taller === tallerSeleccionado).map(i => String(i.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [inspecciones, tallerSeleccionado, anoActual]);

  // Datos del taller/año, en orden calendario, solo meses con registro
  const datos = useMemo(() => {
    return MESES
      .map(mes => {
        const reg = inspecciones.find(i => i.taller === tallerSeleccionado && String(i.ano) === ano && i.mes === mes);
        return reg ? { mes, cantidad: reg.cantidad } : null;
      })
      .filter((d): d is { mes: string; cantidad: number } => d !== null);
  }, [inspecciones, tallerSeleccionado, ano]);

  // Métricas derivadas (entero + porcentual)
  const filas = useMemo(() => {
    const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
    return datos.map((d, i) => {
      const prev = i > 0 ? datos[i - 1].cantidad : null;
      const deltaEntero = prev !== null ? d.cantidad - prev : null;
      const deltaPct = prev !== null && prev > 0 ? ((d.cantidad - prev) / prev) * 100 : null;
      const pctTotal = total > 0 ? (d.cantidad / total) * 100 : 0;
      return { ...d, deltaEntero, deltaPct, pctTotal };
    });
  }, [datos]);

  const kpis = useMemo(() => {
    const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
    const promedio = datos.length > 0 ? total / datos.length : 0;
    const mejor = datos.reduce((best, d) => (d.cantidad > best.cantidad ? d : best), { mes: '-', cantidad: 0 });
    let variacionUltimo: number | null = null;
    if (datos.length >= 2) {
      const a = datos[datos.length - 2].cantidad;
      const b = datos[datos.length - 1].cantidad;
      variacionUltimo = a > 0 ? ((b - a) / a) * 100 : null;
    }
    return { total, promedio, mejor, variacionUltimo };
  }, [datos]);

  // ---- GRÁFICA DE LÍNEAS (contenida, responsiva) ----
  const renderLinea = () => {
    if (datos.length === 0) {
      return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>Sin datos para graficar.</p>;
    }
    const esPct = modo === 'porcentual';
    const serie = datos.map((d, i) => {
      if (!esPct) return { label: d.mes, valor: d.cantidad };
      const prev = i > 0 ? datos[i - 1].cantidad : 0;
      const varp = i > 0 && prev > 0 ? ((d.cantidad - prev) / prev) * 100 : 0;
      return { label: d.mes, valor: Number(varp.toFixed(1)) };
    });

    const W = 760, H = 320, pl = 54, pr = 26, pt = 42, pb = 42;
    const iw = W - pl - pr, ih = H - pt - pb;
    const vals = serie.map(s => s.valor);
    let min = Math.min(...vals, 0);
    let max = Math.max(...vals, 0);
    if (min === max) max = min + (esPct ? 10 : 5);

    const X = (i: number) => pl + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
    const Y = (v: number) => pt + ih - ((v - min) / (max - min)) * ih;
    const poly = serie.map((s, i) => `${X(i).toFixed(1)},${Y(s.valor).toFixed(1)}`).join(' ');
    const ticks = 4;
    const hayCero = min < 0 && max > 0;

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: '480px', display: 'block' }}>
          {/* Líneas de cuadrícula + etiquetas eje Y */}
          {Array.from({ length: ticks + 1 }).map((_, k) => {
            const v = min + (max - min) * (k / ticks);
            const yy = Y(v);
            return (
              <g key={`grid-${k}`}>
                <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="var(--border)" strokeWidth="1" opacity="0.4" />
                <text x={pl - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
                  {esPct ? `${v.toFixed(0)}%` : Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* Línea base en cero si hay valores negativos */}
          {hayCero && <line x1={pl} y1={Y(0)} x2={W - pr} y2={Y(0)} stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />}

          {/* Línea principal */}
          <polyline points={poly} fill="none" stroke="#ff4c4c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Puntos + etiquetas de valor + etiquetas de mes */}
          {serie.map((s, i) => {
            const cx = X(i), cy = Y(s.valor);
            return (
              <g key={`pt-${i}`}>
                <circle cx={cx} cy={cy} r="6" fill="#ff4c4c" stroke="var(--bg-panel)" strokeWidth="2" />
                <text x={cx} y={cy - 13} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-main)">
                  {esPct ? `${s.valor.toFixed(1)}%` : s.valor}
                </text>
                <text x={cx} y={H - pb + 20} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-muted)">
                  {s.label.substring(0, 3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const fmtPct = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
  const fmtDelta = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v}`);

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <LineChart size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Dashboard de Inspecciones</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Evolución en enteros y porcentual</p>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Taller</label>
          <select value={tallerSeleccionado} onChange={(e) => setTaller(e.target.value)}>
            {talleresOrdenados.length === 0 && <option value="">Sin talleres</option>}
            {talleresOrdenados.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Año</label>
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {datos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '1.5rem' }}>
          <Filter size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin inspecciones registradas</h3>
          <p style={{ color: 'var(--text-muted)' }}>Captura inspecciones en "Registro" para ver la evolución de {tallerSeleccionado || 'este taller'} en {ano}.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-title">Total {ano} <Sigma size={16} color="var(--primary)" /></div>
              <div className="kpi-value" style={{ color: 'var(--primary)' }}>{kpis.total}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Promedio mensual <LineChart size={16} /></div>
              <div className="kpi-value">{kpis.promedio.toFixed(1)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Mejor mes <Award size={16} color="var(--success)" /></div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{kpis.mejor.cantidad}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{kpis.mejor.mes}</div>
            </div>
            <div className="kpi-card" style={{ position: 'relative' }}>
              <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Variación último mes
                {kpis.variacionUltimo !== null && (kpis.variacionUltimo >= 0
                  ? <TrendingUp size={16} color="var(--success)" />
                  : <TrendingDown size={16} color="var(--danger)" />)}
              </div>
              <div className="kpi-value" style={{ color: kpis.variacionUltimo === null ? 'var(--text-muted)' : (kpis.variacionUltimo >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                {kpis.variacionUltimo === null ? '-' : `${kpis.variacionUltimo >= 0 ? '+' : ''}${kpis.variacionUltimo.toFixed(1)}%`}
              </div>
            </div>
          </div>

          {/* GRÁFICA DE LÍNEAS */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Evolución de inspecciones</h3>
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <button onClick={() => setModo('enteros')} style={{ padding: '0.4rem 1rem', border: 'none', background: modo === 'enteros' ? 'var(--primary)' : 'transparent', color: modo === 'enteros' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}>Enteros</button>
                <button onClick={() => setModo('porcentual')} style={{ padding: '0.4rem 1rem', border: 'none', background: modo === 'porcentual' ? 'var(--primary)' : 'transparent', color: modo === 'porcentual' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}>Variación %</button>
              </div>
            </div>
            {renderLinea()}
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {modo === 'enteros' ? 'Número de inspecciones por mes.' : 'Variación porcentual respecto al mes anterior.'}
            </p>
          </div>

          {/* TABLA DE EVOLUCIÓN */}
          <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
            <h3 className="detail-section-title">Detalle de evolución</h3>
            <table className="table" style={{ width: '100%', marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'center' }}>Inspecciones</th>
                  <th style={{ textAlign: 'center' }}>Variación (Δ)</th>
                  <th style={{ textAlign: 'center' }}>Variación %</th>
                  <th style={{ textAlign: 'center' }}>% del total</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.mes}>
                    <td><strong>{f.mes}</strong></td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>{f.cantidad}</td>
                    <td style={{ textAlign: 'center', color: f.deltaEntero === null ? 'var(--text-muted)' : (f.deltaEntero >= 0 ? 'var(--success)' : 'var(--danger)'), fontWeight: 600 }}>{fmtDelta(f.deltaEntero)}</td>
                    <td style={{ textAlign: 'center', color: f.deltaPct === null ? 'var(--text-muted)' : (f.deltaPct >= 0 ? 'var(--success)' : 'var(--danger)'), fontWeight: 600 }}>{fmtPct(f.deltaPct)}</td>
                    <td style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 700 }}>{f.pctTotal.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total</strong></td>
                  <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{kpis.total}</td>
                  <td colSpan={2}></td>
                  <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
};