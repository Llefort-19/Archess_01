import type { GridPosition, PresetId } from './common';
/** Properties of a specific tile type (e.g., grass, mountain, power point) */
export interface TileDefinition {
    id: string;
    name: string;
    isWalkable: boolean;
    movementCost?: number;
}
/** Configuration for the game board */
export interface BoardConfig {
    width: number;
    height: number;
    /** Map of tile IDs to their definitions */
    tileDefinitions: Record<string, TileDefinition>;
    /** 2D array representing the board layout, referencing tile IDs */
    layout: string[][];
    /** Starting positions for player 1 units (map unit type ID to position) */
    player1StartPositions: Record<string, GridPosition>;
    /** Starting positions for player 2 units */
    player2StartPositions: Record<string, GridPosition>;
}
/** Base definition for a unit ability or attack */
export interface AbilityDefinition {
    id: string;
    name: string;
    type: 'attack' | 'support' | 'movement' | 'passive';
    description: string;
    attackType: 'melee' | 'projectile';
    damage?: number;
    range: number;
    projectileSpeed?: number;
    cooldown?: number;
    areaOfEffect?: 'single' | 'line' | 'radius';
    aoeRadius?: number;
    strategyRange?: number;
}
/** Movement rules for a unit on the strategy map */
export interface MovementRule {
    type: 'walk' | 'fly';
    /** Max distance per turn (adjusted by tile costs if applicable) */
    distance: number;
    ignoresTerrainCost?: boolean;
    canStopOnOccupied?: boolean;
}
/** Definition for a type of unit */
export interface UnitDefinition {
    id: string;
    name: string;
    description: string;
    maxHp: number;
    combatSpeed: number;
    movement: MovementRule;
    /** Abilities available on the strategy map */
    strategyAbilities?: AbilityDefinition[];
    /** Abilities/attacks available during real-time combat */
    combatAbilities: AbilityDefinition[];
    cost?: number;
    visualKey?: string;
    hitboxRadius: number;
}
/** Win condition definition */
export interface WinCondition {
    type: 'eliminate_all' | 'eliminate_champion' | 'capture_points';
    /** ID of the unit type to eliminate (if type is 'eliminate_champion') */
    championUnitTypeId?: string;
    /** List of required capture point tile IDs (if type is 'capture_points') */
    capturePointTileIds?: string[];
    /** Number of points required to win */
    pointsToWin?: number;
}
/** The complete definition of a game variant */
export interface GamePreset {
    id: PresetId;
    name: string;
    description: string;
    board: BoardConfig;
    /** Map of unit type IDs to their definitions */
    units: Record<string, UnitDefinition>;
    winConditions: WinCondition[];
}
