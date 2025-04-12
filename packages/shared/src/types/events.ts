import type {
  GameState, MoveActionPayload
} from './game-state';
import type {
  CombatStateUpdatePayload, CombatActionPayload, MeleeHitEventPayload,
  CombatStartedEventPayload
} from './combat';
import type { GameObjectId, MatchId, /* PlayerId, */ PresetId } from './common';

// Add export keyword here
export interface ProjectileHitEventPayload {
    matchId: MatchId;
    projectileId: GameObjectId; // Specific ID for the projectile involved
    attackerId: GameObjectId;   // ID of the unit that launched the projectile
    targetId: GameObjectId;     // ID of the unit hit
    damageDealt: number;
    abilityId: string;        // ID of the ability used
}

// Add export keyword here
export interface CombatEndPayload {
    matchId: MatchId;
    winnerId: GameObjectId;
    loserId: GameObjectId;
    // Add winnerHp based on CombatManager usage
    winnerHp: number; 
}

// Define constants for event names (already partially done in client/server)
export const COMBAT_ACTION = 'combatAction';
export const COMBAT_STATE_UPDATE = 'combatStateUpdate';
export const COMBAT_STARTED = 'combatStarted';
export const COMBAT_END = 'combatEnd';
export const MELEE_HIT = 'meleeHit';
export const PROJECTILE_HIT = 'projectileHit';

// Server-to-Client Events
// Add export keyword here
export interface ServerToClientEvents {
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (err: Error) => void;
  message: (data: string) => void;
  matchCreated: (payload: { matchId: MatchId, presetId: PresetId }) => void;
  gameStateUpdate: (payload: GameState) => void;
  error: (error: { message: string; code?: string }) => void;

  // Combat specific events
  [COMBAT_STATE_UPDATE]: (payload: CombatStateUpdatePayload) => void;
  [COMBAT_STARTED]: (payload: CombatStartedEventPayload) => void;
  [COMBAT_END]: (payload: CombatEndPayload) => void;
  [MELEE_HIT]: (payload: MeleeHitEventPayload) => void;
  [PROJECTILE_HIT]: (payload: ProjectileHitEventPayload) => void;
}

// Client-to-Server Events
// Add export keyword here
export interface ClientToServerEvents {
  createMatch: (payload: { playerName: string, presetId: PresetId }) => void;
  joinMatch: (payload: { matchId: MatchId }) => void;
  playerAction: (payload: {
    matchId: MatchId;
    actionType: 'moveUnit' | 'endTurn' /* | Add other strategy actions */;
    payload: MoveActionPayload | Record<string, never> /* | Add other strategy payloads */ ;
  }) => void;
  [COMBAT_ACTION]: (payload: { matchId: MatchId, actionPayload: CombatActionPayload }) => void;
}
