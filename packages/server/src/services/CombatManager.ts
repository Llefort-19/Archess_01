import type {
    MatchId, 
    GameObjectId, 
    PlayerId, 
    CombatActionPayload, 
    GameState, 
    CombatEndPayload // Add this import
    // ICombatInstance, // Remove - likely server-only interface
    // CombatStartedEventPayload // Remove - Not exported
} from '@archess/shared';
import { COMBAT_END } from '@archess/shared'; // Add this import
import type { Server as SocketIOServer, Socket } from 'socket.io'; // Import the type and Socket
import { CombatInstance } from './CombatInstance';
import { GameManager } from './GameManager';
import { presetService } from './PresetService';
// Import types and constants needed for COMBAT_STARTED event
import type { CombatStartedEventPayload, ClientToServerEvents, ServerToClientEvents } from '@archess/shared'; 
import { COMBAT_STARTED, COMBAT_ACTION } from '@archess/shared'; 

const activeCombats: Map<MatchId, CombatInstance> = new Map();
const COMBAT_TICK_RATE_HZ = 20; // Example: 20 ticks per second
const COMBAT_TICK_INTERVAL_MS = 1000 / COMBAT_TICK_RATE_HZ;

let combatLoopInterval: NodeJS.Timeout | null = null;
let ioInstance: SocketIOServer | null = null; // Add variable to hold the io instance

/** Initializes the CombatManager with the Socket.IO server instance. */
function initialize(io: SocketIOServer): void {
    console.log("[CombatManager] Initializing with IO instance.");
    if (ioInstance) {
        console.warn("[CombatManager] Already initialized.");
        return;
    }
    ioInstance = io;
}

/** Initiates a new real-time combat simulation. */
function initiateCombat(
    matchId: MatchId, 
    attackerId: GameObjectId, 
    defenderId: GameObjectId, 
    initialGameState: GameState
): CombatInstance {
    if (activeCombats.has(matchId)) {
        console.warn(`[CombatManager] Combat already active for match ${matchId}`);
        return activeCombats.get(matchId)!; // Return existing instance
    }

    console.log(`[CombatManager] Initiating combat for match ${matchId} between ${attackerId} and ${defenderId}`);
    
    try {
        // Get preset to extract arena dimensions
        const preset = presetService.getPresetById(initialGameState.presetId);
        if (!preset) {
            throw new Error(`Cannot initiate combat: Preset ${initialGameState.presetId} not found.`);
        }

        const combatInstance = new CombatInstance(
            matchId,
            attackerId,
            defenderId,
            initialGameState,
            terminateCombat, // Pass terminate callback
            ioInstance!, // Pass Socket.IO server instance
            preset.arenaWidth || 600, // Default width or from preset
            preset.arenaHeight || 400 // Default height or from preset
        );
        activeCombats.set(matchId, combatInstance);
        
        // Notify players that combat is starting & ATTACH LISTENERS
        if (ioInstance) {
            const initialCombatState = combatInstance.getCombatStateSnapshot();
            const payload: CombatStartedEventPayload = {
                matchId,
                initialCombatState,
                attackerUnitId: attackerId,
                defenderUnitId: defenderId,
                playerIds: combatInstance.playerIds 
            };
            console.log(`[CombatManager] Emitting ${COMBAT_STARTED} for match ${matchId}`);
            ioInstance.to(matchId).emit(COMBAT_STARTED, payload);

            // --- Attach Combat Action Listeners --- 
            combatInstance.playerIds.forEach(playerId => {
                // Find the socket associated with this playerId
                // We might need a better way to map playerId to socket, 
                // but for now, assume GameManager or LobbyManager can provide it,
                // or we search the io instance.
                const playerSocket = findSocketByPlayerId(playerId); // Need to implement findSocketByPlayerId

                if (playerSocket) {
                    console.log(`[CombatManager] Attaching '${COMBAT_ACTION}' listener for ${playerId} in match ${matchId}`);
                    // Ensure we don't attach multiple listeners
                    // playerSocket.removeAllListeners('combatAction'); // <-- Keep commented out

                    // Use the imported constant for the event name
                    playerSocket.on(COMBAT_ACTION, ({ matchId: receivedMatchId, actionPayload }) => {
                        // Double-check the matchId from the event payload
                        if (receivedMatchId !== matchId) return; 
                        
                        // Re-add the log that was in index.ts
                        // console.log(`[CombatManager] Received combatAction from ${playerSocket.id} (Player: ${playerId}). Match: ${matchId}, Payload:`, actionPayload); // <-- REMOVE LOG
                        
                        // Basic validation (can enhance later)
                        if (!actionPayload || !actionPayload.type) {
                            console.warn(`[CombatManager Socket ${playerSocket.id}] Invalid combatAction payload: Missing type.`, { receivedMatchId, actionPayload });
                            playerSocket.emit('error', { message: 'Invalid combat action payload: Missing type.' });
                            return;
                        }
                        
                        // Forward to the actual handler function
                        handleCombatAction(playerId, matchId, actionPayload as CombatActionPayload);
                    });

                    // --- REMOVE LISTENER CHECK LOG --- 
                    // const listenerCount = playerSocket.listenerCount(COMBAT_ACTION);
                    // console.log(`[CombatManager] Listener count for ${COMBAT_ACTION} on socket ${playerSocket.id} (Player: ${playerId}): ${listenerCount}`);
                    // --- END REMOVE LISTENER CHECK LOG ---
                } else {
                    console.error(`[CombatManager] Could not find socket for player ${playerId} to attach combat listener.`);
                }
            });
            // --- End Listener Attachment ---

        } else {
            console.error(`[CombatManager] Cannot emit ${COMBAT_STARTED}: IO instance not initialized.`);
        }

        return combatInstance;
    } catch (error) {
        console.error(`[CombatManager] Error initiating combat for match ${matchId}:`, error);
        // Handle error appropriately, maybe notify clients
        throw error; // Re-throw or handle
    }
}

