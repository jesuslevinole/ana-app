import { useState, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Store, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import type { Taller } from '../types';

export const Talleres = () => {
  const contexto = useContext(AppContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [nombre, setNombre] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');

  if (!contexto) return null;

  // Lógica para leer la imagen y convertirla a Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const guardarTaller = () => {
    if (!nombre.trim()) return alert('Debe ingresar el nombre del taller');
    if (!logoBase64) return alert('Debe cargar un logo para el taller');

    const nuevoTaller: Taller = {
      id: crypto.randomUUID(),
      nombre,
      logo: logoBase64
    };

    contexto.agregarTaller(nuevoTaller);
    setNombre('');
    setLogoBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title">
          <Store size={24} color="var(--primary)" />
          <div>
            <h2>Gestión de Talleres</h2>
            <p className="page-subtitle">Administración de sucursales y marcas</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-custom" style={{ gridTemplateColumns: '1fr 2fr' }}>
        
        {/* PANEL IZQUIERDO: FORMULARIO */}
        <div className="card" style={{ height: 'max-content' }}>
          <h3 className="detail-section-title">Registrar Nuevo Taller</h3>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Nombre del Taller</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ej: VCD Auto Repair 02"
              value={nombre} 
              onChange={(e) => setNombre(e.target.value)} 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Logo del Taller</label>
            <div style={{ 
              border: '2px dashed var(--border)', padding: '1.5rem', borderRadius: '8px', 
              textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-body)', transition: 'border 0.3s'
            }} onClick={() => fileInputRef.current?.click()}>
              
              {logoBase64 ? (
                <img src={logoBase64} alt="Preview" style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <ImageIcon size={32} />
                  <span style={{ fontSize: '0.85rem' }}>Clic para seleccionar imagen</span>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={guardarTaller}>
            <Plus size={16} /> Agregar Taller
          </button>
        </div>

        {/* PANEL DERECHO: LISTADO DE TALLERES */}
        <div className="card">
          <h3 className="detail-section-title">Talleres Registrados</h3>
          
          {contexto.talleres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <Store size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>No hay talleres registrados en el sistema.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {contexto.talleres.map(taller => (
                <div key={taller.id} style={{ 
                  backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', 
                  borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', 
                  alignItems: 'center', gap: '1rem', position: 'relative'
                }}>
                  <div style={{ 
                    width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--bg-panel)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    border: '2px solid var(--border)', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                  }}>
                    <img src={taller.logo} alt={taller.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-main)', textAlign: 'center' }}>
                    {taller.nombre}
                  </strong>
                  
                  <button 
                    onClick={() => contexto.eliminarTaller(taller.id)}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}
                    title="Eliminar Taller"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};