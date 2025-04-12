import type { 
    MatchId, 
    GameObjectId, 
    PlayerId, 
    GameState,
    CombatActionPayload,
    // UseAbilityCombatActionPayload, // <-- Comment out to silence linter for now
    // StopMoveCombatActionPayload, // <-- Comment out
    // StartMoveCombatActionPayload, // <-- Comment out
    CombatUnitState,
    CombatStateUpdatePayload,
    ProjectileState,
    Vector2,
    UnitDefinition,
    // ICombatInstance, // Remove - likely server-only interface
    AbilityDefinition,
    MeleeHitEventPayload,
    AoEZoneState,
    ProjectileHitEventPayload,
    // UseAbilityActionPayload // Remove incorrect type
} from '@archess/shared';
import { COMBAT_STATE_UPDATE, MELEE_HIT, PROJECTILE_HIT } from '@archess/shared';
import type { Server as SocketIOServer } from 'socket.io'; // Remove unused Socket import
// import { ServerEvents } from '@archess/shared'; // <-- Comment out old import

// Type for the callback to signal combat end
type TerminateCombatCallback = (matchId: MatchId, winnerId: GameObjectId, loserId: GameObjectId, winnerHp: number) => void;

// Helper function for vector math (can be moved to a utils file)
function normalize(vec: Vector2): Vector2 {
    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: vec.x / len, y: vec.y / len };
}

function distanceSq(pos1: Vector2, pos2: Vector2): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return dx * dx + dy * dy;
}

// Add scale function back
function scale(vec: Vector2, scalar: number): Vector2 {
    return { x: vec.x * scalar, y: vec.y * scalar };
}

// --- NEW Helper --- 
function rotateVector(vec: Vector2, angleRad: number): Vector2 {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    return {
        x: vec.x * cosA - vec.y * sinA,
        y: vec.x * sinA + vec.y * cosA
    };
}
// --- End NEW Helper ---

// Implement the interface (Removed ICombatInstance as it's not exported)
export class CombatInstance /* implements ICombatInstance */ {
    matchId: MatchId;

    playerIds: PlayerId[] = [];

    combatUnits = new Map<GameObjectId, CombatUnitState>();

    projectiles = new Map<GameObjectId, ProjectileState>();

    // Add state for active AoE zones
    private activeAoEZones = new Map<GameObjectId, AoEZoneState & { _lastTickTime?: number }>();

    status: 'active' | 'terminating' | 'ended' = 'active';

    winnerId: GameObjectId | null = null;

    loserId: GameObjectId | null = null;

    private terminateCallback: TerminateCombatCallback;

    private unitDefinitions: Record<string, UnitDefinition>; // Store for quick lookup

    private queuedInputs = new Map<PlayerId, CombatActionPayload[]>();

    // Add map to track intended movement direction
    private unitIntendedDirections = new Map<GameObjectId, Vector2>();

    private io: SocketIOServer; // Store the IO instance

    private readonly player1Id: PlayerId; // Explicitly store Player 1's ID

    // Add properties for arena dimensions
    private readonly arenaWidth: number;

    private readonly arenaHeight: number;

    constructor(
        matchId: MatchId, 
        attackerId: GameObjectId, 
        defenderId: GameObjectId, 
        initialGameState: GameState,
        _terminateCallback: TerminateCombatCallback, // <-- Ensure underscore prefix is present
        io: SocketIOServer, // Pass IO instance
        arenaWidth: number, // Add arena dimensions params
        arenaHeight: number
    ) {
        // console.log(`[CombatInstance:${matchId}] Initializing...`); // REMOVE
        this.matchId = matchId;
        this.terminateCallback = _terminateCallback; 
        this.unitDefinitions = initialGameState.unitDefinitions;
        this.io = io; // Store IO instance
        this.playerIds = [...initialGameState.players]; // Assign to existing property
        this.arenaWidth = arenaWidth; // Store dimensions
        this.arenaHeight = arenaHeight;
        // Assuming the first player in the GameState is always Player 1 (Host)
        if (!this.playerIds[0]) {
            throw new Error(`[CombatInstance:${matchId}] Invalid initial game state: Missing Player 1 ID.`);
        }
        this.player1Id = this.playerIds[0]; 
        // console.log(`[CombatInstance:${matchId}] Identified Player 1 as: ${this.player1Id}`); // REMOVE

        // Find the initial combatants
        const attackerBoardUnit = initialGameState.units.find((u: GameState['units'][0]) => u.id === attackerId);
        const defenderBoardUnit = initialGameState.units.find((u: GameState['units'][0]) => u.id === defenderId);

        if (!attackerBoardUnit || !defenderBoardUnit) {
            throw new Error('Cannot initialize combat: Attacker or Defender not found in initial game state.');
        }

        this.playerIds = [attackerBoardUnit.owner, defenderBoardUnit.owner];

        // Initialize CombatUnitState for both units
        this.addCombatUnit(attackerBoardUnit);
        this.addCombatUnit(defenderBoardUnit);

        // Initialize intended directions
        this.combatUnits.forEach(unit => {
            this.unitIntendedDirections.set(unit.id, { x: 0, y: 0 });
        });

        // console.log(`[CombatInstance:${matchId}] Initialized with units:`, Array.from(this.combatUnits.keys())); // REMOVE
    }

    // Helper to create CombatUnitState from BoardUnit
    private addCombatUnit(boardUnit: GameState['units'][0]): void {
        const definition = this.unitDefinitions[boardUnit.typeId];
        if (!definition) {
            // console.warn(`[CombatInstance:${this.matchId}] Unit definition not found for type ${boardUnit.typeId}`);
            // Handle this case? Skip unit?
            return;
        }

        // Start position based on Player 1 vs Player 2, using arena dimensions
        const startPosition: Vector2 = boardUnit.owner === this.player1Id 
            ? { x: this.arenaWidth * 0.25, y: this.arenaHeight / 2 } // Player 1 left quarter
            : { x: this.arenaWidth * 0.75, y: this.arenaHeight / 2 }; // Player 2 right quarter

        const combatUnit: CombatUnitState = {
            id: boardUnit.id,
            owner: boardUnit.owner,
            definitionId: boardUnit.typeId,
            position: startPosition,
            velocity: { x: 0, y: 0 },
            currentHp: boardUnit.currentHp,
            maxHp: definition.maxHp,
            lastMovementDirection: null,
            facingDirection: { x: boardUnit.owner === this.player1Id ? 1 : -1, y: 0 },
            abilityCooldowns: {},
        };
        // Initialize cooldowns
        definition.combatAbilities.forEach((ab: AbilityDefinition) => combatUnit.abilityCooldowns[ab.id] = 0);

        this.combatUnits.set(combatUnit.id, combatUnit);
    }

