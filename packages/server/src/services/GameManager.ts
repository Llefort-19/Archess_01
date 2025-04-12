import {
    GameState,
    GameObjectId,
    GridPosition,
    MoveActionPayload,
    MatchId,
    PlayerId,
    PresetId,
    UnitDefinition,
    BoardUnit,
    ClientToServerEvents,
    // CombatActionPayload
} from '@archess/shared'
import { presetService } from './PresetService'
import { CombatManager } from './CombatManager'
// import type { Socket } from 'socket.io'
import type { Server as SocketIOServer } from 'socket.io'
// Cannot use standard import for nanoid due to module issues
// import { nanoid } from 'nanoid' 

// Type for the dynamically imported nanoid
let nanoid: (size?: number) => string;

// Define the specific PlayerAction payload type and actionType union
// Correctly extract the payload type (first argument of the listener function)
type PlayerActionEventPayload = Parameters<ClientToServerEvents['playerAction']>[0];
type PlayerActionType = PlayerActionEventPayload['actionType']; // Extract from the payload type
type PlayerActionPayloadUnion = PlayerActionEventPayload['payload']; // Extract from the payload type

// --- Game State Management --- 
// Simple in-memory store for active games
// Replace with DB/Redis for persistence and scalability
const activeGames: Map<MatchId, GameState> = new Map()

/** Retrieves the game state for a given match ID. */
function getGameState(matchId: MatchId): GameState | undefined {
  return activeGames.get(matchId)
}

// Store the io instance after initialization
let ioInstance: SocketIOServer | null = null

// --- Helper Functions ---

/** Initializes the GameManager with the Socket.IO server instance. */
function initialize(io: SocketIOServer): void {
    console.log("[GameManager] Initializing with IO instance.")
    if (ioInstance) {
        console.warn("[GameManager] Already initialized.")
        return
    }
    ioInstance = io
    loadNanoid(); // Load nanoid when initializing
}

/** Emits the current game state to all players in the match room. */
function emitGameStateUpdate(matchId: MatchId, state: GameState): void {
    if (!ioInstance) {
        console.error(`[Game ${matchId}] Cannot emit game state update: IO not initialized.`)
        return
    }
    console.log(`[Game ${matchId}] Emitting gameStateUpdate`)
    ioInstance.to(matchId).emit('gameStateUpdate', state)
}

/** Emits an error message to a specific player. */
function emitErrorToSocket(socketId: PlayerId, message: string, code?: string): void {
    if (!ioInstance) {
        console.error(`[Game] Cannot emit error to ${socketId}: IO not initialized.`)
        return
    }
    console.warn(`[Game] Emitting error to ${socketId}: ${message}`)
    ioInstance.to(socketId).emit('error', { message, code })
}

// Load nanoid dynamically
async function loadNanoid() {
    if (!nanoid) {
        const nanoidModule = await import('nanoid');
        nanoid = nanoidModule.nanoid; // Or nanoidModule.default if it's a default export
    }
}

// --- Game Initialization --- 

