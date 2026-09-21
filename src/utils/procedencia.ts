import type { RegistroMarketing } from '../hooks/useMarketing';

// ¿Hay algo que mostrar con estos filtros?
export const hayDatosProcedencia = (
  registros: RegistroMarketing[], taller: string, ano: string, mes: string
): boolean => registros.some(r =>
  String(r.ano) === ano &&
  (taller === 'Todos' || r.taller === taller) &&
  (mes === 'Todos' || r.mes === mes)
);
