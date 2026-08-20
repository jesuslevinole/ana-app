import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  PRESENTACIONES
//
//  Una presentación es una lista ORDENADA de vistas de la aplicación. Al
//  reproducirla, cada vista se muestra a pantalla completa como si fuera una
//  diapositiva y se avanza con los botones o con las flechas del teclado.
//
//  Se guardan en Firestore (colección "presentaciones") para que todos los
//  usuarios vean las mismas presentaciones armadas por la gerencia.
// =========================================================================

// Diapositiva de texto: se usa para la PORTADA y para el CIERRE. No muestra
// datos, solo el mensaje con el que abre y cierra la exposición.
export interface DiapositivaTexto {
  activa: boolean;
  titulo: string;
  subtitulo?: string;
  puntos?: string[];        // viñetas (ideal para la conclusión)
  pie?: string;
  mostrarFecha?: boolean;   // imprime la fecha del día en que se presenta
  mostrarPeriodo?: boolean; // imprime el taller / mes / año del filtro
  taller?: string;          // nombre del taller cuyo logo y color se muestran
}

export const DIAPOSITIVA_VACIA: DiapositivaTexto = {
  activa: false,
  titulo: '',
  subtitulo: '',
  puntos: [],
  pie: '',
  mostrarFecha: true,
  mostrarPeriodo: true,
  taller: '',
};

export interface Presentacion {
  id: string;
  nombre: string;
  descripcion?: string;
  vistas: string[];        // orden de las diapositivas (claves de vista)
  // FILTRO INICIAL: se aplica a TODAS las diapositivas al reproducir y además
  // define la carpeta (Año → Taller → Mes) donde se guarda la presentación.
  ano?: string;
  taller?: string;
  mes?: string;
  semanas?: string;        // '4' o '5'
  orden?: number;          // posición dentro de su carpeta (arrastrar y soltar)
  portada?: DiapositivaTexto;
  cierre?: DiapositivaTexto;
  creadoEn?: string;
  actualizadoEn?: string;
}

// Etiquetas de las carpetas cuando la presentación no tiene clasificación
export const SIN_ANO = 'Sin año';
export const SIN_TALLER = 'Sin taller';
export const SIN_MES = 'Sin mes';

// Normaliza lo que viene de Firestore para que nunca falte un campo
export const normalizarTexto = (bruto?: Partial<DiapositivaTexto>): DiapositivaTexto => ({
  activa: !!bruto?.activa,
  titulo: bruto?.titulo || '',
  subtitulo: bruto?.subtitulo || '',
  puntos: Array.isArray(bruto?.puntos) ? bruto.puntos.filter(x => typeof x === 'string') : [],
  pie: bruto?.pie || '',
  mostrarFecha: bruto?.mostrarFecha !== false,
  mostrarPeriodo: bruto?.mostrarPeriodo !== false,
  taller: bruto?.taller || '',
});

// Id legible a partir del nombre (mismo criterio que Roles)
export const idDesdeNombre = (nombre: string) =>
  nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `presentacion-${Date.now()}`;

export const usePresentaciones = () => {
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'presentaciones'),
      (snapshot) => {
        const data = snapshot.docs.map(d => {
          const bruto = d.data() as Partial<Presentacion>;
          return {
            ...bruto,
            id: d.id,
            nombre: bruto.nombre || d.id,
            vistas: Array.isArray(bruto.vistas) ? bruto.vistas : [],
            ano: bruto.ano || '',
            taller: bruto.taller || '',
            mes: bruto.mes || '',
            semanas: bruto.semanas || '',
            orden: typeof bruto.orden === 'number' ? bruto.orden : 0,
            portada: normalizarTexto(bruto.portada),
            cierre: normalizarTexto(bruto.cierre),
          } as Presentacion;
        });
        setPresentaciones(data);
        setCargando(false);
      },
      (error) => {
        console.error("🔥 Error al leer 'presentaciones' de Firebase:", error);
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  const guardarPresentacion = async (p: Presentacion) => {
    try {
      await setDoc(doc(db, 'presentaciones', p.id), {
        nombre: p.nombre,
        descripcion: p.descripcion || '',
        vistas: p.vistas,
        ano: p.ano || '',
        taller: p.taller || '',
        mes: p.mes || '',
        semanas: p.semanas || '',
        orden: typeof p.orden === 'number' ? p.orden : 0,
        portada: normalizarTexto(p.portada),
        cierre: normalizarTexto(p.cierre),
        creadoEn: p.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Error al guardar la presentación:', error);
      alert('No se pudo guardar la presentación. Revisa la consola.');
    }
  };

  // Guarda de una sola vez el nuevo orden de una carpeta. Se usa al soltar
  // una presentación arrastrada: cada id recibe su posición en la lista.
  const guardarOrden = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id, i) => setDoc(doc(db, 'presentaciones', id), { orden: (i + 1) * 10 }, { merge: true }))
      );
    } catch (error) {
      console.error('Error al guardar el orden de las presentaciones:', error);
      alert('No se pudo guardar el nuevo orden. Revisa la consola.');
    }
  };

  const eliminarPresentacion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'presentaciones', id));
    } catch (error) {
      console.error('Error al eliminar la presentación:', error);
    }
  };

  return { presentaciones, cargando, guardarPresentacion, guardarOrden, eliminarPresentacion };
};