/** Initializes a new game state based on a preset and players. */
function initializeGame(
  matchId: MatchId,
  presetId: PresetId,
  playerIds: PlayerId[]
): GameState {
  console.log(`[GameManager] initializeGame called for match ${matchId} with preset ${presetId}.`);
  const preset = presetService.getPresetById(presetId)
  if (!preset) throw new Error(`Preset ${presetId} not found.`)
  if (playerIds.length !== 2) throw new Error(`Game requires 2 players.`)
  const [player1Id, player2Id] = playerIds // Safe due to length check
  if (!player1Id || !player2Id) throw new Error('Invalid player IDs provided.'); // Extra safety

  const initialUnits: BoardUnit[] = []

  const createUnit = (ownerId: PlayerId, unitTypeId: string, position: GridPosition /*, team: 'p1' | 'p2' */): BoardUnit => {
      const definition = preset.units[unitTypeId];
      if (!definition) throw new Error(`Unit definition not found: ${unitTypeId}`);
      
      if (!position) throw new Error(`Initial position missing for unit ${unitTypeId}`);

      return {
          id: nanoid ? nanoid(8) : `fallback_${Date.now()}`, // Use loaded nanoid or fallback
          typeId: unitTypeId,
          owner: ownerId,
          position: position, // Use the provided GridPosition
          currentHp: definition.maxHp,
      };
  }

  // Iterate using entries to ensure type safety for position
  for (const [unitTypeId, position] of Object.entries(preset.board.player1StartPositions)) {
      // Ensure unitTypeId is actually a string key (though Object.entries should guarantee this)
      if (typeof unitTypeId === 'string') {
         const unit = createUnit(player1Id, unitTypeId, position /*, 'p1' */);
         if (unit) initialUnits.push(unit);
      }
  }
  for (const [unitTypeId, position] of Object.entries(preset.board.player2StartPositions)) {
      if (typeof unitTypeId === 'string') {
          const unit = createUnit(player2Id, unitTypeId, position /*, 'p2' */);
          if (unit) initialUnits.push(unit);
      }
  }

  const initialState: GameState = {
    matchId,
    presetId,
    boardConfig: { ...preset.board },
    unitDefinitions: { ...preset.units },
    players: [player1Id, player2Id], // Use validated IDs
    currentTurn: player1Id,
    turnNumber: 1,
    units: initialUnits,
    winner: null,
    isGameOver: false,
  }

  activeGames.set(matchId, initialState)
  console.log(`[GameManager] Game ${matchId} state created in memory with ${initialState.units.length} units.`)
  
  // Emit the initial state to the specific room for this match
  console.log(`[GameManager] Emitting initial gameStateUpdate to room ${matchId}...`);
  emitGameStateUpdate(matchId, initialState); 
  
  console.log(`[GameManager] initializeGame completed for ${matchId}.`);
  return initialState
}

// --- Game Logic (Placeholders - requires significant implementation) --- 

/** Validates if a move action is legal according to game rules and preset. */
function isValidMove(
    gameState: GameState,
    playerId: PlayerId, 
    unit: BoardUnit, 
    targetPosition: GridPosition,
    unitDef: UnitDefinition
): boolean {
    console.log(`[isValidMove] Checking unit ${unit.id} (${unitDef.name}) move to (${targetPosition.x},${targetPosition.y}) for player ${playerId}`);

    if (unit.owner !== playerId) { 
        console.log(`[isValidMove] Failed: Unit owner mismatch.`);
        return false; 
    }
    if (gameState.currentTurn !== playerId) { 
        console.log(`[isValidMove] Failed: Not player's turn.`);
        return false; 
    }
    
    // Bounds check
    const { width, height, layout, tileDefinitions } = gameState.boardConfig;
    if (targetPosition.x < 0 || targetPosition.x >= width || 
        targetPosition.y < 0 || targetPosition.y >= height) { 
        console.log(`[isValidMove] Failed: Target out of bounds.`);
        return false; 
    }

    // Check tile walkability safely
    const tileRow = layout[targetPosition.y];
    if (!tileRow) { 
        console.log(`[isValidMove] Failed: Target row ${targetPosition.y} invalid.`);
        return false; 
    }
    const tileId = tileRow[targetPosition.x]; 
    if (typeof tileId !== 'string') { 
        console.log(`[isValidMove] Failed: Invalid tile ID at target.`);
        return false; 
    }
    const tileDef = tileDefinitions[tileId];
    if (!tileDef || !tileDef.isWalkable) { 
        console.log(`[isValidMove] Failed: Tile ${tileId} not walkable.`);
        return false; 
    }

    // Distance check 
    const dx = Math.abs(targetPosition.x - unit.position.x);
    const dy = Math.abs(targetPosition.y - unit.position.y);
    const distance = dx + dy; // Manhattan distance
    if (distance === 0) {
        console.log(`[isValidMove] Failed: Cannot move to the same square.`);
        return false;
    }
    if (!unitDef.movement || typeof unitDef.movement.distance !== 'number') {
        console.log(`[isValidMove] Failed: Unit movement definition invalid.`);
        return false;
    }
    if (distance > unitDef.movement.distance) {
        console.log(`[isValidMove] Failed: Distance ${distance} exceeds unit range ${unitDef.movement.distance}.`);
        return false; 
    }
    // TODO: Add pathfinding/cost calculation here instead of simple distance

    // Occupancy check
    const occupyingUnit = gameState.units.find(u => 
        u.position.x === targetPosition.x && u.position.y === targetPosition.y
    );
    if (occupyingUnit && occupyingUnit.owner === playerId) { 
        console.log(`[isValidMove] Failed: Target occupied by friendly unit ${occupyingUnit.id}.`);
        return false; 
    }

    console.log(`[isValidMove] Passed all checks.`);
    return true; 
}

