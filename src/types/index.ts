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
}

// NUEVO: Interfaz para el módulo de Talleres
export interface Taller {
  id: string;
  nombre: string;
  logo: string; // Guardaremos la imagen en formato Base64
  direccion?: string; // Añadido para corregir el error de la vista
  orden?: number;     // Añadido para guardar la posición en la tabla
}

// Añadida la vista 'talleres'
export type VistaApp = 'dashboard' | 'tabla' | 'formulario' | 'comparacion' | 'talleres';

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