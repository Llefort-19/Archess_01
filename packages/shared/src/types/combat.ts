import type { PlayerId, GameObjectId, MatchId } from './common';

// Basic 2D vector type
export interface Vector2 {
    x: number;
    y: number;
}

// --- Combat Simulation State ---

/** Detailed state of a unit within a real-time combat instance */
export interface CombatUnitState {
  id: GameObjectId;         // Matches the original BoardUnit ID
  owner: PlayerId;
  definitionId: string;     // To look up UnitDefinition
  position: Vector2;        // Position within the combat arena
  velocity: Vector2;        // Current movement vector
  currentHp: number;
  maxHp: number;
  facingDirection?: Vector2;   // Direction the unit is facing
  // Tracks remaining cooldown time (in seconds or ticks) for each ability
  abilityCooldowns: Record<string, number>; 
  // Add more state: current action (moving, attacking, idle), status effects, target ID?
  lastMovementDirection: Vector2 | null;
}

/** State of an active projectile in combat */
export interface ProjectileState {
  id: GameObjectId;         // Unique ID for this projectile instance
  ownerUnitId: GameObjectId; // Unit that fired it
  abilityId: string;         // Ability that created it (for visuals/effects/logic)
  projectileVisualKey?: string; // Optional: Visual key (e.g., 'fireball_bolt', 'arrow') - derived from AbilityDefinition
  position: Vector2;
  velocity: Vector2;
  speed?: number; // Optional: Store the speed for easier logic (e.g., boomerang return)
  damage?: number;
  // Match server usage
  projectileType: 'direct_projectile' | 'aoe_projectile' | 'boomerang_projectile'; 
  targetPosition?: Vector2; // For AoE or homing
  aoeRadius?: number;
  // Time projectile was created (ms since epoch)
  // createdAt: number; <-- Consider adding this?
  // Time projectile should expire (ms since epoch)
  expiresAt?: number;
  // For AoE projectiles: time impact occurs
  impactTime?: number;
  impactDelay?: number; // Delay used for AoE zones
  zoneCreated?: boolean; // Flag for AoE projectiles
  // For boomerangs
  startPosition?: Vector2;
  maxRange?: number;
  boomerangState?: 'outbound' | 'returning';
  // Tracking hits for multi-hit projectiles (like boomerang hitting multiple targets or same target twice)
  maxHitsPerUnit?: number;
  unitsHitThisThrow: Record<GameObjectId, number>; // Count hits per unit ID for this throw
  hitCooldowns: { [unitId: GameObjectId]: number }; // Timestamp when a unit can be hit again by this specific projectile
  targetUnitId?: GameObjectId; // Can be useful for homing logic
}

/** State of an active Area of Effect zone on the ground */
export interface AoEZoneState {
    id: GameObjectId;         // Unique ID for this zone instance
    ownerUnitId: GameObjectId; // Unit that created it
    abilityId: string;         // Ability that created it
    position: Vector2;        // Center of the AoE circle
    radius: number;
    endTime: number;          // Timestamp (ms) when the zone expires
    damagePerTick?: number;   // Damage applied each tick (if any)
    tickInterval?: number;    // Interval (ms) for damage ticks (if damagePerTick)
    unitsCurrentlyInside: Set<GameObjectId>; // Units inside during the last check
    // Optional visual effect identifier?
    visualEffectKey?: string;
}

/** Payload for broadcasting the state of an active combat instance */
export interface CombatStateUpdatePayload {
  matchId: string; // Identify which combat this update is for
  units: CombatUnitState[];
  projectiles: ProjectileState[];
  activeAoEZones: AoEZoneState[]; // <-- Add active AoE zones
  // Add more: environment state, score, timer?
}

// --- Combat Actions (Client -> Server) ---

export type CombatActionType = 
  | 'startMove' 
  | 'stopMove' 
  | 'basicAttack' // Might need target coords/id
  | 'useAbility'; // Needs ability ID + target coords/id

// Base interface for all combat actions
export interface BaseCombatActionPayload {
  type: CombatActionType;
}

export interface StartMoveCombatActionPayload extends BaseCombatActionPayload {
  type: 'startMove';
  // Direction vector - server calculates velocity based on unit speed
  // Normalized direction is often preferred
  direction: Vector2; 
}

export interface StopMoveCombatActionPayload extends BaseCombatActionPayload {
  type: 'stopMove';
}

/** Action payload specifically for basic attacks */
export interface BasicAttackActionPayload {
    type: 'basicAttack';
    targetPosition?: Vector2; // Make optional
}

export interface UseAbilityCombatActionPayload extends BaseCombatActionPayload {
  type: 'useAbility';
  abilityId: string;
  targetPosition?: Vector2;
  targetUnitId?: GameObjectId;
}

// Union type for all possible combat action payloads
export type CombatActionPayload = 
  | StartMoveCombatActionPayload
  | StopMoveCombatActionPayload
  | BasicAttackActionPayload
  | UseAbilityCombatActionPayload;

// --- Combat Events (Server -> Client) ---

/** Event signaling that combat has started for a match */
export interface CombatStartedEventPayload {
    matchId: MatchId;
    initialCombatState: CombatStateUpdatePayload;
    // Include player IDs involved if needed by client immediately
    playerIds: PlayerId[];
    attackerUnitId: GameObjectId;
    defenderUnitId: GameObjectId;
}

/** Event payload when a melee attack successfully hits */
export interface MeleeHitEventPayload {
    matchId: MatchId;
    attackerId: GameObjectId;
    targetId: GameObjectId;
    abilityId: string; // e.g., 'sword_swing'
    damageDealt: number;
}

// --- Combat Instance Interface (for dependency injection / decoupling) ---

export interface ICombatInstance {
    readonly matchId: MatchId;
    readonly playerIds: PlayerId[];
    readonly status: 'active' | 'terminating' | 'ended';
    readonly winnerId: GameObjectId | null;
    readonly loserId: GameObjectId | null;
    // readonly combatUnits: Map<GameObjectId, CombatUnitState>; // Maybe don't expose map directly
    // readonly projectiles: ProjectileState[]; // Maybe don't expose array directly

    /** Processes queued inputs and advances the simulation state by deltaTime. */
    update(deltaTime: number): void;

    /** Queues an action from a player to be processed in the next update tick. */
    queueInputAction(playerId: PlayerId, action: CombatActionPayload): void;

    /** Returns a snapshot of the current combat state for broadcasting. */
    getCombatStateSnapshot(): CombatStateUpdatePayload;

    // Method to get the owner of a specific unit within the combat
    getUnitOwner(unitId: GameObjectId): PlayerId | undefined;
} 