import { useState, useContext, useEffect, Fragment, type ReactNode } from 'react';
import { AppContext } from '../../context/AppContext';
import {
  Calendar, PieChart, FileText, Menu, ChevronLeft, ChevronRight,
  GitCompare, Store, ChevronDown, Wrench, ClipboardCheck, Megaphone, Clock,
  ClipboardList, LineChart, Sun, Moon
} from 'lucide-react';

type ItemNav = {
  vista: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  extra?: string[];     // otras vistas que también marcan este item como activo
  disabled?: boolean;
};

type GrupoNav = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  items: ItemNav[];
};

// Clave de almacenamiento del tema elegido (claro / oscuro)
const STORAGE_TEMA = 'app_tema_v1';

// =========================================================================
//  ESTRUCTURA DE MENÚS Y SUBMENÚS
//  Para agregar items a Inspecciones / Marketing, añade objetos a "items"
//  (y registra esa vista en App.tsx).
// =========================================================================
const GRUPOS: GrupoNav[] = [
  {
    id: 'taller',
    label: 'Taller',
    icon: Wrench,
    items: [
      { vista: 'tabla', label: 'Registros', icon: FileText, extra: ['formulario'] },
      { vista: 'dashboard', label: 'Dashboard', icon: PieChart },
      { vista: 'comparacion', label: 'Comparación', icon: GitCompare },
      { vista: 'talleres', label: 'Talleres', icon: Store },
    ],
  },
  {
    id: 'inspecciones',
    label: 'Inspecciones',
    icon: ClipboardCheck,
    items: [
      { vista: 'inspeccionesRegistro', label: 'Registro', icon: ClipboardList },
      { vista: 'inspeccionesDashboard', label: 'Dashboard', icon: LineChart },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      // TODO: reemplazar por los items reales cuando definas el contenido
      { vista: 'marketing', label: 'Próximamente', icon: Clock, disabled: true },
    ],
  },
];

export const Layout = ({ children }: { children: ReactNode }) => {
  const contexto = useContext(AppContext);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // --- NUEVO: TEMA CLARO / OSCURO (persistente) ---
  const [tema, setTema] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem(STORAGE_TEMA) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });

  // Aplica el tema al documento y lo guarda
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(STORAGE_TEMA, tema); } catch { /* almacenamiento no disponible */ }
  }, [tema]);

  const alternarTema = () => setTema(t => (t === 'dark' ? 'light' : 'dark'));

  // Leemos la vista como string para poder comparar con las vistas nuevas
  const vistaActual = (contexto?.vista as string) ?? '';

  const grupoDeVista = (v: string) =>
    GRUPOS.find(g => g.items.some(i => i.vista === v || i.extra?.includes(v)))?.id;

  const [abierto, setAbierto] = useState<string | null>(grupoDeVista(vistaActual) ?? 'taller');

  // Abrir automáticamente el grupo de la vista activa cuando cambie
  useEffect(() => {
    const g = grupoDeVista(vistaActual);
    if (g) setAbierto(g);
  }, [vistaActual]);

  if (!contexto) return null;

  // Navegación segura: setVista espera VistaApp; casteamos para admitir vistas nuevas.
  const ir = (vista: string) => {
    (contexto.setVista as (v: any) => void)(vista);
    setMenuAbierto(false);
  };

  const itemActivo = (item: ItemNav) =>
    vistaActual === item.vista || (item.extra?.includes(vistaActual) ?? false);

  return (
    <div className="app-layout">
      {menuAbierto && <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} className="md-hidden" onClick={() => setMenuAbierto(false)} />}

      <aside className={`sidebar ${menuAbierto ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box"><Calendar size={20} /></div>
          <h2>Sistema Metas</h2>
        </div>

        <ul className="nav-menu">
          {GRUPOS.map(grupo => {
            const Icono = grupo.icon;
            const grupoActivo = grupo.items.some(itemActivo);
            const estaAbierto = abierto === grupo.id;
            // En modo colapsado mostramos siempre los items (solo iconos) para que sigan siendo accesibles
            const mostrarItems = estaAbierto || sidebarCollapsed;

            return (
              <Fragment key={grupo.id}>
                {/* ENCABEZADO DEL GRUPO (PADRE) */}
                <li
                  className={`nav-item ${grupoActivo ? 'active' : ''}`}
                  onClick={() => setAbierto(estaAbierto ? null : grupo.id)}
                  title={grupo.label}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? 0 : '0.75rem', justifyContent: 'center' }}>
                    <Icono size={18} /><span>{grupo.label}</span>
                  </span>
                  {!sidebarCollapsed && (
                    <ChevronDown
                      size={16}
                      style={{ transform: estaAbierto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s', flexShrink: 0 }}
                    />
                  )}
                </li>

                {/* SUBMENÚ (HIJOS) */}
                <div style={{ overflow: 'hidden', maxHeight: mostrarItems ? `${grupo.items.length * 52 + 8}px` : '0px', transition: 'max-height 0.3s ease' }}>
                  {grupo.items.map(item => {
                    const ItemIcono = item.icon;
                    const activo = itemActivo(item) && !item.disabled;
                    return (
                      <li
                        key={`${grupo.id}-${item.vista}-${item.label}`}
                        className={`nav-item ${activo ? 'active' : ''}`}
                        title={item.label}
                        onClick={() => { if (!item.disabled) ir(item.vista); }}
                        style={{
                          paddingLeft: sidebarCollapsed ? undefined : '2.5rem',
                          justifyContent: sidebarCollapsed ? 'center' : undefined,
                          opacity: item.disabled ? 0.5 : 1,
                          cursor: item.disabled ? 'default' : 'pointer',
                          fontStyle: item.disabled ? 'italic' : 'normal',
                        }}
                      >
                        <ItemIcono size={16} /><span>{item.label}</span>
                      </li>
                    );
                  })}
                </div>
              </Fragment>
            );
          })}
        </ul>

        {/* NUEVO: BOTÓN DE TEMA CLARO / OSCURO */}
        <button
          className="sidebar-toggle-btn"
          style={{ marginTop: 'auto', borderTop: '1px solid var(--border)' }}
          onClick={alternarTema}
          title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          {!sidebarCollapsed && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </span>
          )}
        </button>

        <button className="sidebar-toggle-btn" style={{ marginTop: 0 }} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Expandir" : "Colapsar"}>
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </aside>

      <main className="main-content">
        <header style={{ padding: '1rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'none' }} className="md-block">
          <button className="btn btn-outline" style={{padding: '0.4rem'}} onClick={() => setMenuAbierto(!menuAbierto)}><Menu size={24}/></button>
        </header>
        <div className="content-area">{children}</div>
      </main>
    </div>
  );
};