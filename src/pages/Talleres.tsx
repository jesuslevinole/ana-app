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

    // Esto viaja al AppContext y se guarda automáticamente en Firebase
    contexto.agregarTaller(nuevoTaller);
    setNombre('');
    setLogoBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEliminar = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este taller de la base de datos? Esta acción es irreversible.')) {
      contexto.eliminarTaller(id);
    }
  };

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title">
          <Store size={24} color="var(--primary)" />
          <div>
            <h2>Gestión de Talleres</h2>
            <p className="page-subtitle">Administración de sucursales sincronizada en la nube</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-custom" style={{ gridTemplateColumns: '1fr 2fr', alignItems: 'start' }}>
        
        {/* PANEL IZQUIERDO: FORMULARIO */}
        <div className="card animate-in fade-in slide-in-from-left-2" style={{ position: 'sticky', top: '2rem' }}>
          <h3 className="detail-section-title">Registrar Nuevo Taller</h3>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Nombre del Taller</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ej: Rosales Auto Repair Central"
              value={nombre} 
              onChange={(e) => setNombre(e.target.value)} 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Logo de Marca (Formato rectangular sugerido)</label>
            <div style={{ 
              border: '2px dashed var(--border)', padding: '1rem', borderRadius: '12px', 
              textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-body)', transition: 'border 0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '160px'
            }} onClick={() => fileInputRef.current?.click()}>
              
              {logoBase64 ? (
                <div style={{ padding: '0.5rem' }}>
                  <img src={logoBase64} alt="Preview" style={{ 
                    maxHeight: '120px', maxWidth: '100%', objectFit: 'contain'
                  }} />
                  <p style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem'}}>Clic para cambiar</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', padding: '1rem' }}>
                  <ImageIcon size={36} style={{opacity: 0.5}} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Seleccionar Imagen</span>
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

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} onClick={guardarTaller}>
            <Plus size={16} /> Finalizar Registro
          </button>
        </div>

        {/* PANEL DERECHO: LISTADO DE TALLERES REDISEÑADO */}
        <div className="card">
          <h3 className="detail-section-title">Talleres Registrados (Persistencia en Firebase)</h3>
          
          {contexto.talleres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-muted)' }}>
              <Store size={64} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
              <p style={{fontSize: '1.1rem'}}>No hay talleres registrados en la base de datos.</p>
              <p style={{fontSize: '0.85rem'}}>Use el panel izquierdo para agregar su primera sucursal.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {contexto.talleres.map(taller => (
                <div key={taller.id} style={{ 
                  backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', 
                  borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', 
                  gap: '1rem', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {/* CONTENEDOR DE LOGO GRANDE Y PROFESIONAL */}
                  <div style={{ 
                    width: '100%', height: '140px', borderRadius: '8px', backgroundColor: 'var(--bg-panel)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    border: '1px solid var(--border)', padding: '1rem',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' 
                  }}>
                    <img src={taller.logo} alt={taller.nombre} style={{ 
                      maxWidth: '100%', maxHeight: '100%', 
                      objectFit: 'contain'
                    }} />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem'}}>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      {taller.nombre}
                    </strong>
                    
                    <button 
                      onClick={() => handleEliminar(taller.id)}
                      style={{ background: 'rgba(255, 76, 76, 0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'background 0.2s' }}
                      title="Eliminar Taller"
                      className="btn-delete-taller"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};