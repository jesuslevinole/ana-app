import { createContext, useContext } from 'react';
import { MESES } from '../utils/formatters';

// =========================================================================
//  FILTRO DE PRESENTACIÓN
//
//  Cuando se reproduce una presentación, todos los módulos que aparecen como
//  diapositiva arrancan ya filtrados por el mismo taller, año, mes y número de
//  semanas. Así no hay que ir seleccionando filtros delante de la gerencia.
//
//  Cada módulo lee este filtro UNA VEZ, al montarse, para inicializar sus
//  propios controles. Durante la presentación se pueden seguir cambiando a
//  mano si surge una pregunta.
// =========================================================================

export interface FiltroPresentacion {
  taller?: string;    // nombre del taller
  ano?: string;       // año en texto, ej. '2026'
  mes?: string;       // nombre del mes tal como aparece en MESES
  semanas?: string;   // '4' o '5' (meses de 4 o 5 semanas)
}

export const ContextoFiltroPresentacion = createContext<FiltroPresentacion | null>(null);

// Devuelve el filtro activo, o null si no se está presentando
export const useFiltroPresentacion = () => useContext(ContextoFiltroPresentacion);

// --- Ayudas para inicializar los filtros de cada módulo ---

// Valor del filtro o el que trae el módulo por defecto
export const oPorDefecto = (valor: string | undefined, defecto: string): string =>
  valor && valor.trim() ? valor : defecto;

// Mes anterior a uno dado, con su año (para las vistas comparativas, que
// muestran "mes previo contra mes elegido")
export const mesAnterior = (mes: string, ano: string): { mes: string; ano: string } => {
  const idx = MESES.indexOf(mes);
  const anoNum = parseInt(ano, 10);
  if (idx < 0 || isNaN(anoNum)) return { mes, ano };
  if (idx === 0) return { mes: MESES[MESES.length - 1], ano: String(anoNum - 1) };
  return { mes: MESES[idx - 1], ano };
};
