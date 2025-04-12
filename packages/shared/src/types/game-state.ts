import type { GridPosition, PlayerId, GameObjectId, PresetId } from './common'
import type { BoardConfig, UnitDefinition } from './game-presets'

// --- Game State --- Represents the current state of an active match

/** Defines a unit placed on the board */
export interface BoardUnit {
  id: GameObjectId
  typeId: string // Key to look up UnitDefinition in the preset
  owner: PlayerId
  position: GridPosition
  currentHp: number
  // Add other stateful properties if needed (e.g., status effects, cooldowns)
}

/** Represents the overall state of a single game match */
export interface GameState {
  matchId: string
  presetId: PresetId // ID of the preset used for this game
  boardConfig: BoardConfig // Copy of board config for easy access
  unitDefinitions: Record<string, UnitDefinition> // Copy of unit defs
  players: PlayerId[] // List of players (usually 2)
  currentTurn: PlayerId
  turnNumber: number
  units: BoardUnit[] // All units currently on the board
  winner: PlayerId | null
  isGameOver: boolean
  // Add other state as needed (e.g., captured points, game phase)
}

// --- Player Actions --- Inputs from the client

export interface MoveActionPayload {
  unitId: GameObjectId
  targetPosition: GridPosition
}

// Add other action payloads (e.g., UseAbilityActionPayload)

// --- Server Events --- Messages sent from server to clients

export type GameEventType = 'gameStateUpdate' | 'battleInitiated' | 'gameOver' | 'error'

export interface GameEvent<T = unknown> {
  type: GameEventType
  payload: T
}

export interface GameStateUpdateEvent extends GameEvent<Partial<GameState>> {
  type: 'gameStateUpdate'
}

export interface BattleInitiatedEvent extends GameEvent<{ attackerId: GameObjectId, defenderId: GameObjectId }> {
  type: 'battleInitiated'
}

export interface GameOverEvent extends GameEvent<{ winner: PlayerId | null }> {
  type: 'gameOver'
}

export interface ErrorEvent extends GameEvent<{ message: string; code?: string }> {
  type: 'error'
} 