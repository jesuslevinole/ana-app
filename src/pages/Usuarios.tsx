import { Users } from 'lucide-react';

export const Usuarios = () => {
  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Users size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Usuarios</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Gestión de usuarios</p>
          </div>
        </div>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '1.5rem' }}>
        <Users size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Usuarios</h3>
        <p style={{ color: 'var(--text-muted)' }}>Aquí irá la administración de usuarios. Indícame qué información y acciones necesitas y la construimos.</p>
      </div>
    </div>
  );
};