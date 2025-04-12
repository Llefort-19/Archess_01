import React from 'react';
import type { AbilityDefinition } from '@archess/shared';
import './KeyHintDisplay.css';

interface KeyHintDisplayProps {
  keyOrder: string[]; // Array of keys in the desired display order (e.g., ['u', 'i', 'o', 'p'])
  lastKeyPressed: string | null;
  unitAbilities: AbilityDefinition[]; // Abilities available to the current unit
}

function KeyHintDisplay({ lastKeyPressed, keyOrder, unitAbilities }: KeyHintDisplayProps): React.ReactElement {
  
  // --- REMOVE LOG --- 
  // console.log(`[KeyHintDisplay] Received props - lastKeyPressed: ${lastKeyPressed}, keyOrder: ${keyOrder.join(',')}, abilities: ${unitAbilities.map(a=>a.id).join(',')}`);
  // --- END REMOVE LOG ---

  // Helper to get ability name by index safely
  const getAbilityByIndex = (index: number): AbilityDefinition | undefined => {
    return unitAbilities?.[index];
  };

  return (
    <div className="key-hint-display">
      {keyOrder.map((key, index) => {
        const ability = getAbilityByIndex(index);
        if (!ability) return null; // Don't render a hint if there's no ability at this index

        return (
          <div 
            key={key} 
            className={`key-hint ${lastKeyPressed === key ? 'active' : ''}`}
            title={ability.name} // Show full name on hover
          >
            <span className="key-char">{key.toUpperCase()}</span>:
            <span className="ability-name">{ability.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export default KeyHintDisplay; 