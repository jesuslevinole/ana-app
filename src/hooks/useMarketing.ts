import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  MARKETING: ORIGEN DE LOS CLIENTES
//
//  Un documento = el conteo de un taller en un mes/año concreto. Se guarda de
//  dónde llegó cada cliente (recomendación, Google, Facebook, etc.), cuántos
//  no llenaron el formulario y el total del periodo.
//
//  Las cantidades viven dentro de "fuentes" como un mapa { clave: cantidad },
//  de modo que agregar una fuente nueva al catálogo de abajo NO rompe los
//  registros anteriores: los que no la tengan simplemente valen 0.
// =========================================================================

export interface FuenteMarketing {
  clave: string;      // identificador interno (no cambiar una vez usado)
  etiqueta: string;   // nombre completo (formulario y tabla del reporte)
  corta: string;      // nombre corto para el eje de la gráfica
  color: string;      // color de la barra en el dashboard
}

// Catálogo de procedencias. Para agregar una nueva, añade una línea aquí:
// aparecerá automáticamente en el formulario, la tabla y el dashboard.
export const FUENTES_MARKETING: FuenteMarketing[] = [
  { clave: 'clientesRegulares', etiqueta: 'Clientes regulares', corta: 'Regulares', color: '#1d8cf8' },
  { clave: 'recomendadosAmigos', etiqueta: 'Recomendados por amigos o clientes', corta: 'Recom. amigos', color: '#00d6b4' },
  { clave: 'recomendadosTagTitle', etiqueta: 'Recomendados por Tag and Title', corta: 'Tag and Title', color: '#ff8d72' },
  { clave: 'busquedaGoogle', etiqueta: 'Búsqueda en Google o mapa', corta: 'Google / mapa', color: '#d048b6' },
  { clave: 'pasandoSign', etiqueta: 'Pasando y vieron sign / viven cerca', corta: 'Sign / cerca', color: '#ffbc11' },
  { clave: 'facebook', etiqueta: 'Facebook', corta: 'Facebook', color: '#51cbce' },
  { clave: 'instagram', etiqueta: 'Instagram', corta: 'Instagram', color: '#8965e0' },
  { clave: 'tiktok', etiqueta: 'Tik-Tok', corta: 'Tik-Tok', color: '#2dce89' },
  { clave: 'sinProcedencia', etiqueta: 'No se sabe su procedencia', corta: 'Sin procedencia', color: '#f56036' },
];

// Los clientes que no llenaron el formulario no son una procedencia: se
// capturan aparte y solo suman al total del periodo.
export const ETIQUETA_SIN_FORMULARIO = 'Cliente sin formulario';
export const CORTA_SIN_FORMULARIO = 'Sin formulario';
export const COLOR_SIN_FORMULARIO = '#c72e6b';

export interface RegistroMarketing {
  id: string;                        // `${taller}__${ano}__${mes}`
  taller: string;
  ano: number;
  mes: string;                       // nombre del mes (debe coincidir con MESES)
  desde?: string;                    // inicio del periodo (yyyy-mm-dd)
  hasta?: string;                    // fin del periodo (yyyy-mm-dd)
  fuentes: Record<string, number>;   // { [clave de fuente]: cantidad }
  sinFormulario: number;             // clientes atendidos sin formulario
  conFormulario: number;             // suma de todas las fuentes
  total: number;                     // conFormulario + sinFormulario
  actualizadoEn?: string;
}

export const idMarketing = (taller: string, ano: number | string, mes: string) =>
  `${taller}__${ano}__${mes}`;

// Cantidad de una fuente dentro de un registro (0 si no fue capturada)
export const cantidadFuente = (reg: RegistroMarketing, clave: string): number => {
  const v = reg.fuentes?.[clave];
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
};

// Suma de todas las fuentes del catálogo (clientes que sí llenaron formulario)
export const sumaFuentes = (reg: RegistroMarketing): number =>
  FUENTES_MARKETING.reduce((acc, f) => acc + cantidadFuente(reg, f.clave), 0);

// Total del periodo: con formulario + sin formulario
export const totalRegistroMarketing = (reg: RegistroMarketing): number => {
  const sin = typeof reg.sinFormulario === 'number' && reg.sinFormulario > 0 ? reg.sinFormulario : 0;
  return sumaFuentes(reg) + sin;
};

// Fecha yyyy-mm-dd → mm/dd/yyyy (formato del reporte impreso)
export const fechaCorta = (iso?: string): string => {
  if (!iso) return '';
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  const [a, m, d] = partes;
  return `${m}/${d}/${a}`;
};

export const useMarketing = () => {
  const [registros, setRegistros] = useState<RegistroMarketing[]>([]);
  const [cargando, setCargando] = useState(true);

  // Escucha en tiempo real, igual que registros/inspecciones
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'marketing'),
      (snapshot) => {
        const data = snapshot.docs.map(d => {
          const bruto = d.data() as Partial<RegistroMarketing>;
          return {
            ...bruto,
            id: d.id,
            fuentes: bruto.fuentes && typeof bruto.fuentes === 'object' ? bruto.fuentes : {},
            sinFormulario: typeof bruto.sinFormulario === 'number' ? bruto.sinFormulario : 0,
          } as RegistroMarketing;
        });
        setRegistros(data);
        setCargando(false);
      },
      (error) => {
        console.error("🔥 Error al leer 'marketing' de Firebase:", error);
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  const guardarRegistro = async (reg: RegistroMarketing) => {
    try {
      await setDoc(doc(db, 'marketing', reg.id), { ...reg, actualizadoEn: new Date().toISOString() });
    } catch (error) {
      console.error('Error al guardar el registro de marketing:', error);
      alert('Error al guardar en Firebase. Revisa la consola.');
    }
  };

  const eliminarRegistro = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'marketing', id));
    } catch (error) {
      console.error('Error al eliminar el registro de marketing:', error);
    }
  };

  return { registros, cargando, guardarRegistro, eliminarRegistro };
};
