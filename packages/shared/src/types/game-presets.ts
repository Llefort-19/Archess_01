import type { GridPosition } from './common'

// --- Configurable Game Elements --- Define the structure of a game variant preset

/** Properties of a specific tile type (e.g., grass, mountain, power point) */
export interface TileDefinition {
  id: string // e.g., 'grass', 'mountain', 'power_point_light', 'power_point_dark'
  name: string
  // visualKey: string; // Key for client-side rendering
  isWalkable: boolean
  movementCost?: number // Optional: cost modifier for units moving onto this tile
  // Add other properties like defensive bonus, special effects trigger, etc.
}

/** Configuration for the game board */
export interface BoardConfig {
  width: number
  height: number
  /** Map of tile IDs to their definitions */
  tileDefinitions: Record<string, TileDefinition>
  /** 2D array representing the board layout, referencing tile IDs */
  layout: string[][] // e.g., layout[y][x] = 'grass'
  /** Starting positions for player 1 units (map unit type ID to position) */
  player1StartPositions: Record<string, GridPosition>
  /** Starting positions for player 2 units */
  player2StartPositions: Record<string, GridPosition>
  // Add other board-specific rules, like capture points, special zones, etc.
}

/** 
 * Definition for a unit ability or attack.
 * Used in UnitDefinition.strategyAbilities and UnitDefinition.combatAbilities.
 */
export interface AbilityDefinition {
  id: string // e.g., 'basic_melee', 'fireball_aoe', 'returning_axe', 'teleport'
  name: string
  /** Broad category of the ability */
  type: 'attack' | 'support' | 'movement' | 'passive' 
  description: string

  // --- Combat Attack Specifics (only relevant if type is 'attack') ---
  /** Detailed type of the attack mechanism */
  attackType?: 'melee' | 'direct_projectile' | 'aoe_projectile' | 'boomerang_projectile'

  /** Base damage value */
  damage?: number 

  /** 
   * Meaning depends on attackType:
   * - melee: Max distance from attacker's edge to target's edge.
   * - direct_projectile: Max travel distance.
   * - aoe_projectile: Max distance to the center of the AoE target position.
   * - boomerang_projectile: Max distance the projectile travels *outward*.
   */
  range?: number 

  /** Time between consecutive uses of this ability (in milliseconds) */
  cooldown?: number 

  // --- Projectile Specifics (relevant for direct, aoe, boomerang) ---
  /** Speed of the projectile (units per second) */
  projectileSpeed?: number 
  /** Visual key for the projectile (e.g., 'arrow', 'fireball', 'axe_spin') */
  projectileVisualKey?: string;

  // --- AoE Specifics (relevant for aoe_projectile) ---
  /** Radius of the Area of Effect circle */
  aoeRadius?: number 
  /** Duration the AoE persists on the ground (in milliseconds) */
  aoeDuration?: number 
  /** Damage applied per tick to units within the AoE (optional) */
  aoeDamagePerTick?: number 
  /** Time between firing and the AoE appearing (e.g., projectile travel time, in milliseconds) */
  impactDelay?: number 

  // --- Boomerang Specifics (relevant for boomerang_projectile) ---
  /** Max times a single unit can be hit by one boomerang throw (default: 1) */
  maxHitsPerUnit?: number 

  // --- Melee Specifics (relevant for melee) ---
  /** Duration of the swing animation (for client-side visuals, in milliseconds) */
  swingDuration?: number;

  // --- Strategy related --- (apply if type affects strategy map, e.g., 'support' or 'movement')
  strategyRange?: number // e.g., range of a heal spell on the board
  
  // Potential future additions: energy cost, cast time, effects (stun, burn), requirements, etc.

  healAmount?: number;
}

/** Movement rules for a unit on the strategy map */
export interface MovementRule {
  type: 'walk' | 'fly' // Add more types like 'teleport', 'burrow'
  /** Max distance per turn (adjusted by tile costs if applicable) */
  distance: number
  // Flags for special movement interactions
  ignoresTerrainCost?: boolean // e.g., for flying units
  canStopOnOccupied?: boolean // Usually false, except maybe special cases
}

/** Definition for a type of unit */
export interface UnitDefinition {
  id: string // e.g., 'knight', 'goblin', 'wizard'
  name: string
  // visualKey: string; // Key for client-side rendering (sprite, model)
  description: string
  // --- Stats --- 
  maxHp: number
  // Combat-specific speed (pixels/second or abstract units/second)
  combatSpeed: number
  // Add other stats: armor, resistances, energy/mana, etc.
  // --- Strategy Map --- 
  movement: MovementRule
  // --- Abilities/Attacks --- 
  /** Abilities available on the strategy map */
  strategyAbilities?: AbilityDefinition[]
  /** Abilities/attacks available during real-time combat */
  combatAbilities: AbilityDefinition[]
  // Optional: Cost to include this unit in an army (if using point-buy system)
  cost?: number
  // Visual/rendering key?
  visualKey?: string;
  // Combat hitbox size
  hitboxRadius: number;
  movementSpeed: number;
}

// --- Game Instance State --- Represents the actual state of a running game
// (Consider moving this to a separate file like `game-state.ts` if it grows) 