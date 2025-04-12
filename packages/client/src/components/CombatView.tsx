import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { GameObjectId, MatchId, PlayerId, UnitDefinition, AbilityDefinition, CombatActionPayload, CombatStateUpdatePayload, Vector2, CombatUnitState, ProjectileState, MeleeHitEventPayload, ProjectileHitEventPayload, AoEZoneState } from '@archess/shared';
import { throttle } from 'lodash';
// import { socket } from '../App'; // Remove socket import

// Import styles
import './CombatView.css';
import MeleeSwingEffect from './MeleeSwingEffect'; // Import the new component
import KeyHintDisplay from './KeyHintDisplay'; // <-- Import the new component

// Constants for the arena size (should match server logic if possible)
const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
// Constants for the Joystick
const JOYSTICK_SIZE = 100; // Diameter of the base
const HANDLE_SIZE = 40; // Diameter of the handle
const JOYSTICK_CENTER = JOYSTICK_SIZE / 2;
const HANDLE_RADIUS = HANDLE_SIZE / 2;
const MAX_HANDLE_OFFSET = JOYSTICK_CENTER - HANDLE_RADIUS; // Max distance handle can move from center

// Add throttle interval constant
const MOVE_ACTION_THROTTLE_MS = 100; // Send move update every 100ms max

// --- TEMPORARY KEY BINDINGS --- 
const KEY_BINDINGS: { [key: string]: string } = {
  q: 'sword_swing',          // Melee
  w: 'throwing_knife',       // Direct Projectile
  e: 'returning_axe',        // Boomerang Projectile
  r: 'holy_grenade',         // AoE Projectile
};

interface CombatViewProps {
  matchId: MatchId;
  attackerId: GameObjectId;
  defenderId: GameObjectId;
  combatState: CombatStateUpdatePayload;
  unitDefinitions?: Record<string, UnitDefinition>;
  onCombatAction: (actionPayload: CombatActionPayload) => void;
  playerSocketId: PlayerId;
  lastMeleeHit: MeleeHitEventPayload | null;
  lastProjectileHit: ProjectileHitEventPayload | null;
  playerIds: PlayerId[];
}

// Helper function to get unit name/details (Should be outside component or memoized if inside)
const getUnitDetails = (unit: CombatUnitState | undefined, definitions?: Record<string, UnitDefinition>) => {
    if (!unit) return { name: 'N/A', maxHp: 0 };
    const def = definitions?.[unit.definitionId];
    return {
        name: def?.name ?? 'Unknown Unit',
        maxHp: def?.maxHp ?? 100,
    };
};

// Uncomment the local definition for client-side effect state
interface ActiveMeleeEffect { 
  id: string;
  attackerPos: Vector2;
  targetPos: Vector2;
}

// --- Targeting State --- 
interface TargetingState {
  isActive: boolean;
  abilityId: string | null;
  abilityType: AbilityDefinition['attackType'] | null; // Type of targeting needed
}

// Move normalize definition here, before it's used
const normalize = (vec: Vector2): Vector2 => {
  const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: vec.x / len, y: vec.y / len };
}

// Helper for calculating angle (defined locally)
const calculateAngle = (x: number, y: number): number => {
  if (x === 0 && y === 0) return 0; 
  return (Math.atan2(y, x) * 180) / Math.PI;
};

