import { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { useMetasAnuales } from '../hooks/useMetasAnuales';
import type { Registro, Detalle } from '../types';
import { FileText, Search, Plus, Pencil, Trash2, X, Save, Target } from 'lucide-react';

// Función para forzar el formato Mes/Día/Año (MM/DD/YYYY)
const formatearFechaMDY = (fecha: string) => {
  if (!fecha) return '';
  const partes = fecha.split('-');
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${mes}/${dia}/${ano}`;
  }
  return fecha;
};

// Función local para forzar el formato Monetario: Coma (,) para miles y Punto (.) para decimales
const miFormatearMoneda = (valor: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor).replace('$', '$ ');
};

export const Registros = () => {
  const contexto = useContext(AppContext);
  // Metas anuales por taller (compartidas en Firestore)
  const { metasAnuales, obtenerMetaAnual, totalMetaAnualDelAno, guardarMetaAnual } = useMetasAnuales();
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

  // Tomamos el catálogo oficial y respetamos el orden configurado
  const talleresDisponibles = useMemo(() => {
    return [...contexto.talleres]
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map(t => t.nombre);
  }, [contexto.talleres]);

  // --- APLICAR FILTROS, BÚSQUEDA Y ORDENAMIENTO ---
  const registrosFiltrados = useMemo(() => {
    // Se hace una copia para poder ordenar sin mutar el contexto original
    let resultado = [...contexto.registros];

    // Filtros por dropdowns
    if (filtroAno) resultado = resultado.filter(r => r.ano.toString() === filtroAno);
    if (filtroMes) resultado = resultado.filter(r => r.mes === filtroMes);
    if (filtroTaller) resultado = resultado.filter(r => r.taller === filtroTaller);

    // Filtro por barra de búsqueda general
    if (busqueda.trim()) {
      const busquedaLower = busqueda.toLowerCase();
      resultado = resultado.filter(r => 
        r.taller.toLowerCase().includes(busquedaLower) || 
        r.mes.toLowerCase().includes(busquedaLower) ||
        r.ano.toString().includes(busquedaLower)
      );
    }

    // MAPA DE MESES PARA EL ORDENAMIENTO CRONOLÓGICO
    const ordenMeses: Record<string, number> = {
      'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6,
      'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
    };

    // ORDENAR: Año más reciente primero, luego Mes más reciente
    resultado.sort((a, b) => {
      if (b.ano !== a.ano) {
        return b.ano - a.ano; // Ordenar por año de mayor a menor
      }
      // Si es el mismo año, ordenamos por mes usando el mapa
      const mesA = ordenMeses[a.mes] || 0;
      const mesB = ordenMeses[b.mes] || 0;
      return mesB - mesA; // Ordenar por mes de mayor a menor
    });

    return resultado;
  }, [contexto.registros, busqueda, filtroAno, filtroMes, filtroTaller]);

  // --- TOTALES (sobre los registros ya filtrados) ---
  const totales = useMemo(() => {
    const totalMeta = registrosFiltrados.reduce((acc, r) => acc + (r.meta || 0), 0);
    const totalLogrado = registrosFiltrados.reduce((acc, r) => acc + (r.logrado || 0), 0);
    // Suma literal de los porcentajes de cada fila (puede pasar de 100%)
    const sumaPorcentajes = registrosFiltrados.reduce((acc, r) => acc + (r.porcentajeCumplido || 0), 0);
    // Cumplimiento global ponderado: total logrado / total meta
    const cumplimientoGlobal = totalMeta > 0 ? (totalLogrado / totalMeta) * 100 : 0;
    return { totalMeta, totalLogrado, sumaPorcentajes, cumplimientoGlobal, count: registrosFiltrados.length };
  }, [registrosFiltrados]);

  // --- META ANUAL DEL AÑO (por taller o consolidado) ---
  // Usa el año del filtro (o el año en curso si el filtro está en 'Todos los años')
  // y el taller del filtro (o todos los talleres = consolidado global).
  // La meta de referencia es la META ANUAL ESTABLECIDA en el catálogo; si el
  // taller no tiene una definida, se usa la suma de las metas mensuales.
  const anoResumen = filtroAno || String(new Date().getFullYear());

  const metaAnualEstablecida = useMemo(() => {
    if (filtroTaller) return obtenerMetaAnual('ventas', anoResumen, filtroTaller);
    // Consolidado global: suma de las metas anuales de todos los talleres
    return totalMetaAnualDelAno('ventas', anoResumen);
  }, [metasAnuales, anoResumen, filtroTaller]);

  const resumenAnual = useMemo(() => {
    const regs = contexto.registros.filter(r =>
      r.ano.toString() === anoResumen && (!filtroTaller || r.taller === filtroTaller)
    );
    const sumaMensual = regs.reduce((acc, r) => acc + (r.meta || 0), 0);
    // Si hay meta anual establecida se usa esa; si no, la suma de las mensuales
    const metaAnual = metaAnualEstablecida > 0 ? metaAnualEstablecida : sumaMensual;
    const logrado = regs.reduce((acc, r) => acc + (r.logrado || 0), 0);
    const faltante = Math.max(metaAnual - logrado, 0);
    const pct = metaAnual > 0 ? (logrado / metaAnual) * 100 : 0;
    return {
      metaAnual, sumaMensual, logrado, faltante, pct,
      esEstablecida: metaAnualEstablecida > 0,
      tieneDatos: regs.length > 0 || metaAnualEstablecida > 0
    };
  }, [contexto.registros, anoResumen, filtroTaller, metaAnualEstablecida]);

  // --- EDITOR DE LA META ANUAL (por taller) ---
  const [tallerMetaAnual, setTallerMetaAnual] = useState<string>('');
  const [valorMetaAnual, setValorMetaAnual] = useState<string>('');
  const [metaAnualGuardada, setMetaAnualGuardada] = useState<boolean>(false);

  const tallerEditorActual = tallerMetaAnual || talleresDisponibles[0] || '';

  // Precarga la meta guardada al cambiar de taller o de año
  useEffect(() => {
    if (!tallerEditorActual) { setValorMetaAnual(''); return; }
    const actual = obtenerMetaAnual('ventas', anoResumen, tallerEditorActual);
    setValorMetaAnual(actual > 0 ? String(actual) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tallerEditorActual, anoResumen, metasAnuales]);

  const guardarEditorMetaAnual = async () => {
    if (!tallerEditorActual) { alert('Selecciona un taller para guardar su meta anual.'); return; }
    const v = parseFloat(valorMetaAnual);
    await guardarMetaAnual('ventas', anoResumen, tallerEditorActual, isNaN(v) ? 0 : v);
    setMetaAnualGuardada(true);
    setTimeout(() => setMetaAnualGuardada(false), 1800);
  };

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

    // Sincronizar con Firebase
    await contexto.agregarRegistro(registroActualizado);
    setRegistroSeleccionado(registroActualizado);
    
    // Resetear form
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
      {/* HEADER PRINCIPAL */}
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

      {/* BARRA DE FILTROS SUPERIOR */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>Año</label>
          <select 
            className="form-control" 
            style={{ width: '100%', backgroundColor: 'var(--bg-body)', border: '1px solid transparent', padding: '0.8rem', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer', appearance: 'auto' }}
            value={filtroAno} 
            onChange={e => setFiltroAno(e.target.value)}
          >
            <option value="">Todos los años</option>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>Mes</label>
          <select 
            className="form-control" 
            style={{ width: '100%', backgroundColor: 'var(--bg-body)', border: '1px solid transparent', padding: '0.8rem', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer', appearance: 'auto' }}
            value={filtroMes} 
            onChange={e => setFiltroMes(e.target.value)}
          >
            <option value="">Todos los meses</option>
            {mesesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>Taller</label>
          <select 
            className="form-control" 
            style={{ width: '100%', backgroundColor: 'var(--bg-body)', border: '1px solid transparent', padding: '0.8rem', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer', appearance: 'auto' }}
            value={filtroTaller} 
            onChange={e => setFiltroTaller(e.target.value)}
          >
            <option value="">Todos los talleres</option>
            {talleresDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* CATÁLOGO: META ANUAL POR TALLER (editable, la que deben conseguir los empleados) */}
      <div style={{
        backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '1.1rem 1.5rem', marginBottom: '1.5rem',
        border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <Target size={20} color="#ffbc11" />
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>Meta anual por taller</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Objetivo de ventas que los empleados deben conseguir en el año</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ minWidth: '240px', flex: 1, margin: 0 }}>
            <label className="form-label">Taller</label>
            <select
              className="form-control"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={tallerEditorActual}
              onChange={(e) => setTallerMetaAnual(e.target.value)}
            >
              {talleresDisponibles.length === 0 && <option value="">Sin talleres</option>}
              {talleresDisponibles.map(t => <option key={`ma-${t}`} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '140px', margin: 0 }}>
            <label className="form-label">Año</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className="form-control"
              style={{ boxSizing: 'border-box', backgroundColor: 'var(--bg-highlight)', cursor: 'default' }}
              value={anoResumen}
              title="El año se toma del filtro Año de arriba."
            />
          </div>
          <div className="form-group" style={{ minWidth: '200px', margin: 0 }}>
            <label className="form-label">Meta anual ($)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="form-control"
              style={{ boxSizing: 'border-box' }}
              value={valorMetaAnual}
              onChange={(e) => setValorMetaAnual(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '2px' }}>
            <button onClick={guardarEditorMetaAnual} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }} disabled={talleresDisponibles.length === 0}>
              <Save size={16} /> Guardar meta anual
            </button>
            {metaAnualGuardada && (
              <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>✓ Guardado</span>
            )}
          </div>
          <p style={{ width: '100%', margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            La meta anual se guarda por taller y por año, y se comparte con todos los usuarios. Si un taller no tiene meta anual definida, se usa la suma de sus metas mensuales como referencia. Déjala en blanco o en 0 para eliminarla.
          </p>
        </div>
      </div>

      {/* RESUMEN DE LA META ANUAL DEL TALLER (o consolidado) */}
      <div style={{
        backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '1.1rem 1.5rem', marginBottom: '1.5rem',
        border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.85rem' }}>
          Meta anual {anoResumen} · {filtroTaller || 'Todos los talleres'}{' '}
          <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
            ({resumenAnual.esEstablecida ? 'meta anual establecida' : 'suma de las metas mensuales del año'})
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '8px', padding: '0.8rem 1rem', borderBottom: '3px solid #ffbc11' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>Meta Anual</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffbc11', whiteSpace: 'nowrap' }}>{resumenAnual.tieneDatos ? miFormatearMoneda(resumenAnual.metaAnual) : '—'}</div>
            {resumenAnual.esEstablecida && resumenAnual.sumaMensual > 0 && (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>
                Suma mensual: {miFormatearMoneda(resumenAnual.sumaMensual)}
              </div>
            )}
          </div>
          <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '8px', padding: '0.8rem 1rem', borderBottom: '3px solid var(--primary)' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>Logrado</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{resumenAnual.tieneDatos ? miFormatearMoneda(resumenAnual.logrado) : '—'}</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '8px', padding: '0.8rem 1rem', borderBottom: `3px solid ${resumenAnual.tieneDatos && resumenAnual.faltante === 0 ? 'var(--success)' : 'var(--danger)'}` }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>Faltante para la meta</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: resumenAnual.tieneDatos && resumenAnual.faltante === 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
              {!resumenAnual.tieneDatos ? '—' : resumenAnual.faltante === 0 ? 'Meta alcanzada ✓' : miFormatearMoneda(resumenAnual.faltante)}
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '8px', padding: '0.8rem 1rem', borderBottom: `3px solid ${resumenAnual.pct >= 100 ? 'var(--success)' : resumenAnual.pct >= 70 ? 'var(--primary)' : 'var(--danger)'}` }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>% Alcanzado</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: resumenAnual.pct >= 100 ? 'var(--success)' : resumenAnual.pct >= 70 ? 'var(--primary)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                {resumenAnual.tieneDatos ? `${resumenAnual.pct.toFixed(2)}%` : '—'}
              </span>
              {resumenAnual.tieneDatos && (
                <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--bg-highlight)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(resumenAnual.pct, 100)}%`, height: '100%', backgroundColor: resumenAnual.pct >= 100 ? 'var(--success)' : resumenAnual.pct >= 70 ? 'var(--primary)' : 'var(--danger)', borderRadius: '4px', transition: 'width 0.4s' }} />
                </div>
              )}
            </div>
          </div>
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
            {/* FILA DE TOTALES: entre el encabezado y las filas, respeta los filtros activos */}
            {registrosFiltrados.length > 0 && (
              <tr style={{ backgroundColor: 'var(--bg-highlight)', borderBottom: '2px solid var(--border)' }}>
                <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Σ</td>
                <td colSpan={2} style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  Totales <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({totales.count} registros)</span>
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 700 }}>{miFormatearMoneda(totales.totalMeta)}</td>
                <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 800 }}>{miFormatearMoneda(totales.totalLogrado)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800,
                      backgroundColor: 'rgba(29, 140, 248, 0.15)', color: 'var(--primary)'
                    }}>
                      {totales.sumaPorcentajes.toFixed(2)}%
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      (global {totales.cumplimientoGlobal.toFixed(2)}%)
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </thead>
          <tbody>
            {registrosFiltrados.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros que coincidan con los filtros.</td></tr>
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
                    {miFormatearMoneda(r.meta)}
                  </td>
                  <td data-label="Logrado:" style={{textAlign:'right', color: 'var(--text-main)', fontWeight: 600}}>
                    {miFormatearMoneda(r.logrado)}
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
                <button onClick={() => { setRegistroSeleccionado(null); setMostrarFormDetalle(false); setDetalleEditandoId(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
                  <div style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 600 }}>{miFormatearMoneda(registroSeleccionado.meta)}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Logrado:</label>
                  <div style={{ fontSize: '1.35rem', color: 'var(--primary)', fontWeight: 700 }}>{miFormatearMoneda(registroSeleccionado.logrado)}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '0.75rem' }}>Trabajo Pendiente:</label>
                  <div style={{ fontSize: '1.35rem', color: 'var(--danger)', fontWeight: 600 }}>{miFormatearMoneda(registroSeleccionado.faltante)}</div>
                </div>
              </div>

              {/* SECCIÓN DE OPERACIONES */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid var(--border)', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>Operaciones Relacionadas</h3>
                  <button 
                    onClick={toggleFormDetalle}
                    className="btn btn-outline" 
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', borderRadius: '10px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                  >
                    {mostrarFormDetalle ? <X size={14} /> : <Plus size={14} />} {mostrarFormDetalle ? 'Cancelar' : 'Agregar Operación'}
                  </button>
                </div>

                {/* FORMULARIO INLINE DE AGREGAR/EDITAR DETALLE */}
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
                    <button className="btn btn-primary" onClick={guardarDetalleRapido} style={{padding:'0.65rem 1.25rem', borderRadius:'8px'}} title={detalleEditandoId ? "Actualizar Operación" : "Guardar Operación"}>
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
                      <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registroSeleccionado.detalles.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay operaciones registradas.</td></tr>
                    ) : (
                      registroSeleccionado.detalles.map((det, idx) => (
                        <tr key={det.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', backgroundColor: detalleEditandoId === det.id ? 'var(--bg-highlight)' : 'transparent' }}>
                          <td style={{ padding: '1.25rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>{String(idx + 1).padStart(3, '0')}</td>
                          <td style={{ padding: '1.25rem 0.5rem', fontSize: '0.9rem' }}>{formatearFechaMDY(det.desde)}</td>
                          <td style={{ padding: '1.25rem 0.5rem', fontSize: '0.9rem' }}>{formatearFechaMDY(det.hasta)}</td>
                          <td style={{ padding: '1.25rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>{miFormatearMoneda(det.vendido)}</td>
                          <td style={{ padding: '1.25rem 0.5rem', textAlign: 'center' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>{det.porcentajeAporte.toFixed(2)}%</span>
                          </td>
                          <td style={{ padding: '1.25rem 0.5rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button 
                                onClick={() => iniciarEdicionDetalle(det)}
                                style={{ background: 'rgba(29, 140, 248, 0.1)', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Editar Operación"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => eliminarDetalleRapido(det.id)}
                                style={{ background: 'rgba(255, 76, 76, 0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Eliminar Operación"
                              >
                                <Trash2 size={14} />
                              </button>
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