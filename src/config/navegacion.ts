// =========================================================================
//  CATÁLOGO CENTRAL DE NAVEGACIÓN Y ETIQUETAS
//
//  Este archivo es la única fuente de verdad de:
//    · Qué grupos y vistas existen en la app
//    · El nombre POR DEFECTO de cada uno
//
//  El menú lateral, la matriz de permisos de Roles y la pantalla de
//  Personalización leen de aquí, así que agregar una vista nueva en este
//  archivo la habilita automáticamente en los tres lugares.
//
//  El administrador puede renombrar cualquier etiqueta desde
//  "Personalización"; esos cambios se guardan en Firestore
//  (config/etiquetas) y se comparten con todos los usuarios.
// =========================================================================

export type ClaveGrupo = 'taller' | 'inspecciones' | 'reportes' | 'marketing' | 'administracion';

export interface VistaCatalogo {
  vista: string;          // identificador interno (no cambia nunca)
  claveEtiqueta: string;  // clave para renombrar la etiqueta
  etiqueta: string;       // nombre por defecto
  icono: string;          // nombre del icono de lucide-react
  extra?: string[];       // otras vistas que marcan este item como activo
  soloAdmin?: boolean;    // visible únicamente para administradores
}

export interface GrupoCatalogo {
  id: ClaveGrupo;
  claveEtiqueta: string;
  etiqueta: string;
  icono: string;
  items: VistaCatalogo[];
}

export const CATALOGO_NAVEGACION: GrupoCatalogo[] = [
  {
    id: 'taller',
    claveEtiqueta: 'grupo.taller',
    etiqueta: 'Taller',
    icono: 'Wrench',
    items: [
      { vista: 'tabla', claveEtiqueta: 'vista.tabla', etiqueta: 'Registros', icono: 'FileText', extra: ['formulario'] },
      { vista: 'dashboard', claveEtiqueta: 'vista.dashboard', etiqueta: 'Dashboard', icono: 'PieChart' },
      { vista: 'comparacion', claveEtiqueta: 'vista.comparacion', etiqueta: 'Comparación', icono: 'GitCompare' },
      { vista: 'comparacionMeses', claveEtiqueta: 'vista.comparacionMeses', etiqueta: 'Comparación de Meses', icono: 'CalendarRange' },
      { vista: 'talleres', claveEtiqueta: 'vista.talleres', etiqueta: 'Talleres', icono: 'Store' },
    ],
  },
  {
    id: 'inspecciones',
    claveEtiqueta: 'grupo.inspecciones',
    etiqueta: 'Inspecciones',
    icono: 'ClipboardCheck',
    items: [
      { vista: 'inspeccionesRegistro', claveEtiqueta: 'vista.inspeccionesRegistro', etiqueta: 'Registro', icono: 'ClipboardList' },
      { vista: 'inspeccionesDashboard', claveEtiqueta: 'vista.inspeccionesDashboard', etiqueta: 'Dashboard', icono: 'LineChart' },
      { vista: 'inspeccionesComparacion', claveEtiqueta: 'vista.inspeccionesComparacion', etiqueta: 'Comparación', icono: 'GitCompare' },
      { vista: 'inspeccionesComparacionMeses', claveEtiqueta: 'vista.inspeccionesComparacionMeses', etiqueta: 'Comparación de Meses', icono: 'CalendarRange' },
    ],
  },
  {
    id: 'reportes',
    claveEtiqueta: 'grupo.reportes',
    etiqueta: 'Reportes',
    icono: 'FileBarChart',
    items: [
      { vista: 'reporteAnualGeneral', claveEtiqueta: 'vista.reporteAnualGeneral', etiqueta: 'Reporte Anual General', icono: 'FileBarChart' },
      { vista: 'reporteAnualInspecciones', claveEtiqueta: 'vista.reporteAnualInspecciones', etiqueta: 'Reporte Anual Inspecciones', icono: 'ClipboardCheck' },
    ],
  },
  {
    id: 'marketing',
    claveEtiqueta: 'grupo.marketing',
    etiqueta: 'Marketing',
    icono: 'Megaphone',
    items: [
      { vista: 'marketing', claveEtiqueta: 'vista.marketing', etiqueta: 'Próximamente', icono: 'Clock' },
    ],
  },
  {
    id: 'administracion',
    claveEtiqueta: 'grupo.administracion',
    etiqueta: 'Administración',
    icono: 'Settings',
    items: [
      { vista: 'usuarios', claveEtiqueta: 'vista.usuarios', etiqueta: 'Usuarios', icono: 'Users', soloAdmin: true },
      { vista: 'roles', claveEtiqueta: 'vista.roles', etiqueta: 'Roles y Permisos', icono: 'ShieldCheck', soloAdmin: true },
      { vista: 'personalizacion', claveEtiqueta: 'vista.personalizacion', etiqueta: 'Personalización', icono: 'Type', soloAdmin: true },
    ],
  },
];