/** Handles incoming combat actions from players. */
function handleCombatAction(playerId: PlayerId, matchId: MatchId, action: CombatActionPayload): void {
    // --- REMOVE LOG HERE --- 
    // console.log(`[CombatManager HANDLE_COMBAT_ACTION_ENTRY] Received for player ${playerId}, match ${matchId}, action:`, action);
    // --- END REMOVE LOG ---

    const combatInstance = activeCombats.get(matchId);
    if (!combatInstance) {
        console.warn(`[CombatManager] Received combat action for inactive/non-existent combat: ${matchId}`);
        return;
    }
    // TODO: Add validation: does playerId belong to this combat?
    combatInstance.queueInputAction(playerId, action);
}

/** Callback for CombatInstance to signal its end and update GameManager. */
function terminateCombat(matchId: MatchId, winnerId: GameObjectId, loserId: GameObjectId, winnerHp: number): void {
    console.log(`[CombatManager] Terminating combat for match ${matchId}. Winner: ${winnerId}, Loser: ${loserId}`);
    const combatInstance = activeCombats.get(matchId);
    if (combatInstance) {
        console.log(`[CombatManager] terminateCombat: Removing combat instance ${matchId} from activeCombats.`);
        
        // Get winner player ID *before* deleting instance
        const winnerPlayerId = combatInstance.getUnitOwner(winnerId);
        
        activeCombats.delete(matchId);
        console.log(`[CombatManager] Active combat instance for ${matchId} removed.`);
        
        // Update the main game state via GameManager using resolveCombat
        if (winnerPlayerId) {
            GameManager.resolveCombat(matchId, winnerPlayerId, winnerId, loserId, winnerHp);
        } else {
            console.error(`[CombatManager] Could not determine winner player ID for match ${matchId}. Cannot resolve combat in GameManager.`);
            // Consider fallback or error emission
        }

        // Emit combatEnded event
        if (ioInstance) {
            console.log(`[CombatManager] Emitting combatEnded for match ${matchId}.`);
            const combatEndPayload: CombatEndPayload = { matchId, winnerId, loserId, winnerHp };
            ioInstance.to(matchId).emit(COMBAT_END, combatEndPayload); // Use constant and payload
        }

        // Inform GameManager or LobbyManager about combat end
        // GameManager.endMatch(matchId, winnerId); // Example call - Consider if needed

        // Remove combat instance after a short delay?
        // Commenting out the immediate deletion and timeout for now
        // activeCombats.delete(matchId);
        // setTimeout(() => activeCombats.delete(matchId), 5000);

        // Send final state? Or rely on GameManager state update?
        // Maybe update GameState with final HPs?
        // Removed getUnitState references as they were incorrect
        // if (winnerState) GameManager.updateUnitHp(matchId, winnerId, winnerState.currentHp); // Example update
        // if (loserState) GameManager.updateUnitHp(matchId, loserId, loserState.currentHp); // Example update
        
        // Inform connected players about combat end
        // combatInstance.playerIds.forEach((playerId: PlayerId) => { // <-- Removed this loop as combatEnded event is emitted
            // Could send a specific 'combat_over' event or rely on client seeing combat end event
            // console.log(`[CombatManager] Informing player ${playerId} about combat end for match ${matchId}`);
        // });

    } else {
        console.warn(`[CombatManager] Attempted to terminate non-existent combat instance: ${matchId}`);
    }
}

