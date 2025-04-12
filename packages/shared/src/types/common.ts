export type PlayerId = string // Typically socket ID or a persistent user ID
export type GameObjectId = string // Unique ID for units, etc.
export type MatchId = string
export type PresetId = string
 
export interface GridPosition {
  x: number
  y: number
}

/** Represents a 2D vector or position, often used in combat */
/*
export interface Vector2 {
  x: number
  y: number
}
*/

// ... rest of file ... 