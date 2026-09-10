// Color de fondo de la pastilla de cada procedencia de marketing.
// Vive en su propio archivo para no romper el fast-refresh de Vite.
export const COLOR_ICONO: Record<string, string> = {
  clientesRegulares: '#1d8cf8',
  pasandoSign: '#ffbc11',
  recomendadosAmigos: '#00d6b4',
  recomendadosTagTitle: '#ff8d72',
  busquedaGoogle: '#ffffff',   // el logo de Google ya trae sus colores
  facebook: '#1877F2',
  instagram: '#E1306C',
  tiktok: '#010101',
  chatgpt: '#10A37F',
  sinProcedencia: '#f56036',
  sinFormulario: '#c72e6b',
};

// Fondos especiales: Instagram usa su degradado oficial
export const FONDO_PASTILLA: Record<string, string> = {
  instagram: 'linear-gradient(45deg, #F58529 0%, #DD2A7B 45%, #8134AF 75%, #515BD4 100%)',
};
