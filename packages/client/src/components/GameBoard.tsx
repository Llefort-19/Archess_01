import React from 'react'
import type { GameState, GameObjectId, BoardUnit } from '@archess/shared'
import Tile from './Tile'
import Unit from './Unit'
import './GameBoard.css'

interface GameBoardProps {
  gameState: GameState
  selectedUnitId: GameObjectId | null;
  onUnitClick: (unit: BoardUnit) => void;
  onTileClick: (x: number, y: number) => void;
}

// Helper to quickly look up unit by position
function createUnitPositionMap(units: GameState['units']): Map<string, GameState['units'][0]> {
  const map = new Map<string, GameState['units'][0]>();
  for (const unit of units) {
    const key = `${unit.position.x},${unit.position.y}`;
    map.set(key, unit);
  }
  return map;
}

// Assign to named const for display name
const GameBoard: React.FC<GameBoardProps> = React.memo(({
  gameState,
  selectedUnitId,
  onUnitClick,
  onTileClick,
}) => {
  console.log("[GameBoard Render]");

  const { boardConfig, units, unitDefinitions, players } = gameState
  const unitMap = React.useMemo(() => createUnitPositionMap(units), [units]);
  const player1Id = players[0]; // Assume P1 is the first player

  // CSS Grid styles based on board dimensions
  const boardStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${boardConfig.width}, 1fr)`,
    gridTemplateRows: `repeat(${boardConfig.height}, 1fr)`,
    width: `${boardConfig.width * 50}px`, // Match Tile size (50px)
    height: `${boardConfig.height * 50}px`,
  }

  return (
    <div className="game-board" style={boardStyle}>
      {boardConfig.layout.flatMap((row, y) =>
        row.map((tileId, x) => {
          const tileDef = boardConfig.tileDefinitions[tileId]
          const positionKey = `${x},${y}`;
          const unitOnTile = unitMap.get(positionKey);
          const unitDef = unitOnTile ? unitDefinitions[unitOnTile.typeId] : undefined;

          return (
            <Tile 
              key={positionKey} 
              tileDef={tileDef} 
              x={x} 
              y={y}
              onClick={onTileClick}
            >
              {unitOnTile && unitDef && (
                <Unit 
                  unit={unitOnTile} 
                  unitDef={unitDef} 
                  isPlayer1={unitOnTile.owner === player1Id} 
                  isSelected={unitOnTile.id === selectedUnitId}
                  onClick={onUnitClick}
                />
              )}
            </Tile>
          )
        })
      )}
    </div>
  )
})

// Explicitly set display name (alternative, often handled by tools/babel)
GameBoard.displayName = 'GameBoard'; 

export default GameBoard 