    queueInputAction(playerId: PlayerId, action: CombatActionPayload): void {
        // Basic validation: Is the player part of this combat?
        if (!this.playerIds.includes(playerId)) {
            // console.warn(`[CombatInstance:${this.matchId}] Input from non-participant player ${playerId}`);
            return;
        }
        // console.log(`[CombatInstance:${this.matchId}] Queuing input for ${playerId}:`, action.type);
        const playerQueue = this.queuedInputs.get(playerId) || [];
        playerQueue.push(action);
        this.queuedInputs.set(playerId, playerQueue);
        // console.log(`[CombatInstance:${this.matchId}] Queued action ${action.type} for player ${playerId}. Queue size: ${playerQueue.length}`); // REMOVE
    }

    update(deltaTime: number): void {
        if (this.status !== 'active') return;

        this.processInputs();
        this.updateCooldowns();
        
        // --- REMOVE LOG: Check map state BEFORE updateUnits --- 
        // console.log(`[CombatInstance:${this.matchId}] update: State of unitIntendedDirections BEFORE updateUnits:`, JSON.stringify(Object.fromEntries(this.unitIntendedDirections)));
        
        this.updateUnits(deltaTime);
        this.updateProjectiles(deltaTime);
        this.updateAoEZones();
        this.detectCollisions();
        this.checkEndCondition();
        
        if (this.status === 'active') {
             this.broadcastStateUpdate();
        }
    }

    // --- Update Sub-methods --- 
    private processInputs(): void {
        if (this.queuedInputs.size === 0) return; // Skip if no inputs
        // --- Keep initial log --- 
        console.log(`[DEBUG processInputs] Function entered. Queued inputs size: ${this.queuedInputs.size}`);
        // --- End Keep initial log ---

        this.queuedInputs.forEach((actions, playerId) => {
            const controlledUnit = Array.from(this.combatUnits.values()).find(u => u.owner === playerId);
            if (!controlledUnit) { /* ... warning ... */ return; }
            const unitDef = this.unitDefinitions[controlledUnit.definitionId];
            if (!unitDef) { /* ... error ... */ return; }

            actions.forEach((action: CombatActionPayload) => {
                // --- Keep action type log --- 
                console.log(`[DEBUG processInputs] Processing action type: ${action.type} for unit ${controlledUnit.id}`);
                // --- End Keep action type log ---
                
                // Handle Movement Actions directly
                if (action.type === 'startMove') {
                    // --- Keep block entry log --- 
                    console.log(`[DEBUG processInputs] Entered 'startMove' block for unit ${controlledUnit.id}`);
                    // --- End Keep block entry log ---
                    const normalizedDir = normalize(action.direction);
                    this.unitIntendedDirections.set(controlledUnit.id, normalizedDir); 
                    // --- REMOVE LOG: Check map state AFTER set --- 
                    // const hasKey = this.unitIntendedDirections.has(controlledUnit.id);
                    // console.log(`[CombatInstance:${this.matchId}] processInputs startMove: Set intendedDir for ${controlledUnit.id} to (${normalizedDir.x.toFixed(2)}, ${normalizedDir.y.toFixed(2)}). Key exists after set: ${hasKey}. Map content:`, JSON.stringify(Object.fromEntries(this.unitIntendedDirections)));
                    
                    controlledUnit.facingDirection = normalizedDir;
                    return; // Finish processing this action
                }
                if (action.type === 'stopMove') {
                    // --- Keep block entry log --- 
                    console.log(`[DEBUG processInputs] Entered 'stopMove' block for unit ${controlledUnit.id}`);
                    // --- End Keep block entry log ---
                    this.unitIntendedDirections.set(controlledUnit.id, { x: 0, y: 0 }); 
                    // --- REMOVE LOG: Check map state AFTER set --- 
                    // const hasKey = this.unitIntendedDirections.has(controlledUnit.id);
                    // console.log(`[CombatInstance:${this.matchId}] processInputs stopMove: Set intendedDir for ${controlledUnit.id} to (0.00, 0.00). Key exists after set: ${hasKey}. Map content:`, JSON.stringify(Object.fromEntries(this.unitIntendedDirections)));
                    controlledUnit.velocity = { x: 0, y: 0 }; 
                    return; // Finish processing this action
                }

                // Handle Ability Actions (includes basicAttack interpretation)
                let abilityToExecute: AbilityDefinition | undefined;
                let abilityActionPayload: any | undefined; // Use 'any' temporarily

                if (action.type === 'useAbility') {
                    abilityActionPayload = action as any; // Use 'any' temporarily
                    abilityToExecute = unitDef.combatAbilities.find((ab: AbilityDefinition) => ab.id === action.abilityId);
                } else if (action.type === 'basicAttack') {
                    // Find the first defined combat ability (assuming it's the basic one)
                    abilityToExecute = unitDef.combatAbilities?.[0];
                    if (abilityToExecute) {
                        // Construct a UseAbility payload for consistency, but without target info initially
                         abilityActionPayload = { type: 'useAbility', abilityId: abilityToExecute.id };
                         // console.warn(`[CombatInstance:${this.matchId}] Interpreted basicAttack as useAbility for ${abilityToExecute.id}`); // REMOVE
                    } else {
                        // console.warn(`[CombatInstance:${this.matchId}] Unit ${controlledUnit.id} received basicAttack but has no combatAbilities defined.`);
                    }
                } else {
                     // console.warn(`[CombatInstance:${this.matchId}] Unhandled action type encountered in processInputs.`);
                     return; // Skip unknown action types
                }

                // Now, execute if we found an ability
                if (abilityToExecute) {
                    const abilityId = abilityToExecute.id;
                    const now = Date.now();
                    const cooldownEndTime = controlledUnit.abilityCooldowns[abilityId] ?? 0;
                    const cooldownDurationMs = (abilityToExecute.cooldown ?? 1000);

                    if (now < cooldownEndTime) {
                        // console.log(`[CombatInstance:${this.matchId}] Ability ${abilityId} on cooldown for unit ${controlledUnit.id}. Remaining: ${((cooldownEndTime - now) / 1000).toFixed(1)}s`); // REMOVE
                        return;
                    }
                    
                    // Pass 'any' type payload
                    this.executeAbility(controlledUnit, abilityToExecute, abilityActionPayload);
                    controlledUnit.abilityCooldowns[abilityId] = now + cooldownDurationMs;
                } else {
                     // console.warn(`[CombatInstance:${this.matchId}] Could not find ability to execute for action:`, JSON.stringify(action)); // REMOVE
                }
                 // console.log(`[CombatInstance:${this.matchId}] Finished processing action ${action.type} for unit ${controlledUnit.id}`); // REMOVE
            });
        });
        this.queuedInputs.clear();
    }

