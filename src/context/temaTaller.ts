import { useEffect } from 'react';

// =========================================================================
//  TEMA VISUAL POR TALLER
//
//  Algunos talleres tienen su propio estilo. Hoy: Pan Mary (panadería) →
//  rosa pastel apagado. Mientras en pantalla esté ese taller, la app
//  COMPLETA (menú, encabezado y módulos) cambia de colores; al cambiar de
//  taller o de página vuelve a su tema normal (claro u oscuro).
//
//  Funciona igual que el modo claro: se pone un atributo en <html>
//  (data-tema="panmary") y los colores viven en index.css bajo
//  :root[data-tema='panmary'].
// =========================================================================

export type TemaVisual = 'panmary';

// Basta con que el nombre del taller diga "Pan Mary"
export const esTallerPanMary = (nombre?: string | null) => /pan\s*mary/i.test(nombre || '');

export const temaDeTaller = (nombre?: string | null): TemaVisual | null =>
  esTallerPanMary(nombre) ? 'panmary' : null;

// Varias pantallas pueden pedir el tema a la vez (p. ej. una presentación y
// su diapositiva): se lleva la cuenta para no apagarlo antes de tiempo.
const solicitudes = new Map<symbol, TemaVisual>();

const aplicar = () => {
  const ultimo = Array.from(solicitudes.values()).pop();
  if (ultimo) document.documentElement.setAttribute('data-tema', ultimo);
  else document.documentElement.removeAttribute('data-tema');
};

// Activa el tema del taller mientras el componente que lo llama esté en pantalla
export const useTemaTaller = (taller?: string | null) => {
  const tema = temaDeTaller(taller);
  useEffect(() => {
    if (!tema) return;
    const id = Symbol('tema-taller');
    solicitudes.set(id, tema);
    aplicar();
    return () => {
      solicitudes.delete(id);
      aplicar();
    };
  }, [tema]);
};
