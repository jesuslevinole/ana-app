import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  GASTOS DE MARKETING
//
//  Un documento = el resumen de gastos de un taller en un mes/año.
//
//  Cómo se calcula (igual que el Excel de la gerencia):
//    aporte        = gross × porcentaje %        (normalmente el 3 % de la venta)
//    gastos        = facebook + expenses + pago a Sr. Melvin
//    totalExpenses = aporte + gastos             (lo que se reporta como total)
//    fondos        = aporte − gastos             (lo que le queda a cada taller)
// =========================================================================

export interface GastoMarketing {
  id: string;                 // `${taller}__${ano}__${mes}`
  taller: string;
  ano: number;
  mes: string;
  gross: number;              // venta bruta del taller en el mes
  porcentaje: number;         // % de la venta destinado a marketing (3 por defecto)
  facebook: number;
  expenses: number;           // otros gastos de marketing
  pagoMelvin: number;         // pago a Sr. Melvin
  notas?: string;
  actualizadoEn?: string;
}

export const PORCENTAJE_MARKETING = 3;

export const idGastoMarketing = (taller: string, ano: number | string, mes: string) =>
  `${taller}__${ano}__${mes}`;

const num = (v: unknown): number =>
  typeof v === 'number' && isFinite(v) ? v : 0;

// Aporte de marketing: el porcentaje pactado sobre la venta bruta
export const aporteMarketing = (g: GastoMarketing): number =>
  (num(g.gross) * num(g.porcentaje)) / 100;

// Suma de los gastos del mes
export const gastosMarketing = (g: GastoMarketing): number =>
  num(g.facebook) + num(g.expenses) + num(g.pagoMelvin);

// Total reportado (aporte + gastos)
export const totalExpensesMarketing = (g: GastoMarketing): number =>
  aporteMarketing(g) + gastosMarketing(g);

// Lo que queda disponible para el taller
export const fondosMarketing = (g: GastoMarketing): number =>
  aporteMarketing(g) - gastosMarketing(g);

export const useMarketingGastos = () => {
  const [gastos, setGastos] = useState<GastoMarketing[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'marketingGastos'),
      (snapshot) => {
        const data = snapshot.docs.map(d => {
          const bruto = d.data() as Partial<GastoMarketing>;
          return {
            ...bruto,
            id: d.id,
            taller: bruto.taller || '',
            ano: num(bruto.ano),
            mes: bruto.mes || '',
            gross: num(bruto.gross),
            porcentaje: typeof bruto.porcentaje === 'number' ? bruto.porcentaje : PORCENTAJE_MARKETING,
            facebook: num(bruto.facebook),
            expenses: num(bruto.expenses),
            pagoMelvin: num(bruto.pagoMelvin),
          } as GastoMarketing;
        });
        setGastos(data);
        setCargando(false);
      },
      (error) => {
        console.error("🔥 Error al leer 'marketingGastos' de Firebase:", error);
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  const guardarGasto = async (g: GastoMarketing) => {
    try {
      await setDoc(doc(db, 'marketingGastos', g.id), { ...g, actualizadoEn: new Date().toISOString() });
    } catch (error) {
      console.error('Error al guardar el gasto de marketing:', error);
      alert('No se pudo guardar en Firebase. Revisa la consola.');
    }
  };

  const eliminarGasto = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'marketingGastos', id));
    } catch (error) {
      console.error('Error al eliminar el gasto de marketing:', error);
    }
  };

  return { gastos, cargando, guardarGasto, eliminarGasto };
};