// --- Turn Management --- 

/** Resolves a battle when units clash. (Placeholder) */
function resolveBattle(
    matchId: MatchId,
    attackerId: GameObjectId,
    defenderId: GameObjectId
): void {
    const match = activeGames.get(matchId);
    if (!match) {
        console.error(`[GameManager ${matchId}] Cannot resolve battle: Match not found.`);
        return;
    }
    
    // Instead of emitting 'battleInitiated' directly...
    // console.log(`[GameManager ${matchId}] Emitting battleInitiated between ${attackerId} and ${defenderId}`);
    // io.to(`match_${matchId}`).emit('battleInitiated', { matchId, attackerId, defenderId });
    
    // ...initiate the combat simulation via CombatManager
    console.log(`[GameManager ${matchId}] Initiating combat via CombatManager for ${attackerId} vs ${defenderId}`);
    CombatManager.initiateCombat(matchId, attackerId, defenderId, match);
    
    // Note: GameManager no longer broadcasts state here. 
    // CombatManager takes over state updates during combat.
    // GameManager will only broadcast again *after* combat is resolved via terminateCombat -> resolveCombat -> endTurn.
}

/** Checks if win conditions defined in the preset are met. */
// Remove unused checkWinConditions function
/*
function checkWinConditions(matchId: MatchId): boolean { 
    const gameState = getGameState(matchId);
    if (!gameState || gameState.isGameOver) return gameState?.isGameOver ?? true;

    const preset = presetService.getPresetById(gameState.presetId);
    if (!preset) { return false; }
    if (!Array.isArray(gameState.players) || gameState.players.length !== 2 || !gameState.players[0] || !gameState.players[1]) {
        return false; 
    }
    const [p1Id, p2Id] = gameState.players;

    const p1Units = gameState.units.filter(u => u.owner === p1Id);
    const p2Units = gameState.units.filter(u => u.owner === p2Id);

    let winner: PlayerId | null = null;

    // Check if a player has no units left (common condition)
    if (p1Units.length === 0 && p2Units.length > 0) winner = p2Id;
    else if (p2Units.length === 0 && p1Units.length > 0) winner = p1Id;

    // If no winner yet, check other preset conditions
    if (!winner) {
        for (const condition of preset.winConditions) {
            const { type, championUnitTypeId } = condition; 

            switch (type) {
                case 'eliminate_all':
                    // Already checked above, break to avoid re-checking
                    break; 

                case 'eliminate_champion':
                    if (typeof championUnitTypeId === 'string' && championUnitTypeId.length > 0) {
                        // Check if P1's champion is eliminated (making P2 the winner)
                        const p1ChampAlive = p1Units.some(u => u.typeId === championUnitTypeId);
                        if (!p1ChampAlive && p1Units.some(u=> u.typeId === championUnitTypeId)) { // Check if P1 *should* have this champ type
                             winner = p2Id; 
                             break; // Found winner
                        }
                        
                        // Check if P2's champion is eliminated (making P1 the winner)
                        const p2ChampAlive = p2Units.some(u => u.typeId === championUnitTypeId);
                        if (!p2ChampAlive && p2Units.some(u=> u.typeId === championUnitTypeId)) { // Check if P2 *should* have this champ type
                             winner = p1Id;
                             break; // Found winner
                        }
                    } else {
                        console.warn(`[GameManager] Win condition 'eliminate_champion' invalid ID in preset ${preset.id}.`);
                    }
                    break;
                
                case 'capture_points':
                    // TODO: Implement capture point logic
                    break;
            }
            if (winner) break; // Stop checking conditions if a winner is found
        }
    }

    // Handle winner declaration if found
    if (winner) {
        const confirmedWinner = winner;
        console.log(`[GameManager] Win Condition Met! Match ${matchId} ended. Winner: ${confirmedWinner}`);
        const finalState = updateGameState(matchId, { winner: confirmedWinner, isGameOver: true });
        if (finalState && finalState.winner === confirmedWinner) {
             emitGameOver(matchId, confirmedWinner); 
             return true; // Game ended
        } else {
             console.error(`[GameManager] Game ${matchId} win condition mismatch on state update.`);
             return true; // Treat as ended
        }
    } 
    return false; // Game did not end
}
*/