    // Use dynamic import for nanoid
    private async executeAbility(unit: CombatUnitState, ability: AbilityDefinition, actionPayload?: any): Promise<void> {
        // console.log(`[CombatInstance:${this.matchId}] Executing ability ${ability.id} (${ability.attackType ?? ability.type}) for unit ${unit.id}`); // REMOVE
        const unitDef = this.unitDefinitions[unit.definitionId];
        if (!unitDef) return;

        // Apply cooldown *before* executing effect
        const now = Date.now();
        const cooldownDuration = ability.cooldown ?? 1000; // Default 1s cooldown
        unit.abilityCooldowns[ability.id] = now + cooldownDuration;

        // Handle different ability types
        if (ability.type === 'attack') {
            switch (ability.attackType) {
                case 'melee': {
                    // console.log(`[CombatInstance:${this.matchId}] executeAbility: Handling melee: ${ability.id}`);
                    const attackRange = ability.range ?? unitDef.hitboxRadius ?? 10; // Use ability range or default
                    const CONE_HALF_ANGLE_RADIANS = Math.PI / 4; // 45 degrees (90 total)

                    // Determine facing direction (prioritize current velocity > last move > default right)
                    let facingDirection = { x: 1, y: 0 }; // Default
                    const currentSpeedSq = unit.velocity.x * unit.velocity.x + unit.velocity.y * unit.velocity.y;
                    if (currentSpeedSq > 0.001) { 
                        facingDirection = normalize(unit.velocity);
                    } else if (unit.lastMovementDirection) {
                        facingDirection = unit.lastMovementDirection;
                    }
                    const facingAngle = Math.atan2(facingDirection.y, facingDirection.x);
                    // console.log(`[Melee Debug ${unit.id}] Facing Dir: (${facingDirection.x.toFixed(2)}, ${facingDirection.y.toFixed(2)}), Facing Angle: ${(facingAngle * 180 / Math.PI).toFixed(1)} deg`);

                    this.combatUnits.forEach(potentialTarget => {
                        if (potentialTarget.owner !== unit.owner && potentialTarget.currentHp > 0) {
                            const targetDef = this.unitDefinitions[potentialTarget.definitionId];
                            if (!targetDef) return;
                            // console.log(`[Melee Debug ${unit.id}] Checking target: ${potentialTarget.id}`); // Log target check

                            // Adjust range check to account for hitboxes
                            const effectiveRange = attackRange + unitDef.hitboxRadius + targetDef.hitboxRadius;
                            const effectiveRangeSq = effectiveRange * effectiveRange;
                            const distSq = distanceSq(unit.position, potentialTarget.position);
                            const isInRange = distSq <= effectiveRangeSq;
                            // console.log(`[Melee Debug ${unit.id} -> ${potentialTarget.id}] DistSq: ${distSq.toFixed(1)}, EffRangeSq: ${effectiveRangeSq.toFixed(1)}, InRange: ${isInRange}`);

                            if (isInRange) {
                                // Check cone
                                const vectorToTargetX = potentialTarget.position.x - unit.position.x;
                                const vectorToTargetY = potentialTarget.position.y - unit.position.y;
                                const angleToTarget = Math.atan2(vectorToTargetY, vectorToTargetX);
                                let deltaAngle = angleToTarget - facingAngle;
                                while (deltaAngle <= -Math.PI) { deltaAngle += 2 * Math.PI; }
                                while (deltaAngle > Math.PI) { deltaAngle -= 2 * Math.PI; }
                                const isInCone = Math.abs(deltaAngle) <= CONE_HALF_ANGLE_RADIANS;
                                // console.log(`[Melee Debug ${unit.id} -> ${potentialTarget.id}] AngleToTarget: ${(angleToTarget * 180 / Math.PI).toFixed(1)}, DeltaAngle: ${(deltaAngle * 180 / Math.PI).toFixed(1)}, InCone: ${isInCone}`);

                                if (isInCone) {
                                    // console.log(`[CombatInstance:${this.matchId}] Melee hit: ${unit.id} -> ${potentialTarget.id}`);
                                    const damageDealt = ability.damage ?? 10;
                                    potentialTarget.currentHp -= damageDealt;
                                    potentialTarget.currentHp = Math.max(0, potentialTarget.currentHp); 
                                }
                            }
                        }
                    });
                    // Optional: Emit swing animation event even if no target hit?
                    break;
                }

                case 'direct_projectile':
                case 'boomerang_projectile': {
                    // console.log(`[CombatInstance:${this.matchId}] executeAbility: Handling ${ability.attackType}: ${ability.id}`);
                    
                    // --- Remove Strict Target Validation for Keypress Trigger --- 
                    // We still might want target info for *other* triggers (e.g. homing),
                    // but for simple direction firing, we don't strictly need a targetUnitId.
                    /* 
                    const targetUnitId = actionPayload?.targetUnitId;
                    if (!targetUnitId) {
                        console.warn(`[CombatInstance:${this.matchId}] ${ability.attackType} ${ability.id} requires a targetUnitId. Validation failed.`);
                        return; // Stop if no target ID provided in payload
                    }
                    const targetUnit = this.combatUnits.get(targetUnitId);
                    if (!targetUnit || targetUnit.currentHp <= 0 || targetUnit.owner === unit.owner) {
                        console.warn(`[CombatInstance:${this.matchId}] ${ability.attackType} ${ability.id} requires a valid enemy targetUnitId. Target validation failed.`);
                        return; // Stop if target is invalid/dead/friendly
                    }
                    */
                    // --- End Removed Validation ---
                    
                    // --- Determine Firing Direction (based on movement, not target) --- 
                    let fireDirection = { x: 1, y: 0 }; // Default
                    const currentSpeedSq = unit.velocity.x * unit.velocity.x + unit.velocity.y * unit.velocity.y;
                    if (currentSpeedSq > 0.001) {
                        fireDirection = normalize(unit.velocity);
                    } else if (unit.lastMovementDirection) {
                        fireDirection = unit.lastMovementDirection;
                    }
                    // console.log(`[${ability.attackType} Proj Debug ${unit.id}] Firing Dir: (${fireDirection.x.toFixed(2)}, ${fireDirection.y.toFixed(2)})`); // <-- Commented out
                    // --- End Firing Direction --- 

                    const speed = ability.projectileSpeed ?? 120;
                    const projectileVelocity = scale(fireDirection, speed);
                    const maxRange = ability.range ?? 400;
                    
                    // --- Adjust Lifespan for Boomerang --- 
                    let lifespanMs = ((maxRange / speed) * 1000); // One way time
                    if (ability.attackType === 'boomerang_projectile') {
                        lifespanMs = lifespanMs * 2 + 1000; // Double + 1s buffer for return/homing
                    }
                    // --- End Lifespan Adjustment ---

                    let nanoid: any;
                    try {
                        const nanoidModule = await import('nanoid');
                        nanoid = nanoidModule.nanoid;
                    } catch (err) {
                        // console.error("[CombatInstance] Failed to dynamically import nanoid:", err);
                        return; 
                    }

                    const projectile: ProjectileState = {
                        id: `proj_${nanoid(8)}`,
                        ownerUnitId: unit.id,
                        abilityId: ability.id,
                        projectileVisualKey: ability.projectileVisualKey,
                        position: { ...unit.position },
                        velocity: projectileVelocity,
                        speed: speed, // Store speed
                        damage: ability.damage ?? 5,
                        projectileType: ability.attackType,
                        maxRange: maxRange, 
                        startPosition: { ...unit.position }, 
                        boomerangState: ability.attackType === 'boomerang_projectile' ? 'outbound' : undefined,
                        maxHitsPerUnit: ability.maxHitsPerUnit ?? 1,
                        unitsHitThisThrow: {},
                        hitCooldowns: {},
                    };
                    this.projectiles.set(projectile.id, projectile);
                     // console.log(`[CombatInstance:${this.matchId}] Projectile (${ability.attackType}) ${projectile.id} created. Target was ${projectile.targetUnitId}. Lifespan: ${lifespanMs.toFixed(0)}ms`);
                    break;
                }

                case 'aoe_projectile': {
                    // console.log(`[CombatInstance:${this.matchId}] executeAbility: Handling aoe_projectile: ${ability.id}`);
                    const targetPosition = actionPayload?.targetPosition;
                    if (!targetPosition) {
                        // console.warn(`[CombatInstance:${this.matchId}] AoE ability ${ability.id} requires a targetPosition.`);
                        return;
                    }

                    // --- Adjust Range Check --- 
                    // Original check: const distSq = distanceSq(unit.position, targetPosition);
                    // Original check: if (distSq > (ability.range ?? 300) ** 2) {
                    // Let's trust the client's calculated position for keyboard trigger for now
                    // We can add server-side clamping later if needed.
                    /* 
                    const distSq = distanceSq(unit.position, targetPosition);
                    const maxRange = ability.range ?? 300;
                    if (distSq > maxRange * maxRange) {
                        console.log(`[CombatInstance:${this.matchId}] AoE target position out of range.`);
                        return;
                    }
                    */
                    // --- End Adjusted Range Check ---

                    const projectileSpeed = ability.projectileSpeed ?? 90;
                    const dirToTarget = normalize({ 
                        x: targetPosition.x - unit.position.x, 
                        y: targetPosition.y - unit.position.y 
                    });
                    const correctedVelocity = scale(dirToTarget, projectileSpeed);
                    const now = Date.now();
                    const travelDistance = Math.sqrt(distanceSq(unit.position, targetPosition));
                    const travelTimeMs = (travelDistance / projectileSpeed) * 1000;
                    const impactDelay = ability.impactDelay ?? travelTimeMs; // Use defined delay or travel time
                    // const LINGER_DURATION_MS = 250; // <-- Removed
                    const impactTime = now + impactDelay; // <-- Calculate impact time

                    // --- Add Log for Timing --- 
                    // console.log(`[AoE Timing Debug] Create Time (now): ${now}, ImpactDelay: ${impactDelay.toFixed(0)}ms, Calculated impactTime: ${impactTime}`);
                    // --- End Log ---

                    let nanoid: any;
                    try {
                        const nanoidModule = await import('nanoid');
                        nanoid = nanoidModule.nanoid;
                    } catch (err) {
                        // console.error("[CombatInstance] Failed to dynamically import nanoid:", err);
                        return;
                    }

                    const projectile: ProjectileState = {
                        id: `proj_${nanoid(8)}`,
                        ownerUnitId: unit.id,
                        abilityId: ability.id,
                        projectileVisualKey: ability.projectileVisualKey,
                        position: { ...unit.position },
                        velocity: correctedVelocity, // <-- Use corrected velocity
                        damage: ability.damage ?? 0, // Impact damage (if any)
                        projectileType: 'aoe_projectile', // Use correct type
                        targetPosition: targetPosition,
                        aoeRadius: ability.aoeRadius ?? 50,
                        // expiresAt: now + impactDelay + LINGER_DURATION_MS, // <-- Removed expiresAt
                        impactTime: impactTime, // <-- Store impact time
                        impactDelay: impactDelay, // Keep for zone creation? Or recalculate?
                        unitsHitThisThrow: {}, // AoE hits handled by zone, not projectile
                        hitCooldowns: {},
                        zoneCreated: false, // Initialize flag
                    };
                    this.projectiles.set(projectile.id, projectile);
                    // console.log(`[CombatInstance:${this.matchId}] Projectile (AoE) ${projectile.id} created towards (${targetPosition.x},${targetPosition.y}).`);
                    break;
                }

                // Handle non-attack abilities (support, movement?) - Placeholder
                default: {
                    if (ability.type !== 'attack') {
                         // console.log(`[CombatInstance:${this.matchId}] Executing non-attack ability: ${ability.id} (Type: ${ability.type})`);
                         // Add logic for buffs, heals, teleports etc. here based on ability.id or other props
                    } else {
                        // This case handles attack abilities where attackType is missing or unknown
                        // console.warn(`[CombatInstance:${this.matchId}] Unhandled or missing attackType for ability: ${ability.id}`);
                    }
                    break;
                }
            }
        } else if (ability.type === 'movement') {
            // Handle movement abilities (e.g., dash, blink)
        } else if (ability.type === 'support') {
            // Handle support abilities (e.g., heal, buff)
        }
        // Update unit state if ability modifies it directly (e.g., buffs)
    }

