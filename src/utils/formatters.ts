export const formatearFecha = (fecha: string) => {
  return new Date(fecha).toLocaleDateString('es-ES', { timeZone: 'UTC' });
};

export const formatearMoneda = (monto: number) => {
  return `$${monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
};

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];