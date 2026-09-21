// =========================================================================
//  EXPORTAR UN BLOQUE DE LA PANTALLA A PNG O PDF
//
//  html2canvas y jsPDF se cargan desde CDN la primera vez que se usan, igual
//  que en los demás dashboards, para no sumarlos al paquete de la app.
// =========================================================================

type Html2Canvas = (el: HTMLElement, op: object) => Promise<HTMLCanvasElement>;

const cargarScript = (src: string, yaCargado: () => unknown): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const previo = yaCargado();
    if (previo) return resolve(previo);
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      const cargado = yaCargado();
      if (cargado) resolve(cargado); else reject(new Error('Librería no disponible'));
    };
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.body.appendChild(s);
  });

const cargarHtml2Canvas = () =>
  cargarScript(
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    () => (window as unknown as { html2canvas?: Html2Canvas }).html2canvas
  ) as Promise<Html2Canvas>;

const cargarJsPDF = () =>
  cargarScript(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    () => (window as unknown as { jspdf?: unknown }).jspdf
  );

// Dibuja el elemento en un canvas con buena resolución.
// Todo lo marcado con data-no-export (botones, selectores de color, avisos de
// "arrastra para reordenar"...) se quita de la copia antes de dibujar, para que
// el archivo salga limpio y no con la pantalla tal cual.
const aLienzo = async (el: HTMLElement): Promise<HTMLCanvasElement> => {
  const html2canvas = await cargarHtml2Canvas();
  return html2canvas(el, {
    scale: 3,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    imageTimeout: 8000,
    onclone: (doc: Document) => {
      doc.querySelectorAll('[data-no-export]').forEach(n => n.remove());
    },
  });
};

// Descarga el bloque como imagen PNG
export const exportarPNG = async (el: HTMLElement, nombreArchivo: string) => {
  const canvas = await aLienzo(el);
  const link = document.createElement('a');
  link.download = `${nombreArchivo}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// Descarga el bloque como PDF horizontal, ajustado para que quepa completo
export const exportarPDF = async (el: HTMLElement, nombreArchivo: string) => {
  const [canvas, jspdf] = await Promise.all([aLienzo(el), cargarJsPDF()]);
  const lib = jspdf as { jsPDF?: new (op: object) => JsPDFMinimo };
  const JsPDF = (lib.jsPDF || jspdf) as new (op: object) => JsPDFMinimo;

  const pdf = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const anchoHoja = pdf.internal.pageSize.getWidth();
  const altoHoja = pdf.internal.pageSize.getHeight();

  // La imagen entra completa y centrada, con un margen de 18 pt
  const margen = 18;
  const escala = Math.min(
    (anchoHoja - margen * 2) / canvas.width,
    (altoHoja - margen * 2) / canvas.height
  );
  const ancho = canvas.width * escala;
  const alto = canvas.height * escala;

  pdf.addImage(
    canvas.toDataURL('image/jpeg', 0.95), 'JPEG',
    (anchoHoja - ancho) / 2, (altoHoja - alto) / 2, ancho, alto
  );
  pdf.save(`${nombreArchivo}.pdf`);
};

// PDF de varias páginas: cada elemento ocupa una hoja completa, como las
// diapositivas de una presentación.
export const exportarPDFDiapositivas = async (
  elementos: { el: HTMLElement | null; titulo?: string }[],
  nombreArchivo: string
) => {
  const utiles = elementos.filter(x => x.el) as { el: HTMLElement; titulo?: string }[];
  if (utiles.length === 0) throw new Error('No hay nada que exportar');

  const jspdf = await cargarJsPDF();
  const lib = jspdf as { jsPDF?: new (op: object) => JsPDFMinimo };
  const JsPDF = (lib.jsPDF || jspdf) as new (op: object) => JsPDFMinimo;

  const pdf = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const anchoHoja = pdf.internal.pageSize.getWidth();
  const altoHoja = pdf.internal.pageSize.getHeight();
  const margen = 26;

  for (let i = 0; i < utiles.length; i++) {
    const canvas = await aLienzo(utiles[i].el);
    if (i > 0) pdf.addPage('a4', 'landscape');

    // Deja aire arriba cuando la diapositiva lleva título
    const alturaTitulo = utiles[i].titulo ? 28 : 0;
    if (utiles[i].titulo) {
      pdf.setFontSize(13);
      pdf.text(utiles[i].titulo as string, margen, margen + 8);
    }

    const dispAncho = anchoHoja - margen * 2;
    const dispAlto = altoHoja - margen * 2 - alturaTitulo;
    const escala = Math.min(dispAncho / canvas.width, dispAlto / canvas.height);
    const ancho = canvas.width * escala;
    const alto = canvas.height * escala;

    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.95), 'JPEG',
      (anchoHoja - ancho) / 2, margen + alturaTitulo + (dispAlto - alto) / 2,
      ancho, alto
    );
  }

  pdf.save(`${nombreArchivo}.pdf`);
};

// Lo mínimo que usamos de jsPDF, para no depender de sus tipos
interface JsPDFMinimo {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addImage: (datos: string, formato: string, x: number, y: number, w: number, h: number) => void;
  addPage: (formato: string, orientacion: string) => void;
  setFontSize: (n: number) => void;
  text: (texto: string, x: number, y: number) => void;
  save: (nombre: string) => void;
}