    // Helper for AOE damage
    private applyAoeDamage(center: Vector2, radius: number, damage: number, attackerOwnerId: PlayerId, excludedUnitId?: GameObjectId): void {
        const radiusSq = radius * radius;
        // console.log(`[CombatInstance:${this.matchId}] Applying AoE damage. Center: (${center.x.toFixed(1)}, ${center.y.toFixed(1)}), Radius: ${radius}, Damage: ${damage}, Excluded: ${excludedUnitId ?? 'None'}`); // <-- Commented out

        this.combatUnits.forEach((unit: CombatUnitState) => {
            // Don't hit self/own team, already dead units, or the excluded unit (if provided)
            if (unit.owner === attackerOwnerId || unit.currentHp <= 0 || unit.id === excludedUnitId) {
                return;
            }

            const distSq = distanceSq(center, unit.position);
            if (distSq <= radiusSq) {
                 // console.log(`[CombatInstance:${this.matchId}] AoE Hit: Unit ${unit.id} (DistSq: ${distSq.toFixed(1)}, RadiusSq: ${radiusSq})`); // <-- Commented out
                 const actualDamage = damage ?? 0;
                 unit.currentHp -= actualDamage;
                 unit.currentHp = Math.max(0, unit.currentHp);
                 // console.log(`[CombatInstance:${this.matchId}] Unit ${unit.id} HP after AoE hit: ${unit.currentHp}`); // <-- Commented out
            }
        });
    }

