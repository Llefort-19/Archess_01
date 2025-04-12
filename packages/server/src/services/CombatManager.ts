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
import type { Server as SocketIOServer } from 'socket.io'; // Import the type
import { CombatInstance } from './CombatInstance';
import { GameManager } from './GameManager';
import { presetService } from './PresetService';
// Import types and constants needed for COMBAT_STARTED event
import type { CombatStartedEventPayload } from '@archess/shared'; 
import { COMBAT_STARTED } from '@archess/shared'; 

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
        
        // Notify players that combat is starting
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
    console.log(`[CombatManager] handleCombatAction received for player ${playerId}, match ${matchId}, action ${action.type}`);
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

// --- Re-add the Export Block --- 
export const CombatManager = {
    initialize,
    initiateCombat,
    handleCombatAction,
    // terminateCombat is internal, not exported
    startCombatLoop, // Assuming startCombatLoop is defined
    stopCombatLoop,  // Assuming stopCombatLoop is defined
};