/** The main combat simulation loop. */
function combatLoopTick(): void {
    const deltaTime = COMBAT_TICK_INTERVAL_MS / 1000; // Convert ms to seconds

    if (activeCombats.size === 0) return; // Don't loop if no combats are active

    activeCombats.forEach((instance, matchId) => {
        try {
            // Check if instance is still valid (might have been terminated by callback)
            if (activeCombats.has(matchId) && instance.status === 'active') { 
                instance.update(deltaTime);
                // Broadcast state after update only if still active
                if (activeCombats.has(matchId)) { 
                     // Removed redundant broadcast call - CombatInstance handles broadcasting
                     // broadcastCombatState(matchId, instance.getCombatStateSnapshot());
                }
            }
            // Termination is handled by the callback from CombatInstance now
        } catch (error) {
            console.error(`[CombatManager] Error updating combat instance for match ${matchId}:`, error);
            // Optionally remove faulty instance
            // activeCombats.delete(matchId);
        }
    });
}

/** Starts the global combat simulation loop. */
function startCombatLoop(): void {
    if (combatLoopInterval) {
        console.warn("[CombatManager] Combat loop already running.");
        return;
    }
    console.log(`[CombatManager] Starting combat loop (Tick Interval: ${COMBAT_TICK_INTERVAL_MS}ms)`);
    combatLoopInterval = setInterval(combatLoopTick, COMBAT_TICK_INTERVAL_MS);
}

/** Stops the global combat simulation loop. */
function stopCombatLoop(): void {
    if (combatLoopInterval) {
        console.log("[CombatManager] Stopping combat loop.");
        clearInterval(combatLoopInterval);
        combatLoopInterval = null;
    }
}

// --- Helper Function to Find Socket (Needs Implementation) --- 
// This is a placeholder - the actual implementation might need access
// to a global map or rely on GameManager/LobbyManager.
function findSocketByPlayerId(playerId: PlayerId): Socket<ClientToServerEvents, ServerToClientEvents> | undefined {
    if (!ioInstance) return undefined;
    // This is inefficient for large numbers of connections, but works for now
    // It requires the playerId to be stored on the socket object, 
    // e.g., socket.data.playerId = playerId; when the player connects/joins.
    for (const [_, socket] of ioInstance.sockets.sockets) {
        // Assuming playerId is stored in socket.data.playerId
        if (socket.data.playerId === playerId) { 
            return socket;
        }
    }
    // console.warn(`[findSocketByPlayerId] Socket not found for playerId: ${playerId}`); // <-- REMOVE LOG
    return undefined;
}

// --- Re-add the Export Block --- 
export const CombatManager = {
    initialize,
    initiateCombat,
    handleCombatAction,
    // terminateCombat is internal, not exported
    startCombatLoop, // Assuming startCombatLoop is defined
    stopCombatLoop,  // Assuming stopCombatLoop is defined
};