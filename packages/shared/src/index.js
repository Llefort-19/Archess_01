"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Base types used across the application
__exportStar(require("./types/common"), exports);
// Combat simulation types
__exportStar(require("./types/combat"), exports);
// Game preset configuration types
__exportStar(require("./types/game-presets"), exports);
// Game state types for active matches
__exportStar(require("./types/game-state"), exports);
// Placeholder - remove later
// export interface Placeholder { value: string };
// Define core configurable types here later
// export * from './game-presets';
// export * from './game-state';
// export * from './units';
// ... etc. 
