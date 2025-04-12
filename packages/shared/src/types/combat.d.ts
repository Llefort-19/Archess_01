import type { PlayerId, GameObjectId, MatchId } from './common';
import type { Vector2 } from './common';
/** Detailed state of a unit within a real-time combat instance */
export interface CombatUnitState {
    id: GameObjectId;
    owner: PlayerId;
    definitionId: string;
    position: Vector2;
    velocity: Vector2;
    currentHp: number;
    abilityCooldowns: Record<string, number>;
}
/** State of an active projectile in combat */
export interface ProjectileState {
    id: GameObjectId;
    ownerId: GameObjectId;
    abilityId: string;
    position: Vector2;
    velocity: Vector2;
    damage: number;
    speed: number;
    rangeRemaining: number;
    targetPosition?: Vector2;
    targetType: 'enemy' | 'any';
    expiresAt: number;
    hitUnitIds: GameObjectId[];
    aoeRadius?: number;
    projectileTypeId?: string;
}
/** Payload for broadcasting the state of an active combat instance */
export interface CombatStateUpdatePayload {
    matchId: string;
    units: CombatUnitState[];
    projectiles: ProjectileState[];
}
export type CombatActionType = 'startMove' | 'stopMove' | 'basicAttack' | 'useAbility';
export interface BaseCombatActionPayload {
    type: CombatActionType;
}
export interface StartMoveCombatActionPayload extends BaseCombatActionPayload {
    type: 'startMove';
    direction: Vector2;
}
export interface StopMoveCombatActionPayload extends BaseCombatActionPayload {
    type: 'stopMove';
}
/** Action payload specifically for basic attacks */
export interface BasicAttackActionPayload {
    type: 'basicAttack';
    targetPosition?: Vector2;
}
export interface UseAbilityCombatActionPayload extends BaseCombatActionPayload {
    type: 'useAbility';
    abilityId: string;
    targetPosition?: Vector2;
    targetUnitId?: GameObjectId;
}
export type CombatActionPayload = StartMoveCombatActionPayload | StopMoveCombatActionPayload | BasicAttackActionPayload | UseAbilityCombatActionPayload;
/** Event signaling that combat has started for a match */
export interface CombatStartedEventPayload {
    matchId: MatchId;
    initialCombatState: CombatStateUpdatePayload;
    playerIds: PlayerId[];
    attackerUnitId: GameObjectId;
    defenderUnitId: GameObjectId;
}
/** Event payload when a melee attack successfully hits */
export interface MeleeHitEventPayload {
    matchId: MatchId;
    attackerId: GameObjectId;
    targetId: GameObjectId;
    abilityId: string;
    damageDealt: number;
}
export interface ICombatInstance {
    readonly matchId: MatchId;
    readonly playerIds: PlayerId[];
    readonly status: 'active' | 'terminating' | 'ended';
    readonly winnerId: GameObjectId | null;
    readonly loserId: GameObjectId | null;
    /** Processes queued inputs and advances the simulation state by deltaTime. */
    update(deltaTime: number): void;
    /** Queues an action from a player to be processed in the next update tick. */
    queueInputAction(playerId: PlayerId, action: CombatActionPayload): void;
    /** Returns a snapshot of the current combat state for broadcasting. */
    getCombatStateSnapshot(): CombatStateUpdatePayload;
    getUnitOwner(unitId: GameObjectId): PlayerId | undefined;
}
