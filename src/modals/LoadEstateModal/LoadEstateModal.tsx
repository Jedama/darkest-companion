// src/modals/LoadEstateModal/LoadEstateModal.tsx
import { useState, useEffect } from 'react';
import { fetchEstates } from '../../utils/api.js';
import { useEstateContext } from '../../contexts/EstateContext.js';
import { ErrorNotice } from '../../components/ui/ErrorNotice.js';
import './LoadEstateModal.css'; // if you have a CSS file

export function LoadEstateModal() {
  const { handleCreateEstate, handleLoadEstate, handleDeleteEstate } = useEstateContext();

  // Local state for the list and loading
  const [newEstateName, setNewEstateName] = useState('');
  const [existingEstates, setExistingEstates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEstatesList();
  }, []);

  async function loadEstatesList() {
    try {
      setLoading(true);
      const estates = await fetchEstates();
      setExistingEstates(estates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estates');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const onCreateEstateClick = async () => {
    if (!newEstateName.trim()) return;
    try {
      await handleCreateEstate(newEstateName);
      // Clear input
      setNewEstateName('');
      // Reload list to see the newly created estate in the list
      await loadEstatesList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create estate');
      console.error(err);
    }
  };

  const onLoadEstateClick = async (estateName: string) => {
    try {
      await handleLoadEstate(estateName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estate');
      console.error(err);
    }
  };

  const onDeleteEstateClick = async (estateName: string) => {
    try {
      await handleDeleteEstate(estateName);
      await loadEstatesList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete estate');
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Load or Create Estate</h2>
        
        {error && (
          <ErrorNotice
            message={error}
            onDismiss={() => setError(null)}
            dismissLabel="Dismiss"
          />
        )}
        
        <div className="create-estate-section">
          <input
            type="text"
            value={newEstateName}
            onChange={(e) => setNewEstateName(e.target.value)}
            placeholder="Enter estate name"
          />
          <button 
            onClick={onCreateEstateClick}
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
              {existingEstates.map((estateName) => (
                <li key={estateName} className="estate-item">
                  <span>{estateName}</span>
                  <div className="estate-actions">
                    <button onClick={() => onLoadEstateClick(estateName)}>
                      Load
                    </button>
                    <button
                      onClick={() => onDeleteEstateClick(estateName)}
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