    private updateCooldowns(): void {
        // Cooldowns are now timestamps, no decrement needed here
        // const now = Date.now(); // Already removed
    }

    private updateUnits(deltaTime: number): void {
        // console.log(`[CombatInstance ${this.matchId}] updateUnits called.`); // Reduce noise

        this.combatUnits.forEach(unit => {
            const unitDef = this.unitDefinitions[unit.definitionId];
            if (!unitDef) return; // Skip if no definition

            // --- REMOVE LOGS: Check map get result --- 
            // const retrievedDir = this.unitIntendedDirections.get(unit.id);
            // console.log(`[CombatInstance:${this.matchId}] updateUnits Check Raw Get: Unit ${unit.id}, retrievedDir:`, retrievedDir ? JSON.stringify(retrievedDir) : 'undefined');
            
            const intendedDir = this.unitIntendedDirections.get(unit.id) || { x: 0, y: 0 }; // KEEP LOGIC
            
            // --- REMOVE Log BEFORE the IF --- 
            // console.log(`[CombatInstance:${this.matchId}] updateUnits Check: Unit ${unit.id}, intendedDir: (${intendedDir.x.toFixed(2)}, ${intendedDir.y.toFixed(2)})`);

            // Update velocity based on intended direction and speed
            if (intendedDir.x !== 0 || intendedDir.y !== 0) {
                const speed = unitDef.combatSpeed ?? 100; 
                unit.velocity.x = intendedDir.x * speed;
                unit.velocity.y = intendedDir.y * speed;
                // --- REMOVE LOG: Velocity SET --- 
                // console.log(`[CombatInstance:${this.matchId}] updateUnits: Unit ${unit.id} velocity SET to (${unit.velocity.x.toFixed(2)}, ${unit.velocity.y.toFixed(2)}) based on intendedDir (${intendedDir.x.toFixed(2)}, ${intendedDir.y.toFixed(2)})`);
            } else {
                // --- REMOVE LOG: Zero intendedDir check --- 
                // if (unit.velocity.x !== 0 || unit.velocity.y !== 0) {
                //    console.log(`[CombatInstance:${this.matchId}] updateUnits: Unit ${unit.id} has non-zero velocity (${unit.velocity.x.toFixed(2)}, ${unit.velocity.y.toFixed(2)}) but zero intendedDir.`);
                // }
            }

            // Apply velocity to position
            const moveX = unit.velocity.x * deltaTime;
            const moveY = unit.velocity.y * deltaTime;
             // --- REMOVE Log: Position change --- 
             // if (moveX !== 0 || moveY !== 0) {
             //     console.log(`[CombatInstance:${this.matchId}] updateUnits Apply: Unit ${unit.id} Pos change: dx=${moveX.toFixed(2)}, dy=${moveY.toFixed(2)} from Vel: (${unit.velocity.x.toFixed(2)}, ${unit.velocity.y.toFixed(2)})`);
             // }
            unit.position.x += moveX;
            unit.position.y += moveY;

            // Update facing direction (should be handled by intended direction processing)
            if (unit.velocity.x !== 0 || unit.velocity.y !== 0) {
                unit.facingDirection = normalize(unit.velocity);
                unit.lastMovementDirection = unit.facingDirection;
            } else if (unit.lastMovementDirection) {
                unit.facingDirection = unit.lastMovementDirection; // Maintain last direction when stopped
            } // Keep default if never moved
            
            // --- Arena Bounds Check --- 
            const unitRadius = unitDef.hitboxRadius || 10; // Use hitboxRadius or default
            unit.position.x = Math.max(unitRadius, Math.min(this.arenaWidth - unitRadius, unit.position.x));
            unit.position.y = Math.max(unitRadius, Math.min(this.arenaHeight - unitRadius, unit.position.y));
            // --- End Arena Bounds Check ---

        });
    }

