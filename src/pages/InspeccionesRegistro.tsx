import { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MESES } from '../utils/formatters';
import { useInspecciones, idInspeccion, type Inspeccion } from '../hooks/useInspecciones';
import { useMetasAnuales } from '../hooks/useMetasAnuales';
import { Plus, Save, Trash2, Pencil, X, Search, ClipboardList, Info, DollarSign } from 'lucide-react';
import { useFiltroPresentacion, oPorDefecto } from '../context/filtroPresentacion';

// Formato de moneda en USD (mismo estilo usado en el resto de la app)
const miFormatearMoneda = (valor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(valor) ? valor : 0).replace('$', '$ ');

// Catálogo: clave de almacenamiento del costo predefinido de la inspección
const STORAGE_COSTO_DEFAULT = 'inspecciones_costo_default_v1';
// Catálogo (LEGADO): meta global única — se conserva solo como respaldo de lectura
const STORAGE_META_DEFAULT = 'inspecciones_meta_default_v1';
// Catálogo (NUEVO): metas POR TALLER, con meta de 4 semanas y meta de 5 semanas
//   Estructura: { [nombreTaller]: { m4: string; m5: string } }
export const STORAGE_METAS_TALLER = 'inspecciones_metas_taller_v1';

export type MetasTaller = Record<string, { m4: string; m5: string }>;

// Lee el mapa completo de metas por taller desde el almacenamiento
export const leerMetasTaller = (): MetasTaller => {
  try {
    const raw = localStorage.getItem(STORAGE_METAS_TALLER);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? (obj as MetasTaller) : {};
  } catch {
    return {};
  }
};

// Meta programada de un taller según las semanas del mes (4 o 5).
// Si el taller no tiene meta propia, cae a la meta global legada (solo 4 semanas).
export const metaDeTaller = (metas: MetasTaller, taller: string, semanas: number): number => {
  const reg = metas[taller];
  const crudo = reg ? (semanas >= 5 ? reg.m5 : reg.m4) : '';
  let v = parseInt(crudo, 10);
  if (isNaN(v) || v < 0) {
    // Respaldo: meta global legada (aplicaba a meses de 4 semanas)
    if (semanas < 5) {
      try { v = parseInt(localStorage.getItem(STORAGE_META_DEFAULT) ?? '', 10); } catch { v = NaN; }
    } else {
      v = NaN;
    }
  }
  return isNaN(v) || v < 0 ? 0 : v;
};

