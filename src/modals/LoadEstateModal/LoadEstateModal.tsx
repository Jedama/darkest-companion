// src/modals/LoadEstateModal/LoadEstateModal.tsx
import { useState, useEffect } from 'react';
import type { Estate } from '../../../shared/types/types.ts';
import { fetchEstates, loadEstate, createEstate as createEstateApi, deleteEstate as deleteEstateApi } from '../../utils/api.ts';

interface LoadEstateModalProps {
  onLoadEstate: (estate: Estate) => void;
  onCreateEstate: (estateName: string) => void;
  onDeleteEstate: (estateName: string) => void;
}

export function LoadEstateModal({ 
  onLoadEstate, 
  onCreateEstate,
  onDeleteEstate 
}: LoadEstateModalProps) {
  const [newEstateName, setNewEstateName] = useState('');
  const [existingEstates, setExistingEstates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEstatesList();
  }, []);

  async function loadEstatesList() {
    try {
      const estates = await fetchEstates();
      setExistingEstates(estates);
      setError(null);
    } catch (err) {
      setError('Failed to load estates');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateEstate = async () => {
    if (newEstateName.trim()) {
      try {
        const estate = await createEstateApi(newEstateName.trim());
        onCreateEstate(newEstateName.trim());
        setNewEstateName('');
        loadEstatesList(); // Refresh the list
      } catch (err) {
        setError('Failed to create estate');
        console.error(err);
      }
    }
  };

  const handleLoadEstate = async (estateName: string) => {
    try {
      const estate = await loadEstate(estateName);
      onLoadEstate(estate);
    } catch (err) {
      setError('Failed to load estate');
      console.error(err);
    }
  };

  const handleDeleteEstate = async (estateName: string) => {
    try {
      await deleteEstateApi(estateName);
      onDeleteEstate(estateName);
      loadEstatesList(); // Refresh the list
    } catch (err) {
      setError('Failed to delete estate');
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Load or Create Estate</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="create-estate-section">
          <input
            type="text"
            value={newEstateName}
            onChange={(e) => setNewEstateName(e.target.value)}
            placeholder="Enter estate name"
          />
          <button 
            onClick={handleCreateEstate}
            disabled={!newEstateName.trim()}
          >
            Create New Estate
          </button>
        </div>

        <div className="existing-estates-section">
          <h3>Existing Estates</h3>
          {loading ? (
            <p>Loading estates...</p>
          ) : existingEstates.length === 0 ? (
            <p>No estates found</p>
          ) : (
            <ul className="estate-list">
              {existingEstates.map(estateName => (
                <li key={estateName} className="estate-item">
                  <span>{estateName}</span>
                  <div className="estate-actions">
                    <button onClick={() => handleLoadEstate(estateName)}>
                      Load
                    </button>
                    <button 
                      onClick={() => handleDeleteEstate(estateName)}
                      className="delete-button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}