    private updateProjectiles(deltaTime: number): void {
        // Iterate over Map values, track IDs to delete
        const projectilesToDelete = new Set<GameObjectId>();
        const now = Date.now();
        const BOOMERANG_TURN_RATE_RAD_PER_SEC = Math.PI * 2; // Example: 360 degrees per second turn rate

        for (const proj of this.projectiles.values()) { // <-- Iterate over Map values
            let keepProjectile = true;

            // Update position based on velocity
            proj.position.x += proj.velocity.x * deltaTime;
            proj.position.y += proj.velocity.y * deltaTime;

            // --- Handle based on projectileType --- 
            switch (proj.projectileType) {
                case 'direct_projectile': {
                    // Check max range
                    if (proj.maxRange && proj.startPosition) { // Requires startPosition to be set for direct projectiles
                        if (distanceSq(proj.startPosition, proj.position) >= (proj.maxRange * proj.maxRange)) {
                            keepProjectile = false;
                            // console.log(`Projectile ${proj.id} (direct) reached max range.`);
                        }
                    }
                    // Optional: Check expiry time if range isn't the only limit
                    if (proj.expiresAt && now >= proj.expiresAt) {
                        keepProjectile = false;
                        // console.log(`Projectile ${proj.id} (direct) expired.`);
                    }
                    break;
                }
                case 'aoe_projectile': {
                    // Check if it's time to impact and zone hasn't been created
                    if (!proj.zoneCreated && proj.impactTime && now >= proj.impactTime) {
                        // console.log(`[AoE Debug] Projectile ${proj.id} reached impact time. Now: ${now}, ImpactTime: ${proj.impactTime}`);
                        this.createAoEZone(proj);
                        proj.zoneCreated = true;
                        keepProjectile = false; // Consume projectile immediately
                    }
                    // Optional: Add a failsafe expiry if impactTime is somehow missed?
                    // else if (proj.expiresAt && now >= proj.expiresAt) { // If we re-add expiresAt
                    //    keepProjectile = false;
                    // }
                    break;
                }
                case 'boomerang_projectile': {
                    if (proj.boomerangState === 'outbound') {
                        // Check max range from start
                        if (proj.startPosition && proj.maxRange) {
                             // Use >= for safety
                             if (distanceSq(proj.startPosition, proj.position) >= (proj.maxRange * proj.maxRange)) {
                                // console.log(`Projectile ${proj.id} (boomerang) reached max range, returning...`);
                                proj.boomerangState = 'returning';
                                // Ensure velocity is NOT reset here, arc logic handles direction
                             }
                        }
                    }
                    
                    if (proj.boomerangState === 'returning') {
                        const ownerUnit = this.combatUnits.get(proj.ownerUnitId);
                        if (ownerUnit) {
                            // --- Arc Logic --- 
                            const dirToOwner = normalize({
                                x: ownerUnit.position.x - proj.position.x,
                                y: ownerUnit.position.y - proj.position.y
                            });
                            const targetAngle = Math.atan2(dirToOwner.y, dirToOwner.x);
                            
                            const currentDir = normalize(proj.velocity);
                            const currentAngle = Math.atan2(currentDir.y, currentDir.x);

                            let angleDiff = targetAngle - currentAngle;
                            // Normalize angle difference to be between -PI and PI
                            while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
                            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

                            // Clamp the turn amount based on turn rate and delta time
                            const maxTurnThisTick = BOOMERANG_TURN_RATE_RAD_PER_SEC * deltaTime;
                            const turnAmount = Math.max(-maxTurnThisTick, Math.min(maxTurnThisTick, angleDiff));

                            // Rotate current velocity by the calculated turn amount
                            const newVelocity = rotateVector(proj.velocity, turnAmount);
                            
                            // Ensure speed is maintained (rotation might slightly alter magnitude due to precision)
                            const currentSpeed = proj.speed ?? 120;
                            const finalVelocity = scale(normalize(newVelocity), currentSpeed);
                            proj.velocity = finalVelocity;
                            // --- End Arc Logic ---

                            // Check if close enough to owner to despawn
                            const ownerRadius = this.unitDefinitions[ownerUnit.definitionId]?.hitboxRadius ?? 5;
                            if (distanceSq(ownerUnit.position, proj.position) <= (ownerRadius * ownerRadius)) {
                                // console.log(`Projectile ${proj.id} (boomerang) returned to owner.`);
                                keepProjectile = false;
                            }
                        } else {
                            // Owner disappeared? Remove projectile.
                            keepProjectile = false;
                        }
                    }

                    // Check expiry (applies to both outbound and returning)
                    if (proj.expiresAt && now >= proj.expiresAt) {
                        // console.log(`Projectile ${proj.id} (boomerang) expired.`);
                        keepProjectile = false;
                    }
                    break;
                }
                default: // Optional: Log unknown types
                     // console.warn(`[CombatInstance:${this.matchId}] updateProjectiles: Unknown projectileType: ${proj.projectileType}`);
                     break;
            }

            // Check arena bounds
            if (
                proj.position.x < 0 || proj.position.x > this.arenaWidth ||
                proj.position.y < 0 || proj.position.y > this.arenaHeight
            ) {
                // console.log(`Projectile ${proj.id} went out of bounds.`);
                keepProjectile = false;
            }

            if (!keepProjectile) {
                projectilesToDelete.add(proj.id); // <-- Add ID to delete set
            }
        }

        // Delete projectiles outside the loop
        projectilesToDelete.forEach(id => this.projectiles.delete(id)); // <-- Use Map delete()
    }

    // Use dynamic import for nanoid
    private async createAoEZone(projectile: ProjectileState): Promise<void> {
        if (!projectile.targetPosition || !projectile.aoeRadius) return;
        const ability = this.unitDefinitions[this.combatUnits.get(projectile.ownerUnitId)?.definitionId ?? '']?.combatAbilities.find((a: AbilityDefinition) => a.id === projectile.abilityId); 
        if (!ability) return; 

        let nanoid: any;
        try {
            const nanoidModule = await import('nanoid');
            nanoid = nanoidModule.nanoid;
        } catch (err) {
            // console.error("[CombatInstance] Failed to dynamically import nanoid:", err);
            return;
        }

        const now = Date.now();
        const zoneId = `aoe_${nanoid(8)}`; // Use dynamically imported nanoid
        const zone: AoEZoneState = {
            id: zoneId,
            ownerUnitId: projectile.ownerUnitId,
            abilityId: projectile.abilityId,
            position: projectile.targetPosition, // Land at the intended target
            radius: projectile.aoeRadius,
            endTime: now + (ability.aoeDuration ?? 3000), // Get duration from ability def
            damagePerTick: ability.aoeDamagePerTick,
            tickInterval: 500, // Example: damage every 500ms, could be from ability def
            unitsCurrentlyInside: new Set<GameObjectId>(),
            visualEffectKey: ability.id, // Use ability ID or a specific key from ability def?
        };

        // console.log(`[AoE Debug] Inside createAoEZone for projectile ${projectile.id}. Preparing zone ${zoneId}.`); // <-- Commented out
        this.activeAoEZones.set(zoneId, zone);
        // console.log(`[AoE Debug] Zone ${zoneId} added. activeAoEZones size: ${this.activeAoEZones.size}`); // <-- Commented out

        // Apply initial impact damage if the ability has direct damage > 0
        if (projectile.damage && projectile.damage > 0) {
            // console.log(`[CombatInstance:${this.matchId}] Applying initial impact damage (${projectile.damage}) for AoE ${zoneId}`);
            const zoneOwnerPlayer = this.getUnitOwner(zone.ownerUnitId);
            if (zoneOwnerPlayer) { // Check if owner exists
                this.applyAoeDamage(zone.position, zone.radius, projectile.damage, zoneOwnerPlayer);
            } else {
                // console.warn(`[CombatInstance:${this.matchId}] Could not find owner for AoE zone ${zoneId} to apply initial impact damage.`);
            }
        }
    }

