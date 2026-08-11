import { useState } from 'react';
import { useAuth, PERMITIR_ACCESO_SIN_LOGIN } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import { Calendar, Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

// =========================================================================
//  PANTALLA DE ACCESO
//  Login con correo y contraseña + recuperación por correo.
// =========================================================================

export const Login = () => {
  const { iniciarSesion, recuperarPassword, errorAcceso, entrarSinLogin } = useAuth();
  const { t } = useEtiquetas();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [aviso, setAviso] = useState('');

  const entrar = async () => {
    setAviso('');
    if (!email.trim() || !password) {
      setAviso('Escribe tu correo y tu contraseña.');
      return;
    }
    setEnviando(true);
    await iniciarSesion(email, password);
    setEnviando(false);
  };

  const recuperar = async () => {
    setAviso('');
    if (!email.trim()) {
      setAviso('Escribe tu correo para enviarte el enlace de recuperación.');
      return;
    }
    setEnviando(true);
    const ok = await recuperarPassword(email);
    setEnviando(false);
    if (ok) {
      setAviso('Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.');
      setModoRecuperar(false);
    }
  };

  // Permite enviar con Enter
  const alPresionarTecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (modoRecuperar) recuperar(); else entrar();
    }
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: '1.5rem', boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        backgroundColor: 'var(--bg-panel, #1e2235)', borderRadius: '16px',
        border: '1px solid var(--border, #2a2f45)',
        boxShadow: '0 20px 55px rgba(0,0,0,0.45)', overflow: 'hidden'
      }}>
        {/* ENCABEZADO */}
        <div style={{
          padding: '2rem 2rem 1.5rem', textAlign: 'center',
          borderBottom: '1px solid var(--border, #2a2f45)'
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '58px', height: '58px', borderRadius: '15px',
            backgroundColor: 'var(--primary, #1d8cf8)', color: '#fff',
            boxShadow: '0 8px 22px rgba(29,140,248,0.4)', marginBottom: '1rem'
          }}>
            <Calendar size={30} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main, #fff)' }}>
            {t('app.login.titulo', 'Sistema Metas')}
          </h1>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
            {modoRecuperar
              ? 'Escribe tu correo y te enviaremos un enlace para restablecer tu contraseña'
              : t('app.login.subtitulo', 'Ingresa con tu cuenta para continuar')}
          </p>
        </div>

        {/* FORMULARIO */}
        <div style={{ padding: '1.75rem 2rem 2rem' }}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Correo electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)', pointerEvents: 'none' }} />
              <input
                type="email"
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '38px' }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={alPresionarTecla}
                placeholder="correo@empresa.com"
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          {!modoRecuperar && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)', pointerEvents: 'none' }} />
                <input
                  type={verPassword ? 'text' : 'password'}
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '38px', paddingRight: '42px' }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={alPresionarTecla}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(v => !v)}
                  title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center'
                  }}
                >
                  {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          )}

          {/* MENSAJES */}
          {(errorAcceso || aviso) && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              padding: '0.75rem 0.9rem', borderRadius: '8px', marginBottom: '1rem',
              backgroundColor: errorAcceso ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: `1px solid ${errorAcceso ? '#ef4444' : '#22c55e'}`
            }}>
              {errorAcceso
                ? <AlertCircle size={17} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                : <CheckCircle2 size={17} color="#22c55e" style={{ flexShrink: 0, marginTop: '1px' }} />}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-main, #e2e8f0)', lineHeight: 1.4 }}>
                {errorAcceso || aviso}
              </span>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={modoRecuperar ? recuperar : entrar}
            disabled={enviando}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 700,
              opacity: enviando ? 0.7 : 1, cursor: enviando ? 'not-allowed' : 'pointer'
            }}
          >
            {modoRecuperar ? <Mail size={18} /> : <LogIn size={18} />}
            {enviando ? 'Un momento...' : modoRecuperar ? 'Enviar enlace' : 'Entrar'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => { setModoRecuperar(m => !m); setAviso(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary, #1d8cf8)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {modoRecuperar ? 'Volver al inicio de sesión' : '¿Olvidaste tu contraseña?'}
            </button>
          </div>

          {/* ACCESO TEMPORAL SIN INICIAR SESIÓN (modo desarrollo) */}
          {PERMITIR_ACCESO_SIN_LOGIN && !modoRecuperar && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0 1rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border, #2a2f45)' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>O BIEN</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border, #2a2f45)' }} />
              </div>

              <button
                type="button"
                onClick={entrarSinLogin}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', padding: '0.7rem', borderRadius: '8px', cursor: 'pointer',
                  backgroundColor: 'transparent', border: '1px dashed var(--text-muted, #94a3b8)',
                  color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem', fontWeight: 700
                }}
              >
                Entrar sin iniciar sesión <ArrowRight size={16} />
              </button>

              <p style={{ margin: '0.6rem 0 0', textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
                Acceso temporal con permisos de administrador.
                <br />Desactívalo antes de publicar la app.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
