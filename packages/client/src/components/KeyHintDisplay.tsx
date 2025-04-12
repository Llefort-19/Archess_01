import React from 'react';
import type { AbilityDefinition } from '@archess/shared';
import './KeyHintDisplay.css';

interface KeyHintDisplayProps {
  bindings: { [key: string]: string }; // key: abilityId
  lastKeyPressed: string | null;
  unitAbilities: AbilityDefinition[]; // To get ability names
}

function KeyHintDisplay({ lastKeyPressed, bindings, unitAbilities }: KeyHintDisplayProps): React.ReactElement {
  const getAbilityName = (abilityId: string): string => {
    return unitAbilities.find(ab => ab.id === abilityId)?.name ?? abilityId;
  };

  return (
    <div className="key-hint-container">
      {Object.entries(bindings).map(([key, abilityId]) => (
        <div 
          key={key} 
          className={`key-hint ${lastKeyPressed === key ? 'active' : ''}`}
          title={getAbilityName(abilityId)} // Show full name on hover
        >
          <span className="key-char">{key.toUpperCase()}</span>:
          <span className="ability-name">{getAbilityName(abilityId)}</span>
        </div>
      ))}
    </div>
  );
}

export default KeyHintDisplay; 