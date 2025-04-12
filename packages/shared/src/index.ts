// Base types used across the application
export * from './types/common'

// Combat simulation types
export { 
    // Explicitly list non-type combat exports if any (e.g., functions)
} from './types/combat'
export type { 
    // Export combat types using 'export type'
    Vector2, 
    CombatUnitState, 
    ProjectileState, 
    AoEZoneState,
    // Add missing combat-related types needed by events/App.tsx
    CombatStartedEventPayload,
    MeleeHitEventPayload,
    CombatActionPayload,
    CombatStateUpdatePayload
} from './types/combat'

// Game preset configuration types
export * from './types/game-presets'
export type { 
    // Use 'export type' for presets if they are only types
    TileDefinition, 
    BoardConfig, 
    AbilityDefinition, 
    MovementRule, 
    UnitDefinition 
} from './types/game-presets'

// Game state types for active matches
export * from './types/game-state'
export type { 
    // Use 'export type' for game state
    BoardUnit, 
    GameState, 
    MoveActionPayload, 
    GameEventType, 
    GameEvent, 
    GameStateUpdateEvent, 
    BattleInitiatedEvent, 
    GameOverEvent, 
    ErrorEvent 
} from './types/game-state'

// Placeholder - remove later
// export interface Placeholder { value: string };

// Define core configurable types here later
// export * from './game-presets';
// export * from './game-state';
// export * from './units';
// ... etc.

// Re-export types from different modules
export * from './types/game'
export type { 
    // Use 'export type' for game types
    GamePreset, 
    WinCondition 
} from './types/game'

// Optionally, re-export specific constants or utility functions if needed
// export * from './utils/constants';
// export * from './utils/helpers';

// Explicitly re-export event types using 'export type'
export type {
    ServerToClientEvents,
    ClientToServerEvents,
    ProjectileHitEventPayload,
    CombatEndPayload
} from './types/events';

// Export event constants (these are values, not types)
// This line exports all named exports (constants and interfaces)
// export * from './types/events'; 
// Explicitly re-export constants needed by other packages for robustness
export { 
    COMBAT_STATE_UPDATE, 
    MELEE_HIT,
    PROJECTILE_HIT, 
    COMBAT_END, 
    COMBAT_ACTION,
    COMBAT_STARTED 
} from './types/events'; 