import type { CSSProperties } from 'react';
import { Users, Handshake, Tag, Signpost, CircleHelp, ClipboardX } from 'lucide-react';
import { COLOR_ICONO } from './coloresProcedencia';

// =========================================================================
//  ICONOS DE PROCEDENCIA (MARKETING)
//
//  lucide ya no incluye los logotipos de marca, así que los de redes sociales
//  se dibujan aquí con su propio SVG y su color oficial. El resto usa iconos
//  de lucide para mantener el estilo del sistema.
// =========================================================================

type PropsIcono = { size?: number; color?: string; style?: CSSProperties };

// --- Marcas ---
export const IconoFacebook = ({ size = 18, color = '#ffffff', style }: PropsIcono) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden="true">
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.92 3.77-3.92 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.9h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
  </svg>
);

export const IconoInstagram = ({ size = 18, color = '#ffffff', style }: PropsIcono) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.6" cy="6.4" r="1.2" fill={color} stroke="none" />
  </svg>
);

export const IconoTikTok = ({ size = 18, color = '#ffffff', style }: PropsIcono) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden="true">
    <path d="M16.5 2h-3v13.2a2.9 2.9 0 1 1-2.1-2.79V9.3a6 6 0 1 0 5.1 5.93V8.9a7.2 7.2 0 0 0 4.1 1.28V7.12A4.2 4.2 0 0 1 16.5 2Z" />
  </svg>
);

export const IconoGoogle = ({ size = 18, style }: PropsIcono) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.76-.07-1.49-.2-2.18H12v4.13h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.47Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H3.06v2.58A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.83V7.5H3.06a10 10 0 0 0 0 9l3.35-2.58Z" />
    <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.5l3.35 2.59C7.2 7.73 9.4 5.98 12 5.98Z" />
  </svg>
);

// Dibuja el icono que corresponde a cada procedencia
export const IconoProcedencia = ({ clave, size = 18 }: { clave: string; size?: number }) => {
  switch (clave) {
    case 'facebook': return <IconoFacebook size={size} />;
    case 'instagram': return <IconoInstagram size={size} />;
    case 'tiktok': return <IconoTikTok size={size} />;
    case 'busquedaGoogle': return <IconoGoogle size={size} />;
    case 'clientesRegulares': return <Users size={size} color="#ffffff" />;
    case 'recomendadosAmigos': return <Handshake size={size} color="#ffffff" />;
    case 'recomendadosTagTitle': return <Tag size={size} color="#ffffff" />;
    case 'pasandoSign': return <Signpost size={size} color="#111827" />;
    case 'sinProcedencia': return <CircleHelp size={size} color="#ffffff" />;
    case 'sinFormulario': return <ClipboardX size={size} color="#ffffff" />;
    default: return <Users size={size} color="#ffffff" />;
  }
};

// Pastilla redonda con el icono, lista para usar en tablas y gráficas
export const PastillaProcedencia = ({ clave, size = 34 }: { clave: string; size?: number }) => (
  <span
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: `${size}px`, height: `${size}px`, borderRadius: '10px', flexShrink: 0,
      backgroundColor: COLOR_ICONO[clave] || '#1d8cf8',
      border: clave === 'busquedaGoogle' || clave === 'tiktok' ? '1px solid rgba(255,255,255,0.35)' : 'none',
      boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
    }}
  >
    <IconoProcedencia clave={clave} size={Math.round(size * 0.55)} />
  </span>
);
