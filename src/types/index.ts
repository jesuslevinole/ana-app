export interface Detalle {
  id: string;
  desde: string;
  hasta: string;
  vendido: number;
  porcentajeAporte: number;
}

export interface Registro {
  id: string;
  ano: number;
  mes: string;
  taller: string;
  meta: number;
  logrado: number;
  faltante: number;
  porcentajeCumplido: number;
  detalles: Detalle[];
  semanal?: number;
diario?: number;
}

// NUEVO: Interfaz para el módulo de Talleres
export interface Taller {
  id: string;
  nombre: string;
  logo: string; // Guardaremos la imagen en formato Base64
  direccion?: string; // Añadido para corregir el error de la vista
  orden?: number;     // Añadido para guardar la posición en la tabla
}

// Vistas de la aplicación. El catálogo completo vive en src/config/navegacion.ts;
// aquí se declara como string para admitir vistas nuevas sin romper tipos.
export type VistaApp = string;

// =========================================================================
//  USUARIOS Y ROLES
// =========================================================================
export interface Rol {
  id: string;
  nombre: string;
  descripcion?: string;
  // Vistas a las que el rol tiene acceso: { [vista]: true }
  permisos: Record<string, boolean>;
  // Capacidades especiales del rol: { editarEtiquetas: true, verComo: true }
  acciones?: Record<string, boolean>;
  // Un rol administrador ve todo y puede administrar usuarios, roles y etiquetas
  esAdmin?: boolean;
  // Si es true, el rol no se puede eliminar (roles del sistema)
  protegido?: boolean;
  creadoEn?: string;
}

export interface Usuario {
  id: string;        // uid de Firebase Auth
  nombre: string;
  email: string;
  rolId: string;
  activo: boolean;
  creadoEn?: string;
  ultimoAcceso?: string;
  // Fecha del ultimo envio del correo de acceso (crear/restablecer contrasena)
  accesoEnviadoEn?: string;
}

export interface AppContextType {
  registros: Registro[];
  agregarRegistro: (r: Registro) => void;
  eliminarRegistro: (id: string) => void;
  registroEditando: Registro | null;
  setRegistroEditando: (r: Registro | null) => void;
  
  // NUEVO: Métodos y estado para Talleres
  talleres: Taller[];
  agregarTaller: (t: Taller) => void;
  eliminarTaller: (id: string) => void;

  vista: VistaApp;
  setVista: (v: VistaApp) => void;
}