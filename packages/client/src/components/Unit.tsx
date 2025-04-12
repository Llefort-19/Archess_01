// src/components/Unit.tsx
import React from 'react'
import type { BoardUnit, UnitDefinition /*, GameObjectId */ } from '@archess/shared' // Remove GameObjectId
import './Unit.css' // Create next

interface UnitProps {
  unit: BoardUnit
  unitDef: UnitDefinition | undefined // Definition from GameState
  isPlayer1: boolean // To determine color/styling
  isSelected: boolean; // <-- Accept isSelected
  onClick: (unit: BoardUnit) => void; // <-- Accept onClick
}

// Assign to named const for display name
const Unit: React.FC<UnitProps> = React.memo(({ unit, unitDef, isPlayer1, isSelected, onClick }) => {
  // Add selected class if isSelected is true
  const selectedClass = isSelected ? 'unit-selected' : '';
  const playerClass = isPlayer1 ? 'player-1' : 'player-2';
  const unitTypeClass = `unit-type-${unitDef?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'}`;
  
  const handleClick = () => {
    onClick(unit);
  };

  return (
    <div
      className={`unit ${playerClass} ${unitTypeClass} ${selectedClass}`}
      onClick={handleClick}
      style={{
        // Keep grid positioning if needed, but remove if handled by Tile?
        // gridColumnStart: unit.position.x + 1,
        // gridRowStart: unit.position.y + 1,
      }}
      aria-label={`Unit ${unitDef?.name ?? 'Unknown'} at ${unit.position.x}, ${unit.position.y}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
    >
      {/* Simple representation: Remove .icon access */}
      {unitDef?.name?.charAt(0).toUpperCase() ?? 'U'}
      {/* HP Bar (Example) */}
      <div className="hp-bar-container">
        <div 
          className="hp-bar"
          // Safely access maxHp and provide a default
          style={{ width: `${(unit.currentHp / (unitDef?.maxHp ?? 100)) * 100}%` }}
        />
      </div>
    </div>
  )
})

Unit.displayName = 'Unit';

export default Unit 