export const InspeccionesRegistro = () => {
  const contexto = useContext(AppContext);
  const { inspecciones, guardarInspeccion, eliminarInspeccion } = useInspecciones();
  // Nivel de acceso del rol sobre este módulo (Roles y Permisos)
  const { puedeEditar, puedeEliminar } = useAuth();
  const puedoEditar = puedeEditar('inspeccionesRegistro');
  const puedoEliminar = puedeEliminar('inspeccionesRegistro');
  // Metas anuales por taller (compartidas en Firestore)
  const { metasAnuales, obtenerMetaAnual, guardarMetaAnual } = useMetasAnuales();

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();

  // --- Filtros y búsqueda (vista tipo "Gestión de Registros") ---
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
  const [mes, setMes] = useState<string>(MESES[0] ?? 'Enero');
  const [cantidad, setCantidad] = useState<string>('');
  const [costo, setCosto] = useState<string>(''); // NUEVO: costo por inspección
  const [semanas, setSemanas] = useState<string>('4'); // NUEVO: semanas del mes (4 o 5)
  // Al EDITAR: meta/taller/semanas originales del registro, para NO pisar la meta ya guardada
  const [metaOriginal, setMetaOriginal] = useState<number | null>(null);
  const [tallerOriginal, setTallerOriginal] = useState<string>('');
  const [semanasOriginal, setSemanasOriginal] = useState<number>(4);

  // --- CATÁLOGO: costo predefinido de la inspección (persistente) ---
  const [costoCatalogo, setCostoCatalogo] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_COSTO_DEFAULT) ?? ''; } catch { return ''; }
  });
  const [catalogoGuardado, setCatalogoGuardado] = useState<boolean>(false);

  const guardarCostoCatalogo = () => {
    const v = parseFloat(costoCatalogo);
    const limpio = isNaN(v) || v < 0 ? '' : String(v);
    setCostoCatalogo(limpio);
    try { localStorage.setItem(STORAGE_COSTO_DEFAULT, limpio); } catch { /* almacenamiento no disponible */ }
    setCatalogoGuardado(true);
    setTimeout(() => setCatalogoGuardado(false), 1800);
  };

  // --- CATÁLOGO: metas programadas POR TALLER (meta de 4 semanas y meta de 5 semanas) ---
  const [metasTaller, setMetasTaller] = useState<MetasTaller>(() => leerMetasTaller());
  const [catTallerMeta, setCatTallerMeta] = useState<string>(''); // taller seleccionado en el catálogo
  const [catMeta4, setCatMeta4] = useState<string>('');           // meta para meses de 4 semanas
  const [catMeta5, setCatMeta5] = useState<string>('');           // meta para meses de 5 semanas
  const [catalogoMetaGuardado, setCatalogoMetaGuardado] = useState<boolean>(false);

  const tallerCatalogoActual = catTallerMeta || (talleresOrdenados[0]?.nombre ?? '');

  // Al cambiar de taller en el catálogo, precarga sus metas guardadas
  const seleccionarTallerCatalogo = (nombre: string) => {
    setCatTallerMeta(nombre);
    const reg = metasTaller[nombre];
    setCatMeta4(reg?.m4 ?? '');
    setCatMeta5(reg?.m5 ?? '');
  };

  // Precarga las metas guardadas cuando cambia el taller activo del catálogo
  useEffect(() => {
    if (tallerCatalogoActual) {
      const reg = metasTaller[tallerCatalogoActual];
      setCatMeta4(reg?.m4 ?? '');
      setCatMeta5(reg?.m5 ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tallerCatalogoActual]);

  const limpiarEntero = (s: string) => {
    const v = parseInt(s, 10);
    return isNaN(v) || v < 0 ? '' : String(v);
  };

  const guardarMetaCatalogo = () => {
    if (!tallerCatalogoActual) { alert('Selecciona un taller para guardar sus metas.'); return; }
    const m4 = limpiarEntero(catMeta4);
    const m5 = limpiarEntero(catMeta5);
    const nuevo: MetasTaller = { ...metasTaller, [tallerCatalogoActual]: { m4, m5 } };
    setMetasTaller(nuevo);
    setCatMeta4(m4);
    setCatMeta5(m5);
    try { localStorage.setItem(STORAGE_METAS_TALLER, JSON.stringify(nuevo)); } catch { /* almacenamiento no disponible */ }
    setCatalogoMetaGuardado(true);
    setTimeout(() => setCatalogoMetaGuardado(false), 1800);
  };

  // Año de referencia para la meta anual: el del filtro Año, o el año en curso
  const anoMetaAnual = filtroAno !== 'Todos' ? filtroAno : String(anoActual);

  // --- EDITOR DE LA META ANUAL DE INSPECCIONES (por taller y por año) ---
  const [valorMetaAnual, setValorMetaAnual] = useState<string>('');
  const [metaAnualGuardada, setMetaAnualGuardada] = useState<boolean>(false);

  // Precarga la meta anual guardada al cambiar de taller o de año
  useEffect(() => {
    if (!tallerCatalogoActual) { setValorMetaAnual(''); return; }
    const actual = obtenerMetaAnual('inspecciones', anoMetaAnual, tallerCatalogoActual);
    setValorMetaAnual(actual > 0 ? String(actual) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tallerCatalogoActual, anoMetaAnual, metasAnuales]);

  const guardarEditorMetaAnual = async () => {
    if (!tallerCatalogoActual) { alert('Selecciona un taller para guardar su meta anual.'); return; }
    const v = parseInt(valorMetaAnual, 10);
    await guardarMetaAnual('inspecciones', anoMetaAnual, tallerCatalogoActual, isNaN(v) ? 0 : v);
    setMetaAnualGuardada(true);
    setTimeout(() => setMetaAnualGuardada(false), 1800);
  };

  // Meta anual ESTABLECIDA del taller del catálogo (0 si no tiene)
  const metaAnualEstablecida = useMemo(
    () => (tallerCatalogoActual ? obtenerMetaAnual('inspecciones', anoMetaAnual, tallerCatalogoActual) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metasAnuales, anoMetaAnual, tallerCatalogoActual]
  );

  // META ANUAL CALCULADA del taller del catálogo: suma de las metas mensuales
  // de sus registros capturados en el año
  const metaAnualCatalogo = useMemo(() => {
    return inspecciones
      .filter(i => i.taller === tallerCatalogoActual && String(i.ano) === anoMetaAnual)
      .reduce((acc, i) => acc + (typeof (i as any).meta === 'number' ? (i as any).meta : 0), 0);
  }, [inspecciones, tallerCatalogoActual, anoMetaAnual]);

  // RESUMEN ANUAL DE INSPECCIONES del taller del catálogo: meta, alcanzado,
  // faltante, porcentaje alcanzado y porcentaje faltante
  const resumenAnualInsp = useMemo(() => {
    const regs = inspecciones.filter(i => i.taller === tallerCatalogoActual && String(i.ano) === anoMetaAnual);
    const alcanzado = regs.reduce((acc, i) => acc + (i.cantidad || 0), 0);
    const metaAnual = metaAnualEstablecida > 0 ? metaAnualEstablecida : metaAnualCatalogo;
    const faltante = Math.max(metaAnual - alcanzado, 0);
    const pct = metaAnual > 0 ? (alcanzado / metaAnual) * 100 : 0;
    return {
      metaAnual, alcanzado, faltante, pct,
      pctFaltante: Math.max(100 - pct, 0),
      esEstablecida: metaAnualEstablecida > 0,
      tieneDatos: regs.length > 0 || metaAnualEstablecida > 0
    };
  }, [inspecciones, tallerCatalogoActual, anoMetaAnual, metaAnualEstablecida, metaAnualCatalogo]);

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

  // Total de inspección de un registro (usa el guardado o lo calcula como respaldo)
  const totalRegistro = (r: Inspeccion) =>
    typeof (r as any).total === 'number'
      ? (r as any).total
      : r.cantidad * (typeof (r as any).costo === 'number' ? (r as any).costo : 0);

  const totalLista = useMemo(() => lista.reduce((acc, r) => acc + r.cantidad, 0), [lista]);
  const totalMontoLista = useMemo(() => lista.reduce((acc, r) => acc + totalRegistro(r), 0), [lista]);

  // --- Acciones del modal ---
  const abrirNuevo = () => {
    setEditandoId(null);
    setTaller(talleresOrdenados[0]?.nombre ?? '');
    setAno(filtroAno !== 'Todos' ? filtroAno : String(anoActual));
    setMes(filtroMes !== 'Todos' ? filtroMes : (MESES[0] ?? 'Enero'));
    setCantidad('');
    setCosto(costoCatalogo || ''); // precarga el costo predefinido del catálogo
    setSemanas('4');
    setMetaOriginal(null);
    setTallerOriginal('');
    setSemanasOriginal(4);
    setModalAbierto(true);
  };

  const abrirEditar = (i: Inspeccion) => {
    setEditandoId(i.id);
    setTaller(i.taller);
    setAno(String(i.ano));
    setMes(i.mes);
    setCantidad(String(i.cantidad));
    setCosto((i as any).costo != null ? String((i as any).costo) : '');
    const semReg = (i as any).semanas != null && (i as any).semanas > 0 ? Number((i as any).semanas) : 4;
    setSemanas(String(semReg));
    // Se conserva la meta YA GUARDADA del registro: editarlo no debe tomar la meta nueva del catálogo
    setMetaOriginal(typeof (i as any).meta === 'number' ? (i as any).meta : null);
    setTallerOriginal(i.taller);
    setSemanasOriginal(semReg === 5 ? 5 : 4);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
  };

  const idActual = idInspeccion(taller, ano, mes);
  const registroExistente = inspecciones.find(i => i.id === idActual);
  const sobrescribe = !!registroExistente && editandoId !== idActual;

  // --- Cálculo del TOTAL en vivo dentro del modal: cantidad × costo ---
  const cantNum = parseInt(cantidad, 10);
  const costoNum = parseFloat(costo);
  const totalInspeccion = (isNaN(cantNum) ? 0 : cantNum) * (isNaN(costoNum) ? 0 : costoNum);

  // --- Meta programada en vivo dentro del modal ---
  // Al EDITAR se conserva la meta original del registro (los cambios del catálogo
  // no afectan lo ya guardado). Solo se recalcula del catálogo si cambian el
  // taller o las semanas, porque entonces la meta original ya no aplica.
  const semanasNum = parseInt(semanas, 10) === 5 ? 5 : 4;
  const conservaMetaOriginal =
    editandoId !== null &&
    metaOriginal !== null &&
    taller === tallerOriginal &&
    semanasNum === semanasOriginal;
  const metaModal = conservaMetaOriginal
    ? (metaOriginal as number)
    : (taller ? metaDeTaller(metasTaller, taller, semanasNum) : 0);

  const guardar = () => {
    if (!taller) { alert('Selecciona un taller.'); return; }
    const cant = parseInt(cantidad, 10);
    if (isNaN(cant) || cant < 0) { alert('Ingresa un número de inspecciones válido.'); return; }
    const cost = parseFloat(costo);
    const costFinal = isNaN(cost) || cost < 0 ? 0 : cost;
    const semNum = parseInt(semanas, 10);
    const semFinal = semNum === 5 ? 5 : 4;
    // Meta final: al editar se CONSERVA la meta original del registro (salvo que
    // cambien taller o semanas); al crear se toma del catálogo por taller.
    const metaFinal =
      editandoId !== null && metaOriginal !== null && taller === tallerOriginal && semFinal === semanasOriginal
        ? metaOriginal
        : metaDeTaller(metasTaller, taller, semFinal);
    // Se construye sin anotar el tipo y se castea al guardar para no chocar con el
    // chequeo de propiedades del literal mientras el tipo Inspeccion no declare costo/total.
    const insp = {
      id: idActual,
      taller,
      ano: parseInt(ano, 10),
      mes,
      cantidad: cant,
      costo: costFinal,
      total: cant * costFinal,
      meta: metaFinal,
      semanas: semFinal,
    };
    guardarInspeccion(insp as Inspeccion);
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
          {puedoEditar && (
            <button onClick={abrirNuevo} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Nueva Inspección
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

      {/* CATÁLOGO: COSTO Y META PREDEFINIDOS DE LA INSPECCIÓN */}
      <div className="card" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
          <DollarSign size={28} color="var(--primary)" />
          <div>
            <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Catálogo de Costos y Meta</h3>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              El costo y la meta definidos aquí se aplican automáticamente a todas las inspecciones (se configuran una sola vez).
            </p>
          </div>
        </div>
        <div className="form-group" style={{ minWidth: '180px', margin: 0 }}>
          <label className="form-label">Costo predefinido de inspección</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="form-control"
            style={{ boxSizing: 'border-box' }}
            value={costoCatalogo}
            onChange={(e) => setCostoCatalogo(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '2px' }}>
          <button onClick={guardarCostoCatalogo} className="btn btn-primary" disabled={!puedoEditar} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', opacity: puedoEditar ? 1 : 0.5 }}>
            <Save size={16} /> Guardar costo
          </button>
          {catalogoGuardado && (
            <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>✓ Guardado</span>
          )}
        </div>
        <div style={{ width: '100%', height: '1px', background: 'var(--border)', margin: '0.25rem 0' }} />
        {/* METAS PROGRAMADAS POR TALLER: una meta para meses de 4 semanas y otra para meses de 5 semanas */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ minWidth: '240px', flex: 1, margin: 0 }}>
            <label className="form-label">Taller (meta programada)</label>
            <select
              className="form-control"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={tallerCatalogoActual}
              onChange={(e) => seleccionarTallerCatalogo(e.target.value)}
            >
              {talleresOrdenados.length === 0 && <option value="">Sin talleres</option>}
              {talleresOrdenados.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '160px', margin: 0 }}>
            <label className="form-label">Meta 4 semanas</label>
            <input
              type="number"
              min={0}
              className="form-control"
              style={{ boxSizing: 'border-box' }}
              value={catMeta4}
              onChange={(e) => setCatMeta4(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-group" style={{ minWidth: '160px', margin: 0 }}>
            <label className="form-label">Meta 5 semanas</label>
            <input
              type="number"
              min={0}
              className="form-control"
              style={{ boxSizing: 'border-box' }}
              value={catMeta5}
              onChange={(e) => setCatMeta5(e.target.value)}
              placeholder="0"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '2px' }}>
            <button onClick={guardarMetaCatalogo} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }} disabled={talleresOrdenados.length === 0 || !puedoEditar}>
              <Save size={16} /> Guardar metas
            </button>
            {catalogoMetaGuardado && (
              <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>✓ Guardado</span>
            )}
          </div>
          {/* META ANUAL EDITABLE: objetivo del año que deben conseguir los empleados */}
          <div style={{ width: '100%', height: '1px', background: 'var(--border)', margin: '0.25rem 0' }} />
          <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: '200px', margin: 0 }}>
              <label className="form-label">Meta anual {anoMetaAnual} (inspecciones)</label>
              <input
                type="number"
                min={0}
                className="form-control"
                style={{ boxSizing: 'border-box' }}
                value={valorMetaAnual}
                onChange={(e) => setValorMetaAnual(e.target.value)}
                placeholder="0"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '2px' }}>
              <button onClick={guardarEditorMetaAnual} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }} disabled={talleresOrdenados.length === 0 || !puedoEditar}>
                <Save size={16} /> Guardar meta anual
              </button>
              {metaAnualGuardada && (
                <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>✓ Guardado</span>
              )}
            </div>
            {/* RESUMEN ANUAL: meta, alcanzada, faltante y porcentajes */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: `3px solid ${'#ffbc11'}` }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Meta anual</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffbc11', whiteSpace: 'nowrap' }}>
                  {resumenAnualInsp.metaAnual > 0 ? resumenAnualInsp.metaAnual.toLocaleString('en-US') : '—'}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{resumenAnualInsp.esEstablecida ? 'Meta establecida' : 'Meta agregada desde registros'}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: `3px solid ${'var(--primary)'}` }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Meta anual alcanzada</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                  {resumenAnualInsp.tieneDatos ? resumenAnualInsp.alcanzado.toLocaleString('en-US') : '—'}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: `3px solid ${resumenAnualInsp.tieneDatos && resumenAnualInsp.faltante === 0 ? 'var(--success)' : 'var(--danger)'}` }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Meta anual faltante</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: resumenAnualInsp.tieneDatos && resumenAnualInsp.faltante === 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                  {!resumenAnualInsp.tieneDatos ? '—' : resumenAnualInsp.faltante === 0 ? 'Meta alcanzada ✓' : resumenAnualInsp.faltante.toLocaleString('en-US')}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: `3px solid ${resumenAnualInsp.pct >= 100 ? 'var(--success)' : resumenAnualInsp.pct >= 70 ? 'var(--primary)' : 'var(--danger)'}` }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Porcentaje alcanzado</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: resumenAnualInsp.pct >= 100 ? 'var(--success)' : resumenAnualInsp.pct >= 70 ? 'var(--primary)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                  {resumenAnualInsp.tieneDatos ? `${resumenAnualInsp.pct.toFixed(2)}%` : '—'}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: `3px solid ${resumenAnualInsp.pctFaltante === 0 ? 'var(--success)' : 'var(--danger)'}` }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Porcentaje faltante</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: resumenAnualInsp.pctFaltante === 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                  {resumenAnualInsp.tieneDatos ? `${resumenAnualInsp.pctFaltante.toFixed(2)}%` : '—'}
                </div>
              </div>
            </div>
          </div>
          <p style={{ width: '100%', margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Cada taller tiene su propia meta: una para meses de 4 semanas y otra para meses de 5 semanas. Al capturar una inspección, la meta se toma automáticamente según el taller y las semanas del mes. <strong style={{ color: 'var(--text-main)' }}>Cambiar estas metas no afecta los registros ya guardados</strong>: cada registro conserva la meta con la que fue capturado. Si el taller no tiene <strong style={{ color: 'var(--text-main)' }}>meta anual</strong> establecida, se usa la suma de las metas mensuales de sus registros capturados en el año.
          </p>
        </div>
      </div>

      {/* TABLA */}
      <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            {/* TOTALES: arriba del encabezado (respetan los filtros activos) */}
            {lista.length > 0 && (
              <tr style={{ backgroundColor: 'var(--bg-highlight)', borderBottom: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total ({lista.length} registros)</strong></td>
                <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{totalLista}</td>
                <td style={{ textAlign: 'right', padding: '0.85rem', color: 'var(--text-muted)' }}>—</td>
                <td style={{ textAlign: 'right', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{miFormatearMoneda(totalMontoLista)}</td>
              </tr>
            )}
            <tr>
              <th style={{ width: '110px' }}>Acciones</th>
              <th>Periodo</th>
              <th>Taller</th>
              <th style={{ textAlign: 'center' }}>Inspecciones</th>
              <th style={{ textAlign: 'right' }}>Costo</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay inspecciones que coincidan con los filtros.</td></tr>
            ) : (
              lista.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--primary)', borderColor: 'transparent', backgroundColor: 'rgba(29, 140, 248, 0.1)', opacity: puedoEditar ? 1 : 0.4, cursor: puedoEditar ? 'pointer' : 'not-allowed' }} disabled={!puedoEditar} onClick={() => abrirEditar(r)} title={puedoEditar ? "Editar" : "Tu rol solo puede consultar"}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--danger)', borderColor: 'transparent', backgroundColor: 'rgba(255, 76, 76, 0.1)', opacity: puedoEliminar ? 1 : 0.4, cursor: puedoEliminar ? 'pointer' : 'not-allowed' }} disabled={!puedoEliminar} onClick={() => { if (confirm(`¿Eliminar el registro de ${r.mes} ${r.ano} de ${r.taller}?`)) eliminarInspeccion(r.id); }} title={puedoEliminar ? "Eliminar" : "Tu rol no puede eliminar"}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                  <td><strong style={{ color: 'var(--text-main)' }}>{r.mes}</strong> <span style={{ color: 'var(--text-muted)' }}>{r.ano}</span></td>
                  <td>{r.taller}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>{r.cantidad}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{miFormatearMoneda(typeof (r as any).costo === 'number' ? (r as any).costo : 0)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{miFormatearMoneda(totalRegistro(r))}</td>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group" style={{ minWidth: 0, gridColumn: '1 / -1' }}>
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
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Inspecciones</label>
                      <input type="number" min={0} className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">
                        Meta programada <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                          {conservaMetaOriginal ? '(meta original del registro)' : `(${semanasNum} semanas · del catálogo del taller)`}
                        </small>
                      </label>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        className="form-control"
                        style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-highlight)', color: metaModal > 0 ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'default' }}
                        value={metaModal > 0 ? `${metaModal} inspecciones` : 'Sin definir'}
                        title={conservaMetaOriginal
                          ? 'Este registro conserva la meta con la que fue guardado. Los cambios posteriores del catálogo no lo afectan (solo se recalcula si cambias el taller o las semanas).'
                          : 'La meta se define por taller en el Catálogo (arriba), con un valor para meses de 4 semanas y otro para meses de 5 semanas.'}
                      />
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">
                        Semanas del mes <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(4 o 5)</small>
                      </label>
                      <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={semanas} onChange={(e) => setSemanas(e.target.value)}>
                        <option value="4">4 semanas</option>
                        <option value="5">5 semanas</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">
                        Costo de la inspección <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(c/u)</small>
                      </label>
                      <input type="number" min={0} step="0.01" className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ minWidth: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label">
                        Total de la inspección <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Inspecciones × Costo)</small>
                      </label>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        className="form-control"
                        style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-highlight)', color: 'var(--primary)', fontWeight: 800, cursor: 'default' }}
                        value={miFormatearMoneda(totalInspeccion)}
                      />
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