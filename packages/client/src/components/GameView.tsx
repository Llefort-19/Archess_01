import React from 'react';
import type { GameState, GameObjectId, BoardUnit } from '@archess/shared';
import GameBoard from './GameBoard';
// import { socket } from '../App'; // REMOVE this import

// Placeholder Component for the Game View
interface GameViewProps {
    gameState: GameState;
    selectedUnitId: GameObjectId | null;
    isMyTurn: boolean; // ADD this prop
    onUnitClick: (unit: BoardUnit) => void;
    onTileClick: (x: number, y: number) => void;
    onEndTurnClick: () => void;
}

function GameView({
    gameState,
    selectedUnitId,
    isMyTurn,
    onUnitClick,
    onTileClick,
    onEndTurnClick
}: GameViewProps): React.ReactElement {
    if (!gameState) {
        return <div>Loading game state...</div>; // Or some other placeholder
    }

    // Remove the calculation using socket?.id
    // const isMyTurn = gameState.currentTurn === socket?.id;
    
    return (
        <div className="game-view">
            <h3>Game Active: {gameState.matchId}</h3>
            {/* Use the isMyTurn prop directly */}
            <p>Turn: {gameState.turnNumber} ({isMyTurn ? 'Your Turn' : 'Opponent\'s Turn'})</p>
            <p>Players: {gameState.players.join(', ')}</p>
            
            <GameBoard 
                gameState={gameState} 
                selectedUnitId={selectedUnitId} 
                onUnitClick={onUnitClick} 
                onTileClick={onTileClick}
            /> 

            {/* Use the isMyTurn prop directly */}
            {isMyTurn && (
                <button 
                    type="button" 
                    onClick={onEndTurnClick} 
                    className="end-turn-button"
                >
                    End Turn
                </button>
            )}
        </div>
    );
}

export default GameView; 