// Lista plana de todas las vistas (para la matriz de permisos)
export const TODAS_LAS_VISTAS: VistaCatalogo[] = CATALOGO_NAVEGACION.flatMap(g => g.items);

// =========================================================================
//  ETIQUETAS GENERALES DE LA APLICACIÓN
//  Textos que no son del menú pero que el administrador puede renombrar.
// =========================================================================
export interface EtiquetaGeneral {
  clave: string;
  etiqueta: string;
  descripcion: string;
  seccion: string;
}

export const ETIQUETAS_GENERALES: EtiquetaGeneral[] = [
  { clave: 'app.nombre', etiqueta: 'Sistema Metas', descripcion: 'Nombre de la aplicación (barra lateral)', seccion: 'General' },
  { clave: 'app.login.titulo', etiqueta: 'Sistema Metas', descripcion: 'Título de la pantalla de acceso', seccion: 'General' },
  { clave: 'app.login.subtitulo', etiqueta: 'Ingresa con tu cuenta para continuar', descripcion: 'Subtítulo de la pantalla de acceso', seccion: 'General' },

  { clave: 'termino.taller', etiqueta: 'Taller', descripcion: 'Cómo se llama cada sucursal o unidad de negocio', seccion: 'Términos del negocio' },
  { clave: 'termino.talleres', etiqueta: 'Talleres', descripcion: 'Plural de la unidad de negocio', seccion: 'Términos del negocio' },
  { clave: 'termino.meta', etiqueta: 'Meta', descripcion: 'Objetivo a alcanzar', seccion: 'Términos del negocio' },
  { clave: 'termino.metaAnual', etiqueta: 'Meta anual', descripcion: 'Objetivo del año', seccion: 'Términos del negocio' },
  { clave: 'termino.logrado', etiqueta: 'Logrado', descripcion: 'Lo alcanzado hasta el momento', seccion: 'Términos del negocio' },
  { clave: 'termino.faltante', etiqueta: 'Faltante', descripcion: 'Lo que resta para llegar a la meta', seccion: 'Términos del negocio' },
  { clave: 'termino.ventas', etiqueta: 'Ventas', descripcion: 'Ingresos registrados', seccion: 'Términos del negocio' },
  { clave: 'termino.inspecciones', etiqueta: 'Inspecciones', descripcion: 'Revisiones realizadas', seccion: 'Términos del negocio' },
  { clave: 'termino.cumplimiento', etiqueta: '% Cumplimiento', descripcion: 'Porcentaje de avance sobre la meta', seccion: 'Términos del negocio' },

  { clave: 'accion.nuevo', etiqueta: 'Nuevo Registro', descripcion: 'Botón para crear un registro', seccion: 'Acciones' },
  { clave: 'accion.guardar', etiqueta: 'Guardar', descripcion: 'Botón de guardado', seccion: 'Acciones' },
  { clave: 'accion.cancelar', etiqueta: 'Cancelar', descripcion: 'Botón de cancelar', seccion: 'Acciones' },
  { clave: 'accion.editar', etiqueta: 'Editar', descripcion: 'Acción de edición', seccion: 'Acciones' },
  { clave: 'accion.eliminar', etiqueta: 'Eliminar', descripcion: 'Acción de borrado', seccion: 'Acciones' },
];

// Todas las claves renombrables, agrupadas para la pantalla de Personalización
export const SECCIONES_ETIQUETAS = () => {
  const secciones: { seccion: string; items: EtiquetaGeneral[] }[] = [];

  // Menú: grupos y vistas
  const itemsMenu: EtiquetaGeneral[] = [];
  CATALOGO_NAVEGACION.forEach(g => {
    itemsMenu.push({
      clave: g.claveEtiqueta,
      etiqueta: g.etiqueta,
      descripcion: 'Grupo del menú lateral',
      seccion: 'Menú',
    });
    g.items.forEach(i => {
      itemsMenu.push({
        clave: i.claveEtiqueta,
        etiqueta: i.etiqueta,
        descripcion: `Vista dentro de "${g.etiqueta}"`,
        seccion: 'Menú',
      });
    });
  });
  secciones.push({ seccion: 'Menú', items: itemsMenu });

  // Etiquetas generales, agrupadas por su propia sección
  const porSeccion = new Map<string, EtiquetaGeneral[]>();
  ETIQUETAS_GENERALES.forEach(e => {
    if (!porSeccion.has(e.seccion)) porSeccion.set(e.seccion, []);
    porSeccion.get(e.seccion)!.push(e);
  });
  porSeccion.forEach((items, seccion) => secciones.push({ seccion, items }));

  return secciones;
};