    private updateAoEZones(): void {
        const now = Date.now();
        this.activeAoEZones.forEach((zone, zoneId) => {
            // Check for expiration first
            if (now >= zone.endTime) {
                // console.log(`[AoE Zone Expiry] Zone ${zoneId} expiring. Now: ${now}, EndTime: ${zone.endTime}`);
                this.activeAoEZones.delete(zoneId);
                return; // Stop processing this zone
            }

            // Handle damage ticks
            if (zone.damagePerTick && zone.damagePerTick > 0) {
                const tickInterval = zone.tickInterval ?? 500; // Default tick interval
                
                // Check if it's time for a damage tick
                // This simple check assumes the update loop runs faster than tickInterval
                // A more robust approach might track the last tick time per zone
                if (!zone._lastTickTime || now >= zone._lastTickTime + tickInterval) {
                    // console.log(`[CombatInstance:${this.matchId}] Applying damage tick for AoE zone ${zoneId}`);
                    const zoneOwnerPlayer = this.getUnitOwner(zone.ownerUnitId);
                    if (zoneOwnerPlayer) { // Ensure owner exists before applying damage
                        this.applyAoeDamage(zone.position, zone.radius, zone.damagePerTick, zoneOwnerPlayer);
                        zone._lastTickTime = now; // Store the time of this tick
                    } else {
                         // console.warn(`[CombatInstance:${this.matchId}] Could not find owner for AoE zone ${zoneId} to apply damage tick.`);
                    }
                }
            }

            // Optional: Update unitsCurrentlyInside set (might not be needed if applyAoeDamage checks units every time)
            // zone.unitsCurrentlyInside = new Set<GameObjectId>();
            // this.combatUnits.forEach(unit => {
            //     if (unit.currentHp > 0 && this.getUnitOwner(unit.id) !== this.getUnitOwner(zone.ownerUnitId)) {
            //         if (distanceSq(zone.position, unit.position) <= zone.radius * zone.radius) {
            //             zone.unitsCurrentlyInside.add(unit.id);
            //         }
            //     }
            // });
        });
    }

    private detectCollisions(): void {
        const destroyedProjectiles = new Set<GameObjectId>();
        const now = Date.now(); // Get current time for cooldown checks
        const PROJECTILE_HIT_COOLDOWN_MS = 500; // Cooldown duration (e.g., 500ms)

        this.projectiles.forEach(projectile => {
            if (destroyedProjectiles.has(projectile.id)) return; // Skip if already marked for destruction

            this.combatUnits.forEach(unit => {
                // Skip collision check if:
                // - Unit is dead
                // - Projectile owner is the same unit (no self-hits)
                if (unit.currentHp <= 0 || projectile.ownerUnitId === unit.id) {
                    return;
                }
                // - No friendly fire between units of the same player
                const projectileOwnerUnit = this.combatUnits.get(projectile.ownerUnitId);
                if (!projectileOwnerUnit || projectileOwnerUnit.owner === unit.owner) {
                    return;
                }

                // --- NEW: Check Per-Projectile Target Cooldown --- 
                const targetCooldownEndTime = projectile.hitCooldowns[unit.id] ?? 0;
                if (now < targetCooldownEndTime) {
                    // console.log(`[Collision Cooldown] Target ${unit.id} is on cooldown for projectile ${projectile.id}.`); // <-- Commented out
                    return; // This target is immune to this projectile for now
                }
                // --- END Cooldown Check ---

                const isBoomerang = projectile.projectileType === 'boomerang_projectile';
                
                // Boomerang specific check: has this unit already been hit the max number of times?
                if (isBoomerang) {
                    const hitCount = projectile.unitsHitThisThrow[unit.id] ?? 0;
                    const maxHits = projectile.maxHitsPerUnit ?? 1;
                    // console.log(`[Boomerang Collision Debug ${projectile.id} -> ${unit.id}] HitCount: ${hitCount}, MaxHits: ${maxHits}`); // <-- Commented out
                    if (hitCount >= maxHits) {
                        return; // Already hit max times by this boomerang
                    }
                }

                // Collision Check Logic
                const unitDef = this.unitDefinitions[unit.definitionId];
                const collisionRadius = (projectile.aoeRadius ?? 5) + (unitDef?.hitboxRadius ?? 10); // Simple sum for now
                const collisionRadiusSq = collisionRadius * collisionRadius;
                const distSq = distanceSq(projectile.position, unit.position);
                const isCollision = distSq <= collisionRadiusSq;

                // console.log(`[Boomerang Collision Debug ${projectile.id} -> ${unit.id}] DistSq: ${distSq.toFixed(1)}, CollisionRadiusSq: ${collisionRadiusSq.toFixed(1)}, IsCollision: ${isCollision}`); // <-- Commented out

                // --- Collision Detected --- 
                if (isCollision) {
                    // console.log(`[CombatInstance:${this.matchId}] Projectile ${projectile.id} (${projectile.projectileType}) hit unit ${unit.id}`); // <-- Commented out
                    
                    const damage = projectile.damage ?? 0;
                    unit.currentHp -= damage;
                    unit.currentHp = Math.max(0, unit.currentHp);
                    // console.log(`[CombatInstance:${this.matchId}] Unit ${unit.id} HP after hit: ${unit.currentHp}`); // <-- Commented out

                    // Emit Projectile Hit Event
                    const hitPayload: ProjectileHitEventPayload = {
                        matchId: this.matchId,
                        projectileId: projectile.id,
                        attackerId: projectile.ownerUnitId,
                        targetId: unit.id,
                        damageDealt: damage,
                        abilityId: projectile.abilityId,
                    };
                    this.io.to(this.matchId).emit(PROJECTILE_HIT, hitPayload);

                    // --- SET Target Cooldown --- 
                    projectile.hitCooldowns[unit.id] = now + PROJECTILE_HIT_COOLDOWN_MS;
                    // console.log(`[Collision Cooldown] Set cooldown for target ${unit.id} on projectile ${projectile.id} until ${projectile.hitCooldowns[unit.id]}`); // <-- Commented out
                    // --- END SET Cooldown ---

                    // Mark unit as hit by this projectile throw (for maxHitsPerUnit check)
                    if (!projectile.unitsHitThisThrow[unit.id]) {
                         projectile.unitsHitThisThrow[unit.id] = 0;
                    }
                    projectile.unitsHitThisThrow[unit.id] = (projectile.unitsHitThisThrow[unit.id] ?? 0) + 1; // Safe increment
                    // console.log(`[Boomerang Collision Debug ${projectile.id} -> ${unit.id}] Hit count incremented to: ${projectile.unitsHitThisThrow[unit.id]}`); // <-- Commented out

                    // Destroy projectile based on type:
                    if (projectile.projectileType === 'direct_projectile') {
                        destroyedProjectiles.add(projectile.id); 
                    }
                    // Boomerangs are destroyed in updateProjectiles based on return logic or lifespan
                    // AoE projectiles might detonate here or continue
                }
            });
        });

        // Remove destroyed projectiles
        destroyedProjectiles.forEach(id => this.projectiles.delete(id));

        // --- Melee Hit Detection ---
        this.combatUnits.forEach(unit => {
            if (unit.currentHp <= 0) return; // Skip dead units

            // Check if unit is performing a melee attack (this logic might need refinement)
            // For now, assume any unit can potentially hit via melee proximity? 
            // Or maybe only if they have a melee ability recently used?
            // Let's keep it simple: check proximity for all units

            this.combatUnits.forEach(potentialTarget => {
                if (unit.id === potentialTarget.id || potentialTarget.currentHp <= 0 || unit.owner === potentialTarget.owner) return;

                const distSq = distanceSq(unit.position, potentialTarget.position);
                const meleeRange = 30; // Example melee range
                if (distSq <= meleeRange * meleeRange) {
                    // Simple proximity hit for now
                    const damage = 10; // Example base melee damage
                    potentialTarget.currentHp = Math.max(0, potentialTarget.currentHp - damage);
                    // console.log(`[Collision Debug] Melee hit! ${unit.id} hit ${potentialTarget.id} for ${damage} damage.`);

                    // Emit melee hit event
                    const payload: MeleeHitEventPayload = {
                        matchId: this.matchId,
                        attackerId: unit.id,
                        targetId: potentialTarget.id,
                        damageDealt: damage,
                        abilityId: 'basic_melee' // Or determine actual ability if triggered
                    };
                    this.io.to(this.matchId).emit(MELEE_HIT, payload); // <-- Use MELEE_HIT constant
                }
            });
        });
    }