// --- Action Handling --- 

/**
 * Handles incoming actions from players during the strategy phase.
 * Routes the action to the appropriate handler based on actionType.
 */
// Update signature to use specific types
function handlePlayerAction(
    playerId: PlayerId, 
    matchId: MatchId, 
    actionType: PlayerActionType, 
    payload: PlayerActionPayloadUnion // Use the correctly derived payload union
): void {
    console.log(`[GameManager handlePlayerAction] Received:`, {playerId, matchId, actionType, payload }); // <-- TRACE LOG

    const gameState = getGameState(matchId)
    if (!gameState) {
        emitErrorToSocket(playerId, `Game not found: ${matchId}`, 'GAME_NOT_FOUND');
        return;
    }

    if (gameState.currentTurn !== playerId) {
        console.warn(`[Game ${matchId}] Action received from player ${playerId} but it is ${gameState.currentTurn}'s turn.`);
        emitErrorToSocket(playerId, "It's not your turn.");
        return;
    }

    try {
        switch (actionType) {
            case 'moveUnit':
                // Type guard to ensure payload is MoveActionPayload
                if (typeof payload === 'object' && payload !== null && 'unitId' in payload && 'targetPosition' in payload) {
                    // Reconstruct move logic here
                    const movePayload = payload as MoveActionPayload; // Assert type after check
                    const unitToMove = gameState.units.find(u => u.id === movePayload.unitId);
                    
                    if (!unitToMove) {
                        console.error(`[Game ${matchId}] Unit ${movePayload.unitId} not found for move action.`);
                        emitErrorToSocket(playerId, 'Invalid unit selected for move.');
                        return;
                    }
                    
                    const unitDef = gameState.unitDefinitions[unitToMove.typeId]; 
                    if (!unitDef) {
                        console.error(`[Game ${matchId}] Unit definition ${unitToMove.typeId} not found for unit ${unitToMove.id}.`);
                        emitErrorToSocket(playerId, 'Unit definition missing, cannot move.');
                        return;
                    }

                    if (isValidMove(gameState, playerId, unitToMove, movePayload.targetPosition, unitDef)) {
                        const targetPosition = movePayload.targetPosition;
                        const targetUnit = gameState.units.find(u => 
                            u.position.x === targetPosition.x && 
                            u.position.y === targetPosition.y
                        );

                        if (targetUnit && targetUnit.owner !== playerId) {
                            // --- Initiate Combat --- 
                            console.log(`[Game ${matchId}] Target is opponent ${targetUnit.id}. Initiating combat...`); 
                            
                            // Update attacker position *in memory* before initiating combat
                            // Note: This state change won't be broadcast until *after* combat resolution
                            const unitsWithAttackerMoved = gameState.units.map(u => 
                                u.id === unitToMove.id ? { ...u, position: targetPosition } : u
                            );
                            gameState.units = unitsWithAttackerMoved; // Update the state directly in the map
                            
                            resolveBattle(matchId, unitToMove.id, targetUnit.id);
                            // Turn advancement happens within resolveCombat -> endTurn flow
                        
                        } else if (!targetUnit) {
                            // --- Move to Empty Square --- 
                            console.log(`[Game ${matchId}] Moving unit ${unitToMove.id} to empty square (${targetPosition.x},${targetPosition.y}).`);
                            const updatedUnits = gameState.units.map(u => 
                                u.id === unitToMove.id ? { ...u, position: targetPosition } : u
                            );
                            // Update state and broadcast immediately
                            updateGameState(matchId, { units: updatedUnits });
                            // End the turn after a successful move to an empty square
                            endTurn(matchId, playerId); 
                        
                        } else {
                            // Target occupied by friendly unit - should have been caught by isValidMove
                            console.warn(`[Game ${matchId}] Move validation failed: Target occupied by friendly unit ${targetUnit.id}.`);
                            emitErrorToSocket(playerId, 'Cannot move onto a square occupied by your own unit.');
                        }
                    } else {
                        console.warn(`[Game ${matchId}] Invalid move attempt by ${playerId}.`);
                        emitErrorToSocket(playerId, 'Invalid move.');
                    }
                } else {
                    throw new Error('Invalid payload for moveUnit action.');
                }
                break;
            case 'endTurn':
                // No payload expected for endTurn, but check just in case
                if (typeof payload !== 'object' || Object.keys(payload).length !== 0) {
                    console.warn(`[Game ${matchId}] Received unexpected payload for endTurn action.`);
                }
                endTurn(matchId, playerId); 
                break;
            // Add cases for other strategy actions (e.g., useAbility)
            default:
                console.warn(`[Game ${matchId}] Unhandled action type: ${actionType}`);
                emitErrorToSocket(playerId, `Unknown action type: ${actionType}`);
        }
    } catch (error: unknown) {
        console.error(`[Game ${matchId}] Error handling action ${actionType} for player ${playerId}:`, error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred while processing your action.';
        emitErrorToSocket(playerId, message);
    }
}

// --- Combat Resolution Logic ---
function resolveCombat(
    matchId: MatchId,
    playerId: PlayerId,
    winnerId: GameObjectId,
    loserId: GameObjectId,
    winnerHp: number
): void {
    const match = activeGames.get(matchId);
    if (!match) {
        console.warn(`[GameManager ${matchId}] resolveCombat: Match not found.`);
        emitErrorToSocket(playerId, `Match ${matchId} not found during combat resolution.`); 
        return;
    }

    // Store whose turn it was *before* resolving
    const playerWhoseTurnItWas = match.currentTurn;

    console.log(`[GameManager ${matchId}] Resolving combat. Winner: ${winnerId} (HP: ${winnerHp}), Loser: ${loserId}.`);

    const loserIndex = match.units.findIndex(u => u.id === loserId);
    if (loserIndex === -1) {
        console.warn(`[GameManager ${matchId}] resolveCombat: Loser unit ${loserId} not found (already removed?).`);
        emitGameStateUpdate(matchId, match); 
        return; 
    }

    const loserUnit = match.units[loserIndex];
    if (!loserUnit) { 
        console.error(`[GameManager ${matchId}] resolveCombat: Found index for loser ${loserId} but unit was undefined?`);
        emitGameStateUpdate(matchId, match); 
        return;
    }
    
    console.log(`[GameManager ${matchId}] Removing unit ${loserUnit.typeId} (${loserId})`);
    match.units.splice(loserIndex, 1);

    // *** ADD THIS: Update winner's HP ***
    const winnerIndex = match.units.findIndex(u => u.id === winnerId);
    if (winnerIndex !== -1) {
        const winnerUnit = match.units[winnerIndex]; // Get the unit object
        // Check if winnerUnit actually exists
        if (winnerUnit) { 
            const winnerDef = match.unitDefinitions[winnerUnit.typeId]; // Use winnerUnit.typeId
            // Check if winnerDef actually exists
            if (winnerDef) { 
                const finalHp = Math.min(winnerHp, winnerDef.maxHp ?? winnerHp); // Can use winnerDef safely
                console.log(`[GameManager ${matchId}] Updating winner ${winnerId} HP to ${finalHp}`);
                winnerUnit.currentHp = finalHp; // Update the unit object directly
            } else {
                console.warn(`[GameManager ${matchId}] Could not find unit definition for winner ${winnerId} (type: ${winnerUnit.typeId}). Setting HP without max check.`);
                winnerUnit.currentHp = winnerHp; 
            }
        } else {
             console.error(`[GameManager ${matchId}] Found winner index ${winnerIndex} but unit object was undefined. State inconsistency.`);
        }
    } else {
        console.warn(`[GameManager ${matchId}] Winner unit ${winnerId} not found after removing loser? State inconsistency.`);
    }

    // --- End the turn --- 
    console.log(`[GameManager ${matchId}] Combat resolved. Ending turn for ${playerWhoseTurnItWas}.`);
    endTurn(matchId, playerWhoseTurnItWas); 
}

// --- End Turn Logic ---
// Ensure endTurn correctly broadcasts the state after updates
function endTurn(matchId: MatchId, playerId: PlayerId): void {
    const match = activeGames.get(matchId);
    if (!match) {
        // ... (error handling) ...
        return;
    }
    if (match.currentTurn !== playerId) {
        // ... (error handling - wrong player) ...
        return;
    }

    // Find the next player
    const currentPlayerIndex = match.players.indexOf(playerId);
    if (currentPlayerIndex === -1) {
        console.error(`[GameManager ${matchId}] Cannot end turn: Player ${playerId} not found in match players.`);
        emitErrorToSocket(playerId, 'Error ending turn: Player not found.');
        return;
    }

    const nextPlayerIndex = (currentPlayerIndex + 1) % match.players.length;
    const nextPlayerId = match.players[nextPlayerIndex];

    // Add check for safety, although nextPlayerId should always be valid here
    if (!nextPlayerId) {
        console.error(`[GameManager ${matchId}] Cannot end turn: Failed to determine next player ID from index ${nextPlayerIndex}.`);
        emitErrorToSocket(playerId, 'Error ending turn: Could not find next player.');
        // Maybe broadcast state here to show the error didn't proceed?
        emitGameStateUpdate(matchId, match);
        return;
    }

    match.currentTurn = nextPlayerId; // Assign the valid ID

    // Increment turn number if we wrapped back to the first player (index 0)
    if (nextPlayerIndex === 0) {
        match.turnNumber += 1;
        console.log(`[GameManager ${matchId}] Starting turn ${match.turnNumber}`);
    }

    console.log(`[GameManager ${matchId}] Turn ended for ${playerId}. Next turn: ${match.currentTurn}`);

    // --- DEBUG LOG: Check unit positions before broadcasting ---
    console.log(`[GameManager ${matchId}] State before broadcast in endTurn: Units:`, 
        JSON.stringify(match.units.map(u => ({ id: u.id, pos: u.position })), null, 2)
    );

    // Broadcast the updated state AFTER changing the turn
    emitGameStateUpdate(matchId, match); 
}

/** Updates the game state for a match and optionally saves it. */
function updateGameState(matchId: MatchId, newState: Partial<GameState>): GameState | undefined {
    const currentState = activeGames.get(matchId);
    if (!currentState) {
        console.error(`[GameManager] Attempted to update non-existent game state for match: ${matchId}`);
        return undefined;
    }
    const updatedState: GameState = { ...currentState, ...newState };
    activeGames.set(matchId, updatedState);
    console.log(`[GameManager] Game state updated for match: ${matchId}`);
    emitGameStateUpdate(matchId, updatedState); // Emit the full updated state
    return updatedState;
}

export const GameManager = {
  initialize,
  initializeGame,
  getGameState,
  handlePlayerAction,
  // Expose other functions needed by socket handlers or other services
  resolveCombat,
} 