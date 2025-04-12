import React from 'react';
import type { AvailablePresetInfo } from '../services/api';

interface LobbyViewProps {
  presets: AvailablePresetInfo[];
  selectedPresetId: string | null;
  isLoadingPresets: boolean;
  isConnected: boolean;
  onPresetChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onCreateMatch: () => void;
  onJoinMatch: () => void;
}

function LobbyView({
  presets,
  selectedPresetId,
  isLoadingPresets,
  isConnected,
  onPresetChange,
  onCreateMatch,
  onJoinMatch,
}: LobbyViewProps): React.ReactElement {
  return (
    <div>
      <h3>Create or Join a Match</h3>
      {isLoadingPresets ? (
        <p>Loading presets...</p>
      ) : presets.length > 0 ? (
        <div>
          <label htmlFor="preset-select">Select Preset: </label>
          <select 
              id="preset-select" 
              value={selectedPresetId ?? ''} 
              onChange={onPresetChange}
              disabled={!isConnected}
          >
              {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                      {p.name} ({p.description})
                  </option>
              ))}
          </select>
          <button type="button" onClick={onCreateMatch} disabled={!isConnected || !selectedPresetId}>
              Create Match
          </button>
        </div>
      ) : (
        <p>No game presets available from server.</p>
      )}

      <button type="button" onClick={onJoinMatch} disabled={!isConnected} style={{marginTop: '10px'}}>
          Join Match by ID
      </button>
    </div>
  );
}

export default LobbyView; 