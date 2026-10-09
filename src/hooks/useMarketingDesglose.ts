import { useState, useEffect } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  MARKETING · DESGLOSE DE EXPENSES
//
//  Un documento = un MES (`${ano}__${mes}`) con el gasto de Facebook
//  capturado a mano para cada taller: { facebook: { [taller]: monto } }.
//
//  El "Gross" NO se guarda aquí: se lee en vivo del logrado mensual que ya
//  está capturado en Taller → Registros, y el aporte (3 %) y los fondos se
//  calculan al momento. Así la tabla se actualiza sola cuando cambian las
//  ventas y lo único manual es Facebook.
// =========================================================================

export interface DesgloseMes {
  id: string;                        // `${ano}__${mes}`
  ano: number;
  mes: string;                       // nombre del mes (igual que MESES)
  facebook: Record<string, number>;  // { [nombre del taller]: monto gastado }
  actualizadoEn?: string;
}

export const idDesglose = (ano: number | string, mes: string) => `${ano}__${mes}`;

// Monto de Facebook de un taller dentro de un mes (0 si no fue capturado)
export const facebookDeTaller = (reg: DesgloseMes | undefined, taller: string): number => {
  const v = reg?.facebook?.[taller];
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
};

export const useMarketingDesglose = () => {
  const [desgloses, setDesgloses] = useState<DesgloseMes[]>([]);
  const [cargando, setCargando] = useState(true);

  // Escucha en tiempo real, igual que el resto de los módulos
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'marketingDesglose'),
      (snapshot) => {
        const data = snapshot.docs.map(d => {
          const bruto = d.data() as Partial<DesgloseMes>;
          return {
            ...bruto,
            id: d.id,
            facebook: bruto.facebook && typeof bruto.facebook === 'object' ? bruto.facebook : {},
          } as DesgloseMes;
        });
        setDesgloses(data);
        setCargando(false);
      },
      (error) => {
        console.error("🔥 Error al leer 'marketingDesglose' de Firebase:", error);
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  const guardarDesglose = async (reg: DesgloseMes) => {
    try {
      await setDoc(doc(db, 'marketingDesglose', reg.id), { ...reg, actualizadoEn: new Date().toISOString() });
    } catch (error) {
      console.error('Error al guardar el desglose de marketing:', error);
      alert('Error al guardar en Firebase. Revisa la consola.');
    }
  };

  return { desgloses, cargando, guardarDesglose };
};
