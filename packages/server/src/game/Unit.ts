import type { Vector2, UnitDefinition, CombatUnitState, AbilityDefinition } from "@archess/shared";
// import { GameState } from "@archess/shared"; // Remove unused import

export class Unit {
    id: string;

    typeId: string;

    owner: string;

    position: Vector2;

    velocity: Vector2 = { x: 0, y: 0 };

    intendedDirection: Vector2 = { x: 0, y: 0 }; // Store intended direction separate from velocity

    lastMovementDirection: Vector2 | null = null; // Store last non-zero movement

    facingDirection: Vector2 = { x: 1, y: 0 }; // Default facing right

    currentHp: number;

    maxHp: number;

    definition: UnitDefinition; // Store the full definition

    // Cooldowns stored as timestamp when ability becomes available
    abilityCooldowns: Record<string, number> = {};

    constructor(id: string, typeId: string, owner: string, definition: UnitDefinition, initialHp?: number) {
        this.id = id;
        this.typeId = typeId;
        this.owner = owner;
        this.definition = definition;
        this.maxHp = definition.maxHp;
        this.currentHp = initialHp ?? definition.maxHp;
        this.position = { x: 0, y: 0 }; // Initial position will be set by CombatInstance
        // Initialize cooldowns
        definition.combatAbilities.forEach((ab: AbilityDefinition) => {
            this.abilityCooldowns[ab.id] = 0; // Available immediately
        });
    }

    update(deltaTime: number): void { // Removed unused currentTime
        // Basic physics update (can be expanded)
        const moveX = this.velocity.x * deltaTime;
        const moveY = this.velocity.y * deltaTime;
        this.position.x += moveX;
        this.position.y += moveY;

        // Update facing direction based on velocity if moving
        if (this.velocity.x !== 0 || this.velocity.y !== 0) {
            this.facingDirection = normalize(this.velocity); 
            this.lastMovementDirection = this.facingDirection;
        } else if (!this.lastMovementDirection) {
             // If never moved, keep default or set based on initial setup
             this.facingDirection = { x: 1, y: 0 }; 
        } else {
            // If stopped, keep last facing direction
            this.facingDirection = this.lastMovementDirection;
        }

        // Update cooldowns (moved to CombatInstance)
        // for (const abilityId in this.abilityCooldowns) {
        //     if (this.abilityCooldowns[abilityId] > 0) {
        //         this.abilityCooldowns[abilityId] = Math.max(0, this.abilityCooldowns[abilityId] - deltaTime * 1000); // Decrement in ms
        //     }
        // }
    }

    // Simplified state for combat simulation
    getCombatState(): CombatUnitState {
        return {
            id: this.id,
            owner: this.owner,
            definitionId: this.typeId, // Use definitionId as per shared type
            position: this.position,
            velocity: this.velocity,
            currentHp: this.currentHp,
            maxHp: this.maxHp, // Ensure maxHp is included
            lastMovementDirection: this.lastMovementDirection,
            facingDirection: this.facingDirection, // Ensure facingDirection is included
            abilityCooldowns: this.abilityCooldowns
        };
    }
}

// Helper function (consider moving to utils)
function normalize(vec: Vector2): Vector2 {
    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    if (len === 0) return { x: 0, y: 0 }; // Avoid division by zero
    return { x: vec.x / len, y: vec.y / len };
} 