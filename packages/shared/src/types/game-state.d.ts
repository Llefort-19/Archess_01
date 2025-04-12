import type { GridPosition, PlayerId, GameObjectId, PresetId } from './common';
import type { BoardConfig, UnitDefinition } from './game-presets';
/** Defines a unit placed on the board */
export interface BoardUnit {
    id: GameObjectId;
    typeId: string;
    owner: PlayerId;
    position: GridPosition;
    currentHp: number;
}
/** Represents the overall state of a single game match */
export interface GameState {
    matchId: string;
    presetId: PresetId;
    boardConfig: BoardConfig;
    unitDefinitions: Record<string, UnitDefinition>;
    players: PlayerId[];
    currentTurn: PlayerId;
    turnNumber: number;
    units: BoardUnit[];
    winner: PlayerId | null;
    isGameOver: boolean;
}
export interface MoveActionPayload {
    unitId: GameObjectId;
    targetPosition: GridPosition;
}
export type GameEventType = 'gameStateUpdate' | 'battleInitiated' | 'gameOver' | 'error';
export interface GameEvent<T = unknown> {
    type: GameEventType;
    payload: T;
}
export interface GameStateUpdateEvent extends GameEvent<Partial<GameState>> {
    type: 'gameStateUpdate';
}
export interface BattleInitiatedEvent extends GameEvent<{
    attackerId: GameObjectId;
    defenderId: GameObjectId;
}> {
    type: 'battleInitiated';
}
export interface GameOverEvent extends GameEvent<{
    winner: PlayerId | null;
}> {
    type: 'gameOver';
}
export interface ErrorEvent extends GameEvent<{
    message: string;
    code?: string;
}> {
    type: 'error';
}
