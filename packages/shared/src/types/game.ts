// Unique identifier for a game preset
// export type PresetId = string;

import type { BoardConfig, UnitDefinition } from './game-presets';
import type { PresetId } from './common';

/** Defines the structure for a complete game preset */
export interface GamePreset {
    id: PresetId;
    name: string;
    description: string;
    board: BoardConfig;
    units: Record<string, UnitDefinition>;
    winConditions: WinCondition[];
    // Combat Arena dimensions
    arenaWidth: number;
    arenaHeight: number;
}

// Example WinCondition structure (can be expanded)
export interface WinCondition {
    type: 'eliminate_all' | 'eliminate_champion' | 'capture_points';
    // Optional properties based on type
    championUnitTypeId?: string; // For 'eliminate_champion'
    capturePointTileIds?: string[]; // For 'capture_points'
    pointsToWin?: number; // For 'capture_points'
} 