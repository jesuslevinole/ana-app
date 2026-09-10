import { useState, useMemo, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { CATALOGO_NAVEGACION, TODAS_LAS_VISTAS } from '../config/navegacion';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import {
  usePresentaciones, idDesdeNombre, normalizarTexto, DIAPOSITIVA_VACIA,
  SIN_ANO, SIN_MES,
  type Presentacion as TipoPresentacion, type DiapositivaTexto
} from '../hooks/usePresentaciones';
import { ContextoFiltroPresentacion, type FiltroPresentacion } from '../context/filtroPresentacion';
import { MESES } from '../utils/formatters';

import { Dashboard } from './Dashboard';
import { Registros } from './Registros';
import { Comparacion } from './Comparacion';
import { ComparacionMeses } from './ComparacionMeses';
import { Talleres } from './Talleres';
import { InspeccionesRegistro } from './InspeccionesRegistro';
import { InspeccionesDashboard } from './InspeccionesDashboard';
import { InspeccionesComparacion } from './InspeccionesComparacion';
import { InspeccionesComparacionMeses } from './InspeccionesComparacionMeses';
import { ReporteAnualGeneral } from './ReporteAnualGeneral';
import { ReporteAnualInspecciones } from './ReporteAnualInspecciones';
import { MarketingRegistro } from './MarketingRegistro';
import { MarketingGastos } from './MarketingGastos';
import { MarketingDashboard } from './MarketingDashboard';

import {
  MonitorPlay, Plus, Play, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Check, GripVertical, Maximize2, Minimize2, Info, Presentation,
  Folder, Filter, ChevronDown, Store, CalendarRange
} from 'lucide-react';

// =========================================================================
//  PRESENTACIÓN
//
//  Permite armar una secuencia de módulos y recorrerlos a pantalla completa
//  como diapositivas, sin abrir pestañas ni navegar por el menú.
//
//  · ARMADO: se eligen los módulos y se ordenan (flechas o arrastrando).
//  · REPRODUCCIÓN: cada módulo se muestra completo, con botones de avanzar y
//    retroceder, flechas del teclado y pantalla completa del navegador.
// =========================================================================

// Qué componente se dibuja en cada diapositiva
const COMPONENTES: Record<string, () => ReactNode> = {
  dashboard: () => <Dashboard />,
  tabla: () => <Registros />,
  comparacion: () => <Comparacion />,
  comparacionMeses: () => <ComparacionMeses />,
  talleres: () => <Talleres />,
  inspeccionesRegistro: () => <InspeccionesRegistro />,
  inspeccionesDashboard: () => <InspeccionesDashboard />,
  inspeccionesComparacion: () => <InspeccionesComparacion />,
  inspeccionesComparacionMeses: () => <InspeccionesComparacionMeses />,
  reporteAnualGeneral: () => <ReporteAnualGeneral />,
  reporteAnualInspecciones: () => <ReporteAnualInspecciones />,
  marketing: () => <MarketingRegistro />,
  marketingGastos: () => <MarketingGastos />,
  marketingDashboard: () => <MarketingDashboard />,
};

// Una diapositiva puede ser la portada, un módulo del sistema o el cierre
type Diapositiva =
  | { tipo: 'portada'; texto: DiapositivaTexto }
  | { tipo: 'cierre'; texto: DiapositivaTexto }
  | { tipo: 'vista'; vista: string };

// Color de texto (oscuro o blanco) que contrasta con un fondo hexadecimal
const colorTextoSobre = (hex: string): string => {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return '#ffffff';
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff';
};

const fechaDeHoy = () =>
  new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

export const Presentacion = () => {
  const contexto = useContext(AppContext);
  const talleres = contexto?.talleres ?? [];
  const { puedeVer, puedeEditar, puedeEliminar } = useAuth();
  const { t } = useEtiquetas();
  const { presentaciones, guardarPresentacion, guardarOrden, eliminarPresentacion } = usePresentaciones();

  const puedoEditar = puedeEditar('presentacion');
  const puedoEliminar = puedeEliminar('presentacion');

  // --- Editor ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [vistas, setVistas] = useState<string[]>([]);
  // Filtro inicial: manda sobre todas las diapositivas y define la carpeta
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroTaller, setFiltroTaller] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroSemanas, setFiltroSemanas] = useState('');
  const [portada, setPortada] = useState<DiapositivaTexto>({ ...DIAPOSITIVA_VACIA });
  const [cierre, setCierre] = useState<DiapositivaTexto>({ ...DIAPOSITIVA_VACIA });
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState<number | null>(null);

  // --- Reproducción ---
  const [reproduciendo, setReproduciendo] = useState<TipoPresentacion | null>(null);
  const [indice, setIndice] = useState(0);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  const etiquetaVista = useCallback((vista: string) => {
    const item = TODAS_LAS_VISTAS.find(v => v.vista === vista);
    return item ? t(item.claveEtiqueta, item.etiqueta) : vista;
  }, [t]);

  // Nombre del grupo al que pertenece una vista (para ubicar al espectador)
  const grupoDeVista = useCallback((vista: string) => {
    const grupo = CATALOGO_NAVEGACION.find(g => g.items.some(i => i.vista === vista));
    return grupo ? t(grupo.claveEtiqueta, grupo.etiqueta) : '';
  }, [t]);

  // Solo se ofrecen los módulos que el usuario puede ver
  const disponiblesPorGrupo = useMemo(() => {
    return CATALOGO_NAVEGACION
      .map(g => ({
        ...g,
        items: g.items.filter(i => COMPONENTES[i.vista] && puedeVer(i.vista)),
      }))
      .filter(g => g.items.length > 0);
  }, [puedeVer]);

  // Orden dentro de la carpeta: manda el campo "orden" (arrastrar y soltar) y
  // a igualdad de orden se acomoda por nombre.
  const presentacionesOrdenadas = useMemo(
    () => [...presentaciones].sort((a, b) => {
      const oa = typeof a.orden === 'number' ? a.orden : 0;
      const ob = typeof b.orden === 'number' ? b.orden : 0;
      if (oa !== ob) return oa - ob;
      return a.nombre.localeCompare(b.nombre);
    }),
    [presentaciones]
  );

  // =====================================================================
  //  ÁRBOL DE CARPETAS: Año → Mes
  //  Los años y los meses van de mayor a menor (lo más reciente primero),
  //  que es como se revisa en las juntas. Dentro de cada mes vive una
  //  presentación por taller, generadas todas de una vez.
  // =====================================================================
  const carpetaAno = (p: TipoPresentacion) => p.ano?.trim() || SIN_ANO;
  // Logo y color del taller de una presentación, para pintar su tarjeta y su
  // portada sin tener que configurarlos a mano.
  const datosTaller = (nombreTaller?: string) => {
    const t = talleres.find(x => x.nombre === nombreTaller) || null;
    return {
      nombre: t?.nombre || nombreTaller || '',
      logo: t?.logo || '',
      color: (t && (t as unknown as { color?: string }).color) || '#1d8cf8',
    };
  };
  const carpetaMes = (p: TipoPresentacion) => p.mes?.trim() || SIN_MES;

  // Carpeta seleccionada. Con año y mes en null se ven todas.
  const [selAno, setSelAno] = useState<string | null>(null);
  const [selMes, setSelMes] = useState<string | null>(null);

  // Nodos desplegados del árbol y estado del panel lateral
  const [ramasAbiertas, setRamasAbiertas] = useState<string[]>([]);
  const [panelAbierto, setPanelAbierto] = useState(true);

  const alternarRama = (clave: string) =>
    setRamasAbiertas(r => (r.includes(clave) ? r.filter(x => x !== clave) : [...r, clave]));

  // Ordena años de mayor a menor; "Sin año" siempre al final
  const ordenarAnos = (a: string, b: string) => {
    if (a === SIN_ANO) return 1;
    if (b === SIN_ANO) return -1;
    return (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0);
  };

  // Ordena meses de mayor a menor según el calendario; "Sin mes" al final
  const ordenarMeses = (a: string, b: string) => {
    if (a === SIN_MES) return 1;
    if (b === SIN_MES) return -1;
    return MESES.indexOf(b) - MESES.indexOf(a);
  };

  // Árbol completo: años y los meses de cada año
  const arbol = useMemo(() => {
    const porAno = new Map<string, TipoPresentacion[]>();
    presentacionesOrdenadas.forEach(p => {
      const k = carpetaAno(p);
      porAno.set(k, [...(porAno.get(k) || []), p]);
    });

    return Array.from(porAno.keys()).sort(ordenarAnos).map(ano => {
      const delAno = porAno.get(ano) || [];
      const porMes = new Map<string, TipoPresentacion[]>();
      delAno.forEach(p => {
        const k = carpetaMes(p);
        porMes.set(k, [...(porMes.get(k) || []), p]);
      });
      const mesesNodo = Array.from(porMes.keys()).sort(ordenarMeses).map(mes => ({
        mes, total: (porMes.get(mes) || []).length,
      }));
      return { ano, total: delAno.length, meses: mesesNodo };
    });
  }, [presentacionesOrdenadas]);

  // Presentaciones de la carpeta seleccionada
  const listaCarpeta = useMemo(
    () => presentacionesOrdenadas
      .filter(p => !selAno || carpetaAno(p) === selAno)
      .filter(p => !selMes || carpetaMes(p) === selMes),
    [presentacionesOrdenadas, selAno, selMes]
  );

  // Nombre de la carpeta abierta, para el encabezado de la lista
  const rutaCarpeta = [selAno, selMes].filter(Boolean).join('  ›  ') || 'Todas las presentaciones';

  // --- ARRASTRAR Y SOLTAR para reordenar las presentaciones ---
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [sobreId, setSobreId] = useState<string | null>(null);

  const soltarPresentacion = async (destinoId: string) => {
    const origenId = arrastrandoId;
    setArrastrandoId(null);
    setSobreId(null);
    if (!origenId || origenId === destinoId || !puedoEditar) return;

    const ids = listaCarpeta.map(p => p.id);
    const desde = ids.indexOf(origenId);
    const hacia = ids.indexOf(destinoId);
    if (desde < 0 || hacia < 0) return;

    ids.splice(hacia, 0, ids.splice(desde, 1)[0]);
    await guardarOrden(ids);
  };

  // =====================================================================
  //  EDITOR
  // =====================================================================
  // El nombre sale del filtro: AÑO · MES. Es el mismo para todos los talleres
  // del mes, que se distinguen por su logo y su color en la tarjeta.
  const nombre = [filtroAno, filtroMes].filter(x => x && x.trim()).join(' · ');

  // Talleres del sistema, en su orden de visualización
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const abrirNueva = () => {
    setEditandoId(null);
    setDescripcion('');
    setVistas([]);
    setFiltroAno(String(new Date().getFullYear()));
    setFiltroTaller('');
    setFiltroMes('');
    setFiltroSemanas('');
    // Una presentación nueva llega con portada y cierre listos para usarse.
    // La portada trae los textos pedidos por la gerencia; "{mes}" se sustituye
    // solo al reproducir, según el mes de la presentación.
    setPortada({ ...DIAPOSITIVA_VACIA, activa: true, titulo: "Presentación de KPI's" });
    setCierre({ ...DIAPOSITIVA_VACIA, activa: true, titulo: 'Gracias' });
    setModalAbierto(true);
  };

  const abrirEditar = (p: TipoPresentacion) => {
    setEditandoId(p.id);
    setDescripcion(p.descripcion || '');
    setVistas([...p.vistas]);
    setFiltroAno(p.ano || '');
    setFiltroTaller(p.taller || '');
    setFiltroMes(p.mes || '');
    setFiltroSemanas(p.semanas || '');
    setPortada(normalizarTexto(p.portada));
    setCierre(normalizarTexto(p.cierre));
    setModalAbierto(true);
  };

  const alternarVista = (vista: string) => {
    setVistas(v => (v.includes(vista) ? v.filter(x => x !== vista) : [...v, vista]));
  };

  const mover = (desde: number, hacia: number) => {
    if (hacia < 0 || hacia >= vistas.length) return;
    setVistas(v => {
      const next = [...v];
      const [item] = next.splice(desde, 1);
      next.splice(hacia, 0, item);
      return next;
    });
  };

  const soltarEn = (destino: number) => {
    if (arrastrando === null || arrastrando === destino) { setArrastrando(null); return; }
    mover(arrastrando, destino);
    setArrastrando(null);
  };

  // Id de la presentación de un taller dentro de un mes
  const idDeTaller = (ano: string, mes: string, taller: string) =>
    idDesdeNombre(`${ano}-${mes}-${taller}`);

  const guardar = async () => {
    if (!nombre.trim()) { alert('Elige el año y el mes: de ahí sale el nombre.'); return; }
    if (vistas.length === 0 && !portada.activa && !cierre.activa) {
      alert('Agrega al menos un módulo, una portada o una conclusión.');
      return;
    }

    setGuardando(true);
    try {
      // --- EDICIÓN: solo se actualiza la presentación abierta ---
      if (editandoId) {
        const existente = presentaciones.find(p => p.id === editandoId);
        await guardarPresentacion({
          id: editandoId,
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          vistas,
          ano: filtroAno,
          taller: filtroTaller,
          mes: filtroMes,
          semanas: filtroSemanas,
          portada,
          cierre,
          creadoEn: existente?.creadoEn,
          orden: existente?.orden,
        });
        setModalAbierto(false);
        return;
      }

      // --- ALTA: se genera una presentación por cada taller del sistema ---
      if (talleresOrdenados.length === 0) {
        alert('No hay talleres registrados. Crea al menos uno en el módulo "Talleres".');
        return;
      }

      const yaExisten = talleresOrdenados.filter(t =>
        presentaciones.some(p => p.id === idDeTaller(filtroAno, filtroMes, t.nombre))
      );
      if (yaExisten.length > 0) {
        const seguir = confirm(
          `${yaExisten.length} de ${talleresOrdenados.length} talleres ya tienen presentación de ${nombre}.\n\n` +
          'Se respetan tal cual (con sus ediciones) y solo se crean las que faltan. ¿Continuar?'
        );
        if (!seguir) return;
      }

      const nuevos = talleresOrdenados.filter(t =>
        !presentaciones.some(p => p.id === idDeTaller(filtroAno, filtroMes, t.nombre))
      );

      await Promise.all(nuevos.map(t => guardarPresentacion({
        id: idDeTaller(filtroAno, filtroMes, t.nombre),
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        vistas,
        ano: filtroAno,
        taller: t.nombre,          // cada una queda filtrada por su taller
        mes: filtroMes,
        semanas: filtroSemanas,
        portada,
        cierre,
        orden: (talleresOrdenados.indexOf(t) + 1) * 10,
      })));

      // Al terminar se abre la carpeta del mes recién generado
      setSelAno(filtroAno || SIN_ANO);
      setSelMes(filtroMes || SIN_MES);
      setModalAbierto(false);
      if (nuevos.length === 0) alert('Todos los talleres ya tenían su presentación de este mes.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (p: TipoPresentacion) => {
    if (!confirm(`¿Eliminar la presentación "${p.nombre}"?`)) return;
    await eliminarPresentacion(p.id);
  };

  // =====================================================================
  //  REPRODUCCIÓN
  // =====================================================================
  // Arma la secuencia completa: portada + módulos visibles + cierre
  const armarDiapositivas = useCallback((p: TipoPresentacion): Diapositiva[] => {
    const portadaP = normalizarTexto(p.portada);
    const cierreP = normalizarTexto(p.cierre);
    const lista: Diapositiva[] = [];
    if (portadaP.activa) lista.push({ tipo: 'portada', texto: portadaP });
    p.vistas.filter(v => COMPONENTES[v] && puedeVer(v)).forEach(v => lista.push({ tipo: 'vista', vista: v }));
    if (cierreP.activa) lista.push({ tipo: 'cierre', texto: cierreP });
    return lista;
  }, [puedeVer]);

  const diapositivas = useMemo(
    () => (reproduciendo ? armarDiapositivas(reproduciendo) : []),
    [reproduciendo, armarDiapositivas]
  );

  const presentar = (p: TipoPresentacion) => {
    if (armarDiapositivas(p).length === 0) {
      alert('Esta presentación no tiene diapositivas que puedas ver.');
      return;
    }
    setIndice(0);
    setReproduciendo(p);
  };

  const cerrarPresentacion = useCallback(() => {
    setReproduciendo(null);
    setIndice(0);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* el navegador no lo permitió */ });
    }
  }, []);

  const siguiente = useCallback(() => {
    setIndice(i => (i + 1 < diapositivas.length ? i + 1 : i));
  }, [diapositivas.length]);

  const anterior = useCallback(() => {
    setIndice(i => (i > 0 ? i - 1 : i));
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignorado */ });
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        alert('El navegador no permitió activar la pantalla completa.');
      });
    }
  };

  // Estado real de la pantalla completa (el usuario puede salir con F11 o Esc)
  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  // Teclado: flechas para navegar y Esc para salir
  useEffect(() => {
    if (!reproduciendo) return;
    const alPulsar = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      const escribiendo = !!destino && ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName);
      if (escribiendo) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); siguiente(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); anterior(); }
      else if (e.key === 'Escape') { cerrarPresentacion(); }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [reproduciendo, siguiente, anterior, cerrarPresentacion]);

  // Cada diapositiva empieza arriba
  useEffect(() => {
    const cont = document.getElementById('lienzo-presentacion');
    if (cont) cont.scrollTop = 0;
  }, [indice]);

  // Blindaje: si dentro de una diapositiva se pulsa algo que navega a otra
  // vista (por ejemplo "Nuevo Registro"), la presentación se perdería. Aquí se
  // devuelve la navegación a su sitio para no cortar la exposición.
  const vistaApp = (contexto?.vista as string) ?? '';
  useEffect(() => {
    if (!reproduciendo) return;
    if (vistaApp && vistaApp !== 'presentacion' && contexto) {
      (contexto.setVista as (v: string) => void)('presentacion');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaApp, reproduciendo]);

  // Filtro que se inyecta a todas las diapositivas de la presentación activa
  const filtroActivo: FiltroPresentacion | null = reproduciendo
    ? {
        taller: reproduciendo.taller || '',
        ano: reproduciendo.ano || '',
        mes: reproduciendo.mes || '',
        semanas: reproduciendo.semanas || '',
      }
    : null;

  // Texto legible del periodo, para mostrarlo en portada y conclusión
  const textoPeriodo = (p?: TipoPresentacion | null): string => {
    if (!p) return '';
    const partes = [p.taller, p.mes, p.ano].filter(Boolean);
    return partes.join(' · ');
  };

  // Rótulo que se muestra en la barra superior y en los puntos de navegación
  const tituloDiapositiva = (d?: Diapositiva): string => {
    if (!d) return '';
    if (d.tipo === 'portada') return 'Portada';
    if (d.tipo === 'cierre') return 'Conclusión';
    return `${grupoDeVista(d.vista)} · ${etiquetaVista(d.vista)}`;
  };

  // Sustituye {mes}, {año} y {taller} por los valores del filtro de la
  // presentación (o del calendario actual si la presentación no tiene mes/año).
  // Así la portada puede decir "Resultados mes de {mes}" y actualizarse sola.
  const conPlaceholders = (s: string): string => {
    const mes = reproduciendo?.mes || MESES[new Date().getMonth()] || '';
    const ano = reproduciendo?.ano || String(new Date().getFullYear());
    const taller = reproduciendo?.taller || '';
    return s
      .replace(/\{mes\}/gi, mes)
      .replace(/\{a(ñ|n)o\}/gi, ano)
      .replace(/\{taller\}/gi, taller);
  };

  // Textos "de relleno" (Subtitulo, Punto 1, Pie de página...) que a veces se
  // capturan como ejemplo: se tratan como vacíos y NO se proyectan.
  const esRelleno = (s: string): boolean => {
    const t = s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t === '' || t === 'titulo' || t === 'subtitulo' || t === 'pie de pagina' || t === 'pie' || /^punto \d+$/.test(t);
  };
  const textoLimpio = (s?: string): string => (!s || esRelleno(s) ? '' : conPlaceholders(s));

  // PORTADA / CIERRE: pantalla completa con el color y el logo del taller
  const dibujarTexto = (texto: DiapositivaTexto, esPortada: boolean) => {
    const taller = talleres.find(t => t.nombre === (texto.taller || reproduciendo?.taller)) || null;
    const color = (taller && (taller as unknown as { color?: string }).color) || '#1d8cf8';
    const textoSobre = colorTextoSobre(color);
    const titulo = conPlaceholders(
      (!esRelleno(texto.titulo) && texto.titulo.trim()) || (esPortada ? (reproduciendo?.nombre ?? '') : 'Gracias')
    );
    const subtitulo = textoLimpio(texto.subtitulo);
    const pie = textoLimpio(texto.pie);
    const puntos = (texto.puntos || []).filter(x => !esRelleno(x)).map(x => conPlaceholders(x));

    return (
      <div style={{
        minHeight: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        gap: '1.5rem', padding: '3rem 2rem 7rem 2rem',
        background: `linear-gradient(135deg, ${color} 0%, rgba(0,0,0,0.55) 140%)`,
        color: textoSobre
      }}>
        {taller?.logo && (
          <div style={{
            width: '170px', height: '170px', borderRadius: '24px', backgroundColor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            boxShadow: '0 12px 34px rgba(0,0,0,0.4)'
          }}>
            <img src={taller.logo} alt={taller.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}

        <h1 style={{
          margin: 0, fontSize: 'clamp(2rem, 5.5vw, 3.6rem)', fontWeight: 900,
          letterSpacing: '0.5px', lineHeight: 1.1, textShadow: '0 3px 12px rgba(0,0,0,0.35)'
        }}>
          {titulo}
        </h1>

        {subtitulo && (
          <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 2.4vw, 1.6rem)', fontWeight: 600, opacity: 0.92, maxWidth: '900px' }}>
            {subtitulo}
          </h2>
        )}

        {puntos.length > 0 && (
          <ul style={{
            listStyle: 'none', margin: '0.5rem 0 0 0', padding: 0, textAlign: 'left',
            maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '0.85rem'
          }}>
            {puntos.map((punto, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: 'clamp(0.95rem, 2vw, 1.35rem)', fontWeight: 500, lineHeight: 1.4 }}>
                <span style={{
                  flexShrink: 0, marginTop: '0.45em', width: '10px', height: '10px',
                  borderRadius: '50%', backgroundColor: textoSobre, opacity: 0.8
                }} />
                {punto}
              </li>
            ))}
          </ul>
        )}

        {(pie || texto.mostrarFecha || (texto.mostrarPeriodo && textoPeriodo(reproduciendo))) && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', opacity: 0.85 }}>
            {texto.mostrarPeriodo && textoPeriodo(reproduciendo) && (
              <span style={{ fontSize: 'clamp(1rem, 2.2vw, 1.35rem)', fontWeight: 800, letterSpacing: '0.5px' }}>
                {textoPeriodo(reproduciendo)}
              </span>
            )}
            {pie && <span style={{ fontSize: '1rem', fontWeight: 600 }}>{pie}</span>}
            {texto.mostrarFecha && (
              <span style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {fechaDeHoy()}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const dibujarDiapositiva = (d?: Diapositiva) => {
    if (!d) return null;
    if (d.tipo === 'portada') return dibujarTexto(d.texto, true);
    if (d.tipo === 'cierre') return dibujarTexto(d.texto, false);
    const componente = COMPONENTES[d.vista];
    if (componente) return componente();
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Info size={44} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)' }}>Módulo no disponible</h3>
        <p style={{ color: 'var(--text-muted)' }}>Esta diapositiva ya no existe en el sistema.</p>
      </div>
    );
  };

  // =====================================================================
  //  MODO PRESENTACIÓN (pantalla completa)
  // =====================================================================
  if (reproduciendo) {
    const actual = diapositivas[Math.min(indice, diapositivas.length - 1)];
    const esPrimera = indice === 0;
    const esUltima = indice >= diapositivas.length - 1;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column'
      }}>
        {/* BARRA SUPERIOR */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', padding: '0.7rem 1.25rem', flexShrink: 0,
          backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <Presentation size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {reproduciendo.nombre}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tituloDiapositiva(actual)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            {textoPeriodo(reproduciendo) && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)',
                border: '1px solid var(--primary)', borderRadius: '999px',
                padding: '0.2rem 0.7rem', whiteSpace: 'nowrap'
              }}>
                <Filter size={12} /> {textoPeriodo(reproduciendo)}
                {reproduciendo.semanas ? ` · ${reproduciendo.semanas} sem` : ''}
              </span>
            )}
            <span style={{
              fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-highlight)', borderRadius: '999px', padding: '0.25rem 0.8rem',
              whiteSpace: 'nowrap'
            }}>
              {indice + 1} / {diapositivas.length}
            </span>
            <button className="btn btn-outline" onClick={alternarPantallaCompleta} style={{ padding: '0.4rem 0.6rem' }} title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}>
              {pantallaCompleta ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="btn btn-outline" onClick={cerrarPresentacion} style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} title="Salir de la presentación (Esc)">
              <X size={16} /> Salir
            </button>
          </div>
        </div>

        {/* LIENZO: el módulo se dibuja completo, como si fuera la diapositiva */}
        <div id="lienzo-presentacion" style={{ flex: 1, overflowY: 'auto', padding: actual && actual.tipo !== 'vista' ? 0 : '1.75rem 2rem 5.5rem 2rem' }}>
          {/* Todas las diapositivas heredan el mismo filtro inicial */}
          <ContextoFiltroPresentacion.Provider value={filtroActivo}>
            {dibujarDiapositiva(actual)}
          </ContextoFiltroPresentacion.Provider>
        </div>

        {/* FLECHAS LATERALES */}
        <button
          onClick={anterior}
          disabled={esPrimera}
          title="Anterior (←)"
          style={{
            position: 'fixed', left: '14px', top: '50%', transform: 'translateY(-50%)',
            width: '48px', height: '48px', borderRadius: '50%', zIndex: 2001,
            backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)',
            color: esPrimera ? 'var(--text-muted)' : 'var(--primary)',
            cursor: esPrimera ? 'not-allowed' : 'pointer', opacity: esPrimera ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
          }}
        >
          <ChevronLeft size={26} />
        </button>
        <button
          onClick={siguiente}
          disabled={esUltima}
          title="Siguiente (→)"
          style={{
            position: 'fixed', right: '14px', top: '50%', transform: 'translateY(-50%)',
            width: '48px', height: '48px', borderRadius: '50%', zIndex: 2001,
            backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)',
            color: esUltima ? 'var(--text-muted)' : 'var(--primary)',
            cursor: esUltima ? 'not-allowed' : 'pointer', opacity: esUltima ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
          }}
        >
          <ChevronRight size={26} />
        </button>

        {/* BARRA INFERIOR: avanzar, retroceder y salto directo */}
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2001,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
          padding: '0.7rem 1.25rem', backgroundColor: 'var(--bg-panel)',
          borderTop: '1px solid var(--border)', flexWrap: 'wrap'
        }}>
          <button className="btn btn-outline" onClick={anterior} disabled={esPrimera} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: esPrimera ? 0.45 : 1 }}>
            <ChevronLeft size={16} /> Anterior
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {diapositivas.map((d, i) => (
              <button
                key={`${d.tipo}-${d.tipo === 'vista' ? d.vista : ''}-${i}`}
                onClick={() => setIndice(i)}
                title={tituloDiapositiva(d)}
                style={{
                  width: i === indice ? '26px' : '10px', height: '10px', borderRadius: '999px',
                  border: 'none', cursor: 'pointer', padding: 0,
                  backgroundColor: i === indice ? 'var(--primary)' : 'var(--border)',
                  transition: 'width 0.2s'
                }}
              />
            ))}
          </div>

          <button className="btn btn-primary" onClick={siguiente} disabled={esUltima} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: esUltima ? 0.45 : 1 }}>
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Bloque de edición de una diapositiva de texto (portada o cierre)
  const editorTexto = (
    titulo: string,
    valor: DiapositivaTexto,
    asignar: (v: DiapositivaTexto) => void,
    ayuda: string
  ) => {
    const cambiar = (campo: keyof DiapositivaTexto, dato: string | boolean) =>
      asignar({ ...valor, [campo]: dato });

    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div
          onClick={() => cambiar('activa', !valor.activa)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'pointer',
            padding: '0.7rem 1rem', backgroundColor: 'var(--bg-highlight)'
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
            backgroundColor: valor.activa ? 'var(--primary)' : 'transparent',
            border: `2px solid ${valor.activa ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
          }}>
            {valor.activa && <Check size={13} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{titulo}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ayuda}</div>
          </div>
        </div>

        {valor.activa && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Título</label>
              <input
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={valor.titulo}
                onChange={e => cambiar('titulo', e.target.value)}
                placeholder={titulo === 'Portada' ? "Ej: Presentación de KPI's" : 'Ej: Gracias'}
              />
            </div>
            <div
              onClick={() => cambiar('mostrarPeriodo', !valor.mostrarPeriodo)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                backgroundColor: valor.mostrarPeriodo ? 'var(--primary)' : 'transparent',
                border: `2px solid ${valor.mostrarPeriodo ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
              }}>
                {valor.mostrarPeriodo && <Check size={12} />}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                Mostrar el periodo <small style={{ color: 'var(--text-muted)' }}>(taller · mes · año del filtro)</small>
              </span>
            </div>

            <div
              onClick={() => cambiar('mostrarFecha', !valor.mostrarFecha)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                backgroundColor: valor.mostrarFecha ? 'var(--primary)' : 'transparent',
                border: `2px solid ${valor.mostrarFecha ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
              }}>
                {valor.mostrarFecha && <Check size={12} />}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                Mostrar la fecha del día <small style={{ color: 'var(--text-muted)' }}>(se calcula al presentar)</small>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =====================================================================
  //  LISTA DE PRESENTACIONES
  // =====================================================================
  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <MonitorPlay size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{t('vista.presentacion', 'Presentación')}</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Arma una secuencia de módulos y recórrela como diapositivas
            </p>
          </div>
        </div>
        {puedoEditar && (
          <button className="btn btn-primary" onClick={abrirNueva} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Nueva Presentación
          </button>
        )}
      </div>

      {/* AYUDA */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
        padding: '0.85rem 1.1rem', borderRadius: '10px', marginTop: '1.25rem',
        backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)', borderLeft: '4px solid var(--primary)'
      }}>
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Durante la presentación cada módulo se muestra completo y con datos en vivo. Avanza con el botón
          <strong style={{ color: 'var(--text-main)' }}> Siguiente</strong> o con las flechas
          <strong style={{ color: 'var(--text-main)' }}> ← →</strong> del teclado, y sal con
          <strong style={{ color: 'var(--text-main)' }}> Esc</strong>.
        </span>
      </div>

      {/* CONTENIDO: panel lateral de carpetas + lista de presentaciones */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginTop: '1.5rem' }}>

        {/* ---------- PANEL LATERAL DE CARPETAS ---------- */}
        <div
          className="card"
          style={{
            margin: 0, flexShrink: 0, alignSelf: 'stretch',
            width: panelAbierto ? '270px' : '58px',
            padding: panelAbierto ? '1rem' : '0.75rem 0.5rem',
            transition: 'width 0.18s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: panelAbierto ? 'space-between' : 'center', gap: '0.5rem', marginBottom: panelAbierto ? '0.85rem' : 0 }}>
            {panelAbierto && (
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                <Folder size={16} color="var(--primary)" /> Carpetas
              </strong>
            )}
            <button
              onClick={() => setPanelAbierto(a => !a)}
              className="btn btn-outline"
              style={{ padding: '0.3rem', color: 'var(--text-muted)' }}
              title={panelAbierto ? 'Contraer carpetas' : 'Desplegar carpetas'}
            >
              {panelAbierto ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {panelAbierto && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {/* Raíz: todas las presentaciones */}
              {/* Raíz: todas las presentaciones */}
              <button
                onClick={() => { setSelAno(null); setSelMes(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                  background: !selAno ? 'var(--bg-highlight)' : 'none', border: 'none',
                  borderRadius: '6px', padding: '0.45rem 0.5rem', cursor: 'pointer',
                  color: !selAno ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: !selAno ? 700 : 500, fontSize: '0.83rem', textAlign: 'left'
                }}
              >
                <MonitorPlay size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                Todas
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{presentacionesOrdenadas.length}</span>
              </button>

              {arbol.map(nodoAno => {
                const claveAno = `ano:${nodoAno.ano}`;
                const anoDesplegado = ramasAbiertas.includes(claveAno);
                const anoActivo = selAno === nodoAno.ano && !selMes;
                return (
                  <div key={claveAno}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                      <button
                        onClick={() => alternarRama(claveAno)}
                        style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
                        title={anoDesplegado ? 'Contraer' : 'Desplegar'}
                      >
                        {anoDesplegado ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <button
                        onClick={() => { setSelAno(nodoAno.ano); setSelMes(null); alternarRama(claveAno); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0,
                          background: anoActivo ? 'var(--bg-highlight)' : 'none', border: 'none',
                          borderRadius: '6px', padding: '0.4rem 0.45rem', cursor: 'pointer',
                          color: anoActivo ? 'var(--text-main)' : 'var(--text-muted)',
                          fontWeight: anoActivo ? 700 : 600, fontSize: '0.83rem', textAlign: 'left'
                        }}
                      >
                        <Folder size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodoAno.ano}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{nodoAno.total}</span>
                      </button>
                    </div>

                    {anoDesplegado && nodoAno.meses.map(nodoMes => {
                      const mesActivo = selAno === nodoAno.ano && selMes === nodoMes.mes;
                      return (
                        <button
                          key={`mes:${claveAno}:${nodoMes.mes}`}
                          onClick={() => { setSelAno(nodoAno.ano); setSelMes(nodoMes.mes); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem', width: 'calc(100% - 1.5rem)',
                            marginLeft: '1.5rem',
                            background: mesActivo ? 'rgba(29,140,248,0.15)' : 'none', border: 'none',
                            borderRadius: '6px', padding: '0.35rem 0.45rem', cursor: 'pointer',
                            color: mesActivo ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: mesActivo ? 700 : 500, fontSize: '0.8rem', textAlign: 'left'
                          }}
                        >
                          <CalendarRange size={13} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodoMes.mes}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>{nodoMes.total}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------- LISTA DE PRESENTACIONES ---------- */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>{rutaCarpeta}</h3>
            {puedoEditar && listaCarpeta.length > 1 && (
              <small style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <GripVertical size={13} /> Arrastra una tarjeta para cambiar el orden
              </small>
            )}
          </div>

          {listaCarpeta.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', margin: 0 }}>
              <MonitorPlay size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                {presentacionesOrdenadas.length === 0 ? 'Aún no hay presentaciones' : 'Esta carpeta está vacía'}
              </h3>
              <p style={{ color: 'var(--text-muted)' }}>
                {puedoEditar ? 'Crea una con "Nueva Presentación" y elige los módulos que quieres mostrar.' : 'Pide a un administrador que arme una presentación.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {listaCarpeta.map(p => {
                const visibles = p.vistas.filter(v => COMPONENTES[v] && puedeVer(v));
                const totalDiapositivas = armarDiapositivas(p).length;
                const tienePortada = normalizarTexto(p.portada).activa;
                const tieneCierre = normalizarTexto(p.cierre).activa;
                const esDestino = sobreId === p.id && arrastrandoId !== p.id;
                const tallerCard = datosTaller(p.taller);
                return (
                  <div
                    key={p.id}
                    className="card"
                    draggable={puedoEditar}
                    onDragStart={() => setArrastrandoId(p.id)}
                    onDragOver={e => { e.preventDefault(); if (sobreId !== p.id) setSobreId(p.id); }}
                    onDragLeave={() => setSobreId(actual => (actual === p.id ? null : actual))}
                    onDrop={() => soltarPresentacion(p.id)}
                    onDragEnd={() => { setArrastrandoId(null); setSobreId(null); }}
                    style={{
                      margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem',
                      opacity: arrastrandoId === p.id ? 0.45 : 1,
                      border: esDestino ? '2px dashed var(--primary)' : '1px solid var(--border)',
                      borderLeft: `5px solid ${tallerCard.color}`,
                      cursor: puedoEditar ? 'grab' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', minWidth: 0 }}>
                        {puedoEditar && <GripVertical size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                        {/* Logo del taller, tomado del módulo Talleres */}
                        {tallerCard.logo ? (
                          <div style={{
                            width: '46px', height: '46px', borderRadius: '10px', flexShrink: 0,
                            backgroundColor: '#ffffff', border: `2px solid ${tallerCard.color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                          }}>
                            <img src={tallerCard.logo} alt={tallerCard.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          </div>
                        ) : (
                          <div style={{
                            width: '46px', height: '46px', borderRadius: '10px', flexShrink: 0,
                            backgroundColor: tallerCard.color, display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Store size={20} color="#ffffff" />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, color: tallerCard.color, fontSize: '0.95rem', lineHeight: 1.2 }}>
                            {tallerCard.nombre || 'Sin taller'}
                          </h3>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>{p.nombre}</div>
                          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {p.descripcion || `${totalDiapositivas} ${totalDiapositivas === 1 ? 'diapositiva' : 'diapositivas'}`}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)',
                        border: '1px solid var(--primary)', borderRadius: '999px',
                        padding: '0.15rem 0.6rem', whiteSpace: 'nowrap', flexShrink: 0
                      }}>
                        {totalDiapositivas}
                      </span>
                    </div>

                    {/* Recorrido de la presentación */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {tienePortada && (
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)',
                          backgroundColor: 'rgba(29,140,248,0.12)', border: '1px solid var(--primary)',
                          borderRadius: '6px', padding: '0.2rem 0.5rem'
                        }}>
                          Portada
                        </span>
                      )}
                      {visibles.slice(0, 6).map((v, i) => (
                        <span key={`${v}-${i}`} style={{
                          fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)',
                          borderRadius: '6px', padding: '0.2rem 0.5rem'
                        }}>
                          {i + 1}. {etiquetaVista(v)}
                        </span>
                      ))}
                      {visibles.length > 6 && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)', padding: '0.2rem 0.3rem' }}>
                          +{visibles.length - 6} más
                        </span>
                      )}
                      {tieneCierre && (
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)',
                          backgroundColor: 'rgba(29,140,248,0.12)', border: '1px solid var(--primary)',
                          borderRadius: '6px', padding: '0.2rem 0.5rem'
                        }}>
                          Conclusión
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" onClick={() => presentar(p)} disabled={totalDiapositivas === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: totalDiapositivas === 0 ? 0.5 : 1 }}>
                        <Play size={16} /> Presentar
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => abrirEditar(p)}
                        disabled={!puedoEditar}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', opacity: puedoEditar ? 1 : 0.4, cursor: puedoEditar ? 'pointer' : 'not-allowed' }}
                        title={puedoEditar ? 'Editar presentación' : 'Tu rol solo puede consultar'}
                      >
                        <Pencil size={15} /> Editar
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => eliminar(p)}
                        disabled={!puedoEliminar}
                        style={{ padding: '0.5rem 0.7rem', color: 'var(--danger)', opacity: puedoEliminar ? 1 : 0.4, cursor: puedoEliminar ? 'pointer' : 'not-allowed' }}
                        title={puedoEliminar ? 'Eliminar presentación' : 'Tu rol no puede eliminar'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================== EDITOR ===================== */}
      {modalAbierto && (
        <div
          onClick={() => setModalAbierto(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3vh 1rem', overflowY: 'auto' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="animate-in fade-in"
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '1240px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MonitorPlay size={22} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                    {editandoId ? 'Editar Presentación' : 'Nueva Presentación'}
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Elige los módulos y ordénalos como quieras mostrarlos
                  </p>
                </div>
              </div>
              <button onClick={() => setModalAbierto(false)} className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--text-muted)' }} title="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* NOMBRE: se arma solo con el año, el taller y el mes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                  <label className="form-label">Nombre <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(año · taller · mes)</small></label>
                  <div
                    className="form-control"
                    style={{
                      width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-highlight)',
                      color: nombre ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 700,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}
                    title={nombre}
                  >
                    {nombre || 'Elige el año, el taller y el mes'}
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                  <label className="form-label">Descripción <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
                  <input
                    className="form-control"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Para qué sirve esta presentación"
                  />
                </div>
              </div>

              {/* TRES COLUMNAS: filtro y textos · módulos · orden */}
              <div className="pres-editor">
              <div>
              {/* FILTRO INICIAL: manda sobre todas las diapositivas y ordena la carpeta */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', backgroundColor: 'var(--bg-highlight)' }}>
                  <Filter size={16} color="var(--primary)" />
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>Filtro de la presentación</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Todas las diapositivas abren con este taller, mes y año. También define la carpeta donde se guarda.
                    </div>
                  </div>
                </div>
                <div style={{ padding: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Año</label>
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      value={filtroAno}
                      onChange={e => setFiltroAno(e.target.value)}
                      placeholder="2026"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Taller</label>
                    <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={filtroTaller} onChange={e => setFiltroTaller(e.target.value)}>
                      <option value="">Todos los talleres</option>
                      {talleres.map(tl => <option key={tl.id} value={tl.nombre}>{tl.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Mes</label>
                    <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                      <option value="">Todo el año</option>
                      {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Semanas</label>
                    <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={filtroSemanas} onChange={e => setFiltroSemanas(e.target.value)}>
                      <option value="">Sin definir</option>
                      <option value="4">Meses de 4 semanas</option>
                      <option value="5">Meses de 5 semanas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* PORTADA Y CONCLUSIÓN, debajo del filtro */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.9rem' }}>
                {editorTexto('Portada', portada, setPortada, 'Abre la exposición. Escribe {mes}, {año} o {taller} y se sustituyen solos')}
                {editorTexto('Conclusión', cierre, setCierre, 'Cierra la exposición después del último módulo')}
              </div>
              </div>

                {/* MÓDULOS DISPONIBLES */}
                <div>
                  <h4 className="detail-section-title" style={{ marginTop: 0 }}>Módulos disponibles</h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', maxHeight: '46vh', overflowY: 'auto' }}>
                    {disponiblesPorGrupo.map(g => (
                      <div key={g.id}>
                        <div style={{ padding: '0.55rem 1rem', backgroundColor: 'var(--bg-highlight)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {t(g.claveEtiqueta, g.etiqueta)}
                        </div>
                        {g.items.map(i => {
                          const incluida = vistas.includes(i.vista);
                          return (
                            <div
                              key={i.vista}
                              onClick={() => alternarVista(i.vista)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
                            >
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                                backgroundColor: incluida ? 'var(--primary)' : 'transparent',
                                border: `2px solid ${incluida ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
                              }}>
                                {incluida && <Check size={13} />}
                              </span>
                              <span style={{ fontSize: '0.85rem', color: incluida ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: incluida ? 600 : 400 }}>
                                {t(i.claveEtiqueta, i.etiqueta)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ORDEN DE LAS DIAPOSITIVAS */}
                <div>
                  <h4 className="detail-section-title" style={{ marginTop: 0 }}>
                    Orden de las diapositivas {vistas.length > 0 && <span style={{ color: 'var(--primary)' }}>({vistas.length})</span>}
                  </h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', maxHeight: '46vh', overflowY: 'auto' }}>
                    {vistas.length === 0 ? (
                      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Marca módulos a la izquierda para agregarlos.
                      </div>
                    ) : (
                      vistas.map((v, i) => (
                        <div
                          key={`${v}-${i}`}
                          draggable
                          onDragStart={() => setArrastrando(i)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => soltarEn(i)}
                          onDragEnd={() => setArrastrando(null)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                            padding: '0.55rem 0.75rem',
                            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                            backgroundColor: arrastrando === i ? 'var(--bg-highlight)' : 'transparent',
                            cursor: 'grab'
                          }}
                        >
                          <GripVertical size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          <span style={{
                            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                            backgroundColor: 'var(--primary)', color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 800
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {etiquetaVista(v)}
                            <small style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{grupoDeVista(v)}</small>
                          </span>
                          <button onClick={() => mover(i, i - 1)} disabled={i === 0} className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--text-muted)', opacity: i === 0 ? 0.35 : 1 }} title="Subir">
                            <ArrowUp size={14} />
                          </button>
                          <button onClick={() => mover(i, i + 1)} disabled={i === vistas.length - 1} className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--text-muted)', opacity: i === vistas.length - 1 ? 0.35 : 1 }} title="Bajar">
                            <ArrowDown size={14} />
                          </button>
                          <button onClick={() => alternarVista(v)} className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--danger)' }} title="Quitar de la presentación">
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Arrastra una diapositiva o usa las flechas para cambiar el orden.
                    {(portada.activa || cierre.activa) && ' La portada y el cierre se colocan solos al principio y al final.'}
                  </small>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-outline" onClick={() => setModalAbierto(false)}>
                <X size={16} /> Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando || !puedoEditar} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (guardando || !puedoEditar) ? 0.55 : 1 }}>
                <Save size={16} /> {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Generar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