// Change to function declaration
function CombatView ({
  matchId,
  attackerId,
  defenderId,
  combatState,
  unitDefinitions,
  onCombatAction,
  playerSocketId,
  lastMeleeHit,
  lastProjectileHit,
  playerIds,
}: CombatViewProps): React.ReactElement {
  // const canvasRef = useRef<HTMLCanvasElement>(null); // Keep commented if not used
  const [hitUnitId, setHitUnitId] = useState<GameObjectId | null>(null); // State to track which unit was hit
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickHandleRef = useRef<HTMLDivElement>(null); // <-- ADD this ref
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false); // Tracks both touch and mouse drag
  const [handlePosition, setHandlePosition] = useState({ x: JOYSTICK_CENTER, y: JOYSTICK_CENTER });
  const [meleeEffects, setMeleeEffects] = useState<ActiveMeleeEffect[]>([]); // Uses the local interface now
  const arenaRef = useRef<HTMLDivElement>(null); // Ref for the arena div for click handling
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null); // <-- New state for key flash

  // --- Cleaned up State --- 
  // const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null); // Removed
  // Minimal targeting state potentially needed if we add other targeting mechanisms later, keep for now but simplify usage
  const [targetingState, setTargetingState] = useState<TargetingState>({ 
      isActive: false, 
      abilityId: null, 
      abilityType: null 
  });

  // Refs to manage dragging state and stable handler references for global listeners
  const isDraggingRef = useRef(false);
  const mouseMoveHandlerRef = useRef<(event: MouseEvent) => void>(() => {});
  const mouseUpHandlerRef = useRef<(event: MouseEvent) => void>(() => {});

  // Ref to track throttling
  const lastMoveActionTimeRef = useRef<number>(0);

  // Keep the ref updated with the latest state value
  useEffect(() => {
    isDraggingRef.current = isDraggingJoystick;
  }, [isDraggingJoystick]);

  // Commenting out the render log to reduce noise
  // console.log(`[CombatView Render] hitUnitId state: ${hitUnitId}`); 

  // Effect to handle the visual flash on melee hit
  useEffect(() => {
    // console.log('[CombatView Effect] Running effect for lastMeleeHit:', lastMeleeHit);
    if (lastMeleeHit) {
      // console.log(`[CombatView Effect] Melee hit detected on unit: ${lastMeleeHit.targetId}. Setting hitUnitId.`);
      setHitUnitId(lastMeleeHit.targetId);
      const timer = setTimeout(() => {
        // console.log('[CombatView Effect] Timeout clearing melee hitUnitId.');
        setHitUnitId(null);
      }, 300); 
      return () => {
        // console.log('[CombatView Effect] Melee cleanup function running.');
        clearTimeout(timer);
      }
    }
  }, [lastMeleeHit]);

  // --- NEW Effect to handle visual flash on projectile hit ---
  useEffect(() => {
    // console.log('[CombatView Effect] Running effect for lastProjectileHit:', lastProjectileHit);
    if (lastProjectileHit) {
      // console.log(`[CombatView Effect] Projectile hit detected on unit: ${lastProjectileHit.targetId}. Setting hitUnitId.`);
      setHitUnitId(lastProjectileHit.targetId);
      const timer = setTimeout(() => {
        // console.log('[CombatView Effect] Timeout clearing projectile hitUnitId.');
        setHitUnitId(null);
      }, 300); // Same duration for now
      return () => {
        // console.log('[CombatView Effect] Projectile cleanup function running.');
        clearTimeout(timer);
      }
    }
  }, [lastProjectileHit]); // Run effect when lastProjectileHit changes

  // Effect to create the swing animation originating from the *attacker*
  /*
  useEffect(() => {
    if (lastMeleeHit) {
      // We still need to read the latest unit positions, but the effect trigger
      // should only depend on the hit event itself.
      const attackerUnit = combatState.units.find((u: CombatUnitState) => u.id === lastMeleeHit.attackerId);
      const targetUnit = combatState.units.find((u: CombatUnitState) => u.id === lastMeleeHit.targetId);

      if (attackerUnit && targetUnit && attackerUnit.position && targetUnit.position) { 
        console.log(`[CombatView Effect] Creating server-hit melee swing effect from ${attackerUnit.id} to ${targetUnit.id}`); // Adjusted log
        const effectId = `melee-hit-${Date.now()}-${lastMeleeHit.attackerId}`; // Differentiate ID
        const newEffect: ActiveMeleeEffect = {
          id: effectId,
          attackerPos: attackerUnit.position, 
          targetPos: targetUnit.position,
        };

        setMeleeEffects((prev: ActiveMeleeEffect[]) => [...prev, newEffect]);

        const removalTimer = setTimeout(() => {
          console.log(`[CombatView Effect] Removing server-hit melee effect ${effectId}`);
          setMeleeEffects((prev: ActiveMeleeEffect[]) => prev.filter((eff: ActiveMeleeEffect) => eff.id !== effectId));
        }, 400); 

        return () => clearTimeout(removalTimer);
      } else {
          console.warn(`[CombatView Effect] Could not create server-hit swing effect. Attacker found: ${!!attackerUnit}, Target found: ${!!targetUnit}, Attacker pos: ${JSON.stringify(attackerUnit?.position)}, Target pos: ${JSON.stringify(targetUnit?.position)}`);
      }
    }
    // Only depend on lastMeleeHit. Read combatState.units inside when triggered.
  }, [lastMeleeHit]); 
  */

  // useEffect removed to reduce log noise

  const handleAction = useCallback((action: CombatActionPayload) => {
    // console.log("[CombatView] handleAction called with:", action); // Reduce logging
    if (onCombatAction) {
      onCombatAction(action);
    } else {
      console.warn("[CombatView] onCombatAction handler is not provided!");
    }
  }, [onCombatAction]); // Correct dependencies

  // Find initial unit data
  // const initialAttacker = combatState.units.find((u: CombatUnitState) => u.id === attackerId);
  // const initialDefender = combatState.units.find((u: CombatUnitState) => u.id === defenderId);

  // Memoize units and projectiles to avoid unnecessary re-renders if state object changes but content doesn't
  const units = combatState.units;
  const projectiles = combatState.projectiles;
  const activeAoEZones = combatState.activeAoEZones; // Use the correct name from the payload

  // Find attacker/defender units from the current combatState
  const attacker = units.find((u: CombatUnitState) => u.id === attackerId);
  const defender = units.find((u: CombatUnitState) => u.id === defenderId);

  // --- Client-side Swing Effect --- 
  // Keep this inside the component body, wrapped in useCallback
  const controlledUnit = useMemo(() => 
      units.find((u: CombatUnitState) => u.owner === playerSocketId)
  , [units, playerSocketId]);

  const createClientSideSwingEffect = useCallback((attackerPos: Vector2, targetPos: Vector2) => {
      if (!controlledUnit) return;
      const effectId = `melee-swing-${Date.now()}-${controlledUnit.id}`;
      const newEffect: ActiveMeleeEffect = { id: effectId, attackerPos, targetPos };
      setMeleeEffects((prev: ActiveMeleeEffect[]) => [...prev, newEffect]);
      setTimeout(() => {
          console.log(`[CombatView] Removing client-side melee effect ${effectId}`);
          setMeleeEffects((prev: ActiveMeleeEffect[]) => prev.filter((eff: ActiveMeleeEffect) => eff.id !== effectId));
      }, 400); 
  }, [controlledUnit]); // Dependency is controlledUnit

  // Throttle startMove actions - Now directly uses onCombatAction
  const throttledHandleAction = useMemo(() => 
    throttle(onCombatAction, 100, { leading: true, trailing: false }), 
    [onCombatAction] // Depends on the actual prop now
  );

  // Joystick state and handlers
  const updateJoystick = useCallback((event: any) => {
    const stick = event.target.instance;
    if (stick && stick.active) {
      const direction = stick.direction; // Gets 'up', 'down', 'left', 'right'
      const distance = stick.distance;
      const angle = stick.angle.radian;
      const threshold = 20; // Minimum distance to trigger movement

      if (distance > threshold && direction) {
        const vector: Vector2 = { x: Math.cos(angle), y: Math.sin(angle) };
        throttledHandleAction({ type: 'startMove', direction: vector });
      }
    }
  }, [throttledHandleAction]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    // --- Add Log --- 
    console.log("[CombatView] handleTouchStart triggered");
    event.preventDefault();
    if (event.touches.length > 0 && event.touches[0]) {
        setIsDraggingJoystick(true);
        isDraggingRef.current = true;
        updateJoystick(event);
    }
  }, [updateJoystick]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    // --- Add Log --- 
    console.log("[CombatView] handleTouchMove triggered");
    event.preventDefault();
    if (isDraggingRef.current && event.touches.length > 0 && event.touches[0]) {
        updateJoystick(event);
    }
  }, [updateJoystick]);

  const handleTouchEnd = useCallback(() => {
    throttledHandleAction.cancel();
    // Call onCombatAction directly
    onCombatAction({ type: 'stopMove' });
  }, [onCombatAction, throttledHandleAction]);

  // Wrap mouse handlers in useCallback
  const handleGlobalMouseMove = useCallback((event: MouseEvent) => {
    if (!isDraggingRef.current || !joystickBaseRef.current) return;

    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + JOYSTICK_CENTER;
    const centerY = rect.top + JOYSTICK_CENTER;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const distance = Math.sqrt(deltaX*deltaX + deltaY*deltaY);

    let handleOffsetX = JOYSTICK_CENTER + deltaX; // Offset relative to base center
    let handleOffsetY = JOYSTICK_CENTER + deltaY;

    // Calculate direction vector for game logic (normalized)
    let moveVector: Vector2 = { x: 0, y: 0 };

    if (distance > 0) {
        const dirX = deltaX / distance;
        const dirY = deltaY / distance;
        moveVector = { x: dirX, y: dirY };

        if (distance > MAX_HANDLE_OFFSET) {
            // Clamp visual offset
            handleOffsetX = JOYSTICK_CENTER + dirX * MAX_HANDLE_OFFSET;
            handleOffsetY = JOYSTICK_CENTER + dirY * MAX_HANDLE_OFFSET;
        }
        throttledHandleAction({ type: 'startMove', direction: moveVector });

    } else {
        // If exactly at center, reset offset visually
        handleOffsetX = JOYSTICK_CENTER;
        handleOffsetY = JOYSTICK_CENTER;
        // Optionally send stopMove if needed, though handleGlobalMouseUp should cover it.
    }

    // Update the visual handle position state (relative to base top-left)
    setHandlePosition({ x: handleOffsetX, y: handleOffsetY });

  }, [throttledHandleAction]);

  const handleGlobalMouseUp = useCallback(() => {
    if (isDraggingRef.current) { // Only act if we were dragging
        throttledHandleAction.cancel();
        onCombatAction({ type: 'stopMove' });
        setIsDraggingJoystick(false);
        isDraggingRef.current = false; // <-- Ensure ref is reset
        // Reset visual handle position
        setHandlePosition({ x: JOYSTICK_CENTER, y: JOYSTICK_CENTER });
    }
  }, [onCombatAction, throttledHandleAction]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Prevent default only if it's the joystick handle to allow text selection etc. elsewhere
    if (event.target === joystickHandleRef.current) {
      event.preventDefault(); 
      setIsDraggingJoystick(true);
      isDraggingRef.current = true;
      // No need to call updateJoystick here, mouseMove will handle it
    } 
  }, []); // No dependencies needed

  // Attach/detach global mouse listeners when dragging state changes
  useEffect(() => {
    const moveHandler = (event: MouseEvent) => handleGlobalMouseMove(event);
    const upHandler = () => handleGlobalMouseUp(); // No event needed

    if (isDraggingJoystick) {
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    } else {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    }

    // Cleanup function
    return () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };
  }, [isDraggingJoystick, handleGlobalMouseMove, handleGlobalMouseUp]); // Add handlers to dependencies

  const controlledUnitDef = useMemo(() => 
      controlledUnit ? unitDefinitions?.[controlledUnit.definitionId] : null
  , [controlledUnit, unitDefinitions]);

  // --- NEW: Keyboard Ability Trigger Effect --- 
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (!controlledUnit || !controlledUnitDef) return;

      let moving = false;
      let mutableMoveDir = { x: 0, y: 0 };
      if (event.key.toLowerCase() === 'w') { mutableMoveDir.y = -1; moving = true; }
      if (event.key.toLowerCase() === 's') { mutableMoveDir.y = 1; moving = true; }
      if (event.key.toLowerCase() === 'a') { mutableMoveDir.x = -1; moving = true; }
      if (event.key.toLowerCase() === 'd') { mutableMoveDir.x = 1; moving = true; }
      if (moving) {
        const normalized = normalize(mutableMoveDir);
        // Call onCombatAction directly
        onCombatAction({ type: 'startMove', direction: normalized }); 
        return;
      }

      // --- Abilities --- 
      const key = event.key.toLowerCase();
      const abilityId = KEY_BINDINGS[key];
      if (abilityId) {
        setLastKeyPressed(key); 
        setTimeout(() => setLastKeyPressed(null), 150);

        const abilityDef = controlledUnitDef.combatAbilities.find((ab: AbilityDefinition) => ab.id === abilityId);
        if (abilityDef) {
            const now = Date.now();
            const cooldownEndTime = controlledUnit.abilityCooldowns[abilityId] ?? 0;
            if (now < cooldownEndTime) {
                console.log(`[CombatView Keybind] Ability ${abilityId} on cooldown.`);
                return; // On cooldown
            }

            console.log(`[CombatView Keybind] Triggering ability: ${abilityId}`);
            let payload: CombatActionPayload | null = null;
            let triggerClientMeleeVisual = false;
            let estimatedTargetPos: Vector2 | null = null;

            // Calculate facing direction for visual effects / targeting
            let facingDir = controlledUnit.facingDirection ?? { x: 1, y: 0 };
            if (controlledUnit.velocity.x !== 0 || controlledUnit.velocity.y !== 0) {
                const normVel = Math.sqrt(controlledUnit.velocity.x**2 + controlledUnit.velocity.y**2);
                if (normVel > 0.01) {
                     facingDir = { x: controlledUnit.velocity.x / normVel, y: controlledUnit.velocity.y / normVel };
                }
            } else if (controlledUnit.lastMovementDirection) {
                facingDir = controlledUnit.lastMovementDirection;
            }
            
            // Determine payload based on ability type - NO CLICK TARGETING
            if (abilityDef.attackType === 'melee' || 
                abilityDef.attackType === 'direct_projectile' || 
                abilityDef.attackType === 'boomerang_projectile' ||
                abilityDef.type === 'movement' || 
                abilityDef.type === 'support') 
            { 
                payload = { type: 'useAbility', abilityId: abilityId }; 
                if (abilityDef.attackType === 'melee') {
                    triggerClientMeleeVisual = true;
                    const range = abilityDef.range ?? 35;
                    estimatedTargetPos = {
                        x: controlledUnit.position.x + facingDir.x * range,
                        y: controlledUnit.position.y + facingDir.y * range
                    };
                }
            } else if (abilityDef.attackType === 'aoe_projectile') {
                const range = abilityDef.range ?? 200;
                const targetPosition: Vector2 = {
                    x: controlledUnit.position.x + facingDir.x * range,
                    y: controlledUnit.position.y + facingDir.y * range
                };
                payload = { type: 'useAbility', abilityId: abilityId, targetPosition: targetPosition };
            } else {
                console.warn(`[CombatView Keybind] Unhandled ability type/attackType for ${abilityId}`);
            }

            if (payload) {
                // Call onCombatAction directly
                onCombatAction(payload); 
                if (triggerClientMeleeVisual && controlledUnit.position && estimatedTargetPos) {
                    createClientSideSwingEffect(controlledUnit.position, estimatedTargetPos);
                }
            } 
        } else {
            console.warn(`[CombatView Keybind] Ability definition not found for ID: ${abilityId}`);
        }
      } 
      // Remove Escape key handler for targeting
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (['w', 'a', 's', 'd'].includes(event.key.toLowerCase())) {
            // console.log('[CombatView Keybind] Sending stopMove on keyup');
            handleAction({ type: 'stopMove' });
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  // Update dependencies: remove targetingState
  }, [controlledUnit, controlledUnitDef, handleAction, createClientSideSwingEffect]); 

  // --- RENDER --- 

  if (!attacker || !defender) { // Check units from combatState
    return <div>Loading combatants...</div>;
  }

  const attackerDetails = getUnitDetails(attacker, unitDefinitions);
  const defenderDetails = getUnitDetails(defender, unitDefinitions);

  // --- DEBUG: Log received combat state --- 
  /* // <-- Comment out the noisy log
  console.log("[CombatView Render Debug] Combat State Received:", {
      unitsCount: combatState.units.length,
      projectilesCount: combatState.projectiles.length,
      activeAoEZones: combatState.activeAoEZones // Log the actual zones array
  });
  */
  // --- END DEBUG --- 

  return (
    <div className="combat-view-container"> {/* Use container class */}
      <h2>COMBAT!</h2>
      <p>Match: {matchId}</p>
       {/* Status Display */}
      <div className="combat-status">
          <div>Attacker: {attackerDetails.name} (HP: {attacker.currentHp.toFixed(0)} / {attackerDetails.maxHp})</div>
          <div>Defender: {defenderDetails.name} (HP: {defender.currentHp.toFixed(0)} / {defenderDetails.maxHp})</div>
      </div>

      {/* --- Key Hint Display Component (Moved Above Arena) --- */}
      <div className="key-hint-container">
        <KeyHintDisplay 
            bindings={KEY_BINDINGS} 
            lastKeyPressed={lastKeyPressed} 
            unitAbilities={controlledUnitDef?.combatAbilities ?? []} 
        />
      </div>

      {/* Arena (Should come AFTER key hints) */}
      <div
        ref={arenaRef}
        className="combat-arena"
        style={{ width: `${ARENA_WIDTH}px`, height: `${ARENA_HEIGHT}px` }}
        aria-label="Combat Arena Background" 
      >
        {/* Render Units */} 
        {units.map((unit: CombatUnitState) => {
          const unitDef = unitDefinitions?.[unit.definitionId];
          const isPlayer1Unit = playerIds[0] && unit.owner === playerIds[0]; // Check if unit owner is Player 1
          const isHit = unit.id === hitUnitId;
          const angle = unit.facingDirection 
              ? calculateAngle(unit.facingDirection.x, unit.facingDirection.y)
              : 0; // Default angle if no facing direction
           return (
            <div
              key={unit.id}
              className={`combat-unit ${isPlayer1Unit ? 'player-unit' : 'enemy-unit'} ${isHit ? 'hit-effect' : ''}`}
              style={{ 
                  left: `${unit.position.x - (unitDef?.hitboxRadius ?? 10)}px`, 
                  top: `${unit.position.y - (unitDef?.hitboxRadius ?? 10)}px`,
                  width: `${(unitDef?.hitboxRadius ?? 10) * 2}px`,
                  height: `${(unitDef?.hitboxRadius ?? 10) * 2}px`,
                  transform: `rotate(${angle}deg)`
              }}
              aria-label={`Unit ${unitDef?.name ?? 'Unknown'} at ${unit.position.x}, ${unit.position.y}`}
            >
              <span className="unit-icon">{unitDef?.name?.charAt(0) ?? 'U'}</span>
              <div className="hp-bar-container">
                  <div className="hp-bar" style={{ width: `${Math.max(0, (unit.currentHp / (unitDef?.maxHp ?? 100)) * 100)}%` }} />
              </div>
            </div>
          );
        })}

        {/* Render Projectiles */} 
        {projectiles.map((proj: ProjectileState) => {
            let projClass = 'projectile-default'; // Default class
            if (proj.projectileType === 'aoe_projectile') {
                projClass = 'aoe-projectile';
            } // Add more else if for other types later if needed

             const projStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${proj.position.x}px`,
                top: `${proj.position.y}px`,
                transform: `rotate(${calculateAngle(proj.velocity.x, proj.velocity.y)}deg)`
              };
             // Apply class dynamically
             return <div key={proj.id} className={`projectile ${projClass}`} style={projStyle} title={`Projectile ${proj.abilityId}`}></div>;
         })}
         
         {/* --- Render Melee Swing Effects --- */} 
         {meleeEffects.map((effect: ActiveMeleeEffect) => {
              // console.log(`[CombatView] Rendering MeleeSwingEffect for ID: ${effect.id}`); // Log render attempt
              // Calculate angle for the effect based on positions
              const angle = effect.attackerPos && effect.targetPos ? calculateAngle(effect.targetPos.x - effect.attackerPos.x, effect.targetPos.y - effect.attackerPos.y) : 0;
              return (
                  <MeleeSwingEffect 
                     key={effect.id} // <-- Add key prop
                     attackerPos={effect.attackerPos} 
                     targetPos={effect.targetPos} 
                     duration={400} // Pass duration
                     angle={angle} // Pass the calculated angle
                 />
             );
         })}
 
         {/* --- NEW: Render AoE Zones --- */}
         {activeAoEZones?.map((zone) => { // <-- Remove type AoEZoneState to fix unused var
             const zoneStyle: React.CSSProperties = {
                 position: 'absolute',
                 left: `${zone.position.x - zone.radius}px`,
                 top: `${zone.position.y - zone.radius}px`,
                 width: `${zone.radius * 2}px`,
                 height: `${zone.radius * 2}px`,
                 borderRadius: '50%', // Keep as circle
                 backgroundColor: 'rgba(255, 0, 0, 0.3)', // Example: semi-transparent red
                 pointerEvents: 'none', // Non-interactive
                 zIndex: 10, // Below units/projectiles
             };
             return (
                 <div 
                     key={zone.id}
                     className={`aoe-zone ${zone.visualEffectKey ?? ''}`}
                     style={zoneStyle} // Apply the corrected style
                     aria-label={`Area effect ${zone.id}`}
                 />
             );
         })}
         {/* --- End AoE Zones --- */}
       </div> {/* End of combat-arena div */}
 
       {/* Controls Area (Should come AFTER key hints) */}
       <div className="combat-controls">
         {/* Touch Controls Area */} 
        <div className="touch-controls">
             <div 
               className="joystick-area"
               ref={joystickBaseRef}
               onTouchStart={handleTouchStart} 
               onTouchMove={handleTouchMove}   
               onTouchEnd={handleTouchEnd}     
               onTouchCancel={handleTouchEnd}  
               onMouseDown={handleMouseDown}   
             >
                 <div 
                     ref={joystickHandleRef} // <-- Add ref to handle
                     className="joystick-handle" 
                     style={{ left: `${handlePosition.x}px`, top: `${handlePosition.y}px` }}
                 ></div>
             </div>
              {/* Action Buttons Area Removed */}
             {/* <div className="action-buttons-area"> ... </div> */}
        </div>
 
        {/* Targeting Indicator */}
        {targetingState.isActive && (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div className="targeting-indicator">
                Targeting active for: {controlledUnitDef?.combatAbilities.find((a: AbilityDefinition) => a.id === targetingState.abilityId)?.name} 
                ({targetingState.abilityType === 'aoe_projectile' ? 'Click Ground' : 'Click Enemy'})
                <button type="button" onClick={() => { 
                    setTargetingState({ isActive: false, abilityId: null, abilityType: null });
                }}>Cancel</button>
            </div>
        )}
       </div> {/* End combat-controls */} 
     </div> // End combat-view-container 
   );
 }; // End of CombatView function component
 
 export default CombatView; // Ensure export is present