    private checkEndCondition(): void {
        if (this.status !== 'active') return; // Don't re-check if already ending

        let defeatedUnit: CombatUnitState | null = null;
        let winnerUnitId: GameObjectId | null = null; // Store potential winner

        for (const unit of this.combatUnits.values()) {
            // Comment out the verbose check log
            // console.log(`[CombatInstance:${this.matchId}] checkEndCondition: Checking unit ${unit.id} with HP ${unit.currentHp}`);
            if (unit.currentHp <= 0) {
                // console.log(`[CombatInstance:${this.matchId}] checkEndCondition: Unit ${unit.id} has HP <= 0.`);
                defeatedUnit = unit;
            } else {
                 winnerUnitId = unit.id; // If this is the only one left alive
            }
        }

        // Ensure there's exactly one loser found and implicitly one winner
        if (defeatedUnit) {
             // Double check the winner is actually the other unit
            const potentialWinner = this.combatUnits.get(winnerUnitId!); // winnerUnitId should be non-null if defeatedUnit is found in 2-unit combat
            if (!potentialWinner || potentialWinner.id === defeatedUnit.id || potentialWinner.currentHp <= 0) {
                 // console.error(`[CombatInstance:${this.matchId}] Logic error in determining winner/loser. Loser: ${defeatedUnit.id}, Potential Winner ID: ${winnerUnitId}`);
                 // TODO: Handle draw condition or error state?
                 // For now, proceed but log error
                 winnerUnitId = Array.from(this.combatUnits.keys()).find(id => id !== defeatedUnit!.id) ?? null;
            }

            this.status = 'terminating'; // Prevent further updates while we signal
            this.loserId = defeatedUnit.id;
            this.winnerId = winnerUnitId;

            // console.log(`[CombatInstance:${this.matchId}] Combat ended. Winner: ${this.winnerId}, Loser: ${this.loserId}`);

            const winnerState = this.winnerId ? this.combatUnits.get(this.winnerId) : null;
            const finalWinnerHp = winnerState?.currentHp ?? 0; // Use nullish coalescing for safety

            // Call the callback provided by CombatManager to update GameManager
            if (this.terminateCallback && this.winnerId && this.loserId) {
                 // Provide winner HP for potential persistence in GameManager
                 this.terminateCallback(this.matchId, this.winnerId, this.loserId, finalWinnerHp); // Pass safe HP value
            } else {
                // console.error(`[CombatInstance:${this.matchId}] Failed to determine winner/loser or terminateCallback missing! Winner: ${this.winnerId}, Loser: ${this.loserId}, Callback: ${!!this.terminateCallback}`);
                // Handle error? Maybe force a draw?
            }

            this.status = 'ended'; // Fully ended now
        }
    }

    getCombatStateSnapshot(): CombatStateUpdatePayload {
        return {
            matchId: this.matchId,
            units: Array.from(this.combatUnits.values()),
            projectiles: Array.from(this.projectiles.values()),
            activeAoEZones: Array.from(this.activeAoEZones.values()),
        };
    }

    getUnitOwner(unitId: GameObjectId): PlayerId | undefined {
        return this.combatUnits.get(unitId)?.owner;
    }

    // Method to broadcast the current state
    private broadcastStateUpdate(): void {
        const unitsState = Array.from(this.combatUnits.values());
        const projectilesState = Array.from(this.projectiles.values());
        const zonesState = Array.from(this.activeAoEZones.values()); 

        // Add log here
        // console.log(`[AoE Debug] broadcastStateUpdate: activeAoEZones size: ${this.activeAoEZones.size}`); // <-- Commented out

        const payload: CombatStateUpdatePayload = {
            matchId: this.matchId,
            units: unitsState,
            projectiles: projectilesState,
            activeAoEZones: zonesState
        };

        // --- Log Payload --- 
        // console.log(`[Broadcast Debug] Emitting combat_state_update. Zones count: ${payload.activeAoEZones.length}`); // COMMENTED OUT
        // if (payload.activeAoEZones.length > 0) { // COMMENTED OUT
        //     console.log(`[Broadcast Debug] Zone details:`, JSON.stringify(payload.activeAoEZones)); // COMMENTED OUT
        // } // COMMENTED OUT
        // --- End Log ---

        this.io.to(this.matchId).emit(COMBAT_STATE_UPDATE, payload);
        // console.log(`[CombatInstance:${this.matchId}] Broadcasted combat_state_update`);
    }
} 