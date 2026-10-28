import { useTemaTaller } from '../context/temaTaller';

// Componente invisible: cada página con filtro de taller lo dibuja con el
// taller que está mostrando. Si es un taller con tema propio (Pan Mary), la
// app completa cambia de colores mientras esa página esté en pantalla.
// Es un componente (y no un hook suelto) para poder colocarlo en cualquier
// página sin alterar el orden de sus hooks.
export const TemaTaller = ({ taller }: { taller?: string | null }) => {
  useTemaTaller(taller);
  return null;
};
