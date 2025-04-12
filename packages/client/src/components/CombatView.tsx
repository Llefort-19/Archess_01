import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { GameObjectId, MatchId, PlayerId, UnitDefinition, AbilityDefinition, CombatActionPayload, /* CombatStateUpdatePayload, */ Vector2, CombatUnitState, ProjectileState, MeleeHitEventPayload, ProjectileHitEventPayload, AoEZoneState } from '@archess/shared';
// Remove throttle import, it's now in useJoystickInput
// import { throttle } from 'lodash';

// Import hooks
import { useKeyboardCombatInput } from '../hooks/useKeyboardCombatInput';
import { useJoystickInput } from '../hooks/useJoystickInput';

// Import styles
import './CombatView.css';
import MeleeSwingEffect from './MeleeSwingEffect'; // Import the new component
import KeyHintDisplay from './KeyHintDisplay'; // <-- Import the new component
import CombatArena from './CombatArena'; // <-- Import CombatArena

// Constants for the arena size (should match server logic if possible)
const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
// Constants for the Joystick
// const JOYSTICK_SIZE = 100; // Diameter of the base
const HANDLE_SIZE = 40; // Keep needed for centering the visual handle
// const JOYSTICK_CENTER = JOYSTICK_SIZE / 2;
// const HANDLE_RADIUS = HANDLE_SIZE / 2;
// const MAX_HANDLE_OFFSET = JOYSTICK_CENTER - HANDLE_RADIUS; // Max distance handle can move from center

// Add throttle interval constant
// const MOVE_ACTION_THROTTLE_MS = 100; // Send move update every 100ms max

// --- TEMPORARY KEY BINDINGS ---
/*
const KEY_BINDINGS: { [key: string]: string } = {
  u: 'sword_swing',          // Melee (was q)
  i: 'throwing_knife',       // Direct Projectile (was w)
  o: 'returning_axe',        // Boomerang Projectile (was e)
  p: 'holy_grenade',         // AoE Projectile (was r)
};
*/

// --- ADDED Positional Mapping For Display ---
const ABILITY_KEY_DISPLAY_ORDER: string[] = ['u', 'i', 'o', 'p'];

interface CombatViewProps {
  matchId: MatchId;
  attackerId: GameObjectId;
  defenderId: GameObjectId;
  // Remove combatState, add individual props
  // combatState: CombatStateUpdatePayload;
  units: CombatUnitState[];
  projectiles: ProjectileState[];
  activeAoEZones: AoEZoneState[];
  unitDefinitions?: Record<string, UnitDefinition>; // Keep this optional
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

// Helper for calculating angle (defined locally)
const calculateAngle = (x: number, y: number): number => {
  if (x === 0 && y === 0) return 0; 
  return (Math.atan2(y, x) * 180) / Math.PI;
};

// Use React.memo to wrap the component
const CombatViewComponent: React.FC<CombatViewProps> = ({
  matchId,
  attackerId,
  defenderId,
  // Destructure new props
  units, 
  projectiles,
  activeAoEZones,
  unitDefinitions,
  onCombatAction,
  playerSocketId,
  lastMeleeHit,
  lastProjectileHit,
  playerIds,
}) => {
  // Arena dimensions (Consider making these props or constants)
  const ARENA_WIDTH = 800;
  const ARENA_HEIGHT = 600;

  // --- State --- 
  const arenaRef = useRef<HTMLDivElement>(null); // Ref for the arena element
  // Local state for client-side visual effects
  const [meleeEffects, setMeleeEffects] = useState<ActiveMeleeEffect[]>([]);
  // Local state for targeting indicator
  const [targetingState, setTargetingState] = useState<TargetingState>({ isActive: false, abilityId: null, abilityType: null });
  // State to track the ID of the unit hit by the last projectile (for visual feedback)
  const [hitUnitId, setHitUnitId] = useState<GameObjectId | null>(null);

  // --- Memoization for derived state --- 
  const attacker = useMemo(() => units.find(u => u.id === attackerId), [units, attackerId]);
  const defender = useMemo(() => units.find(u => u.id === defenderId), [units, defenderId]);
  
  // Memoize derived state to prevent unnecessary recalculations
  const controlledUnit = useMemo(() => {
    // const unit = units.find(u => u.id === attackerId); // <-- OLD LOGIC
    // Correct Logic: Find the unit owned by the current player viewing this instance
    const unit = units.find(u => u.owner === playerSocketId);
    return unit;
  }, [units, playerSocketId]); // Update dependencies to playerSocketId

  const controlledUnitDef = useMemo(() => {
    if (!controlledUnit?.definitionId || !unitDefinitions) return undefined;
    const unitDef = unitDefinitions[controlledUnit.definitionId];
    return unitDef;
  }, [controlledUnit?.definitionId, unitDefinitions]);

  // --- Callbacks (Define BEFORE hooks that use them) --- 
  const createClientSideSwingEffect = useCallback((attackerPos: Vector2, targetPos: Vector2) => {
      if (!controlledUnit) return;
      const effectId = `melee-swing-${Date.now()}-${controlledUnit.id}`;
      const newEffect: ActiveMeleeEffect = { id: effectId, attackerPos, targetPos };
      setMeleeEffects((prev: ActiveMeleeEffect[]) => [...prev, newEffect]);
      setTimeout(() => {
          setMeleeEffects((prev: ActiveMeleeEffect[]) => prev.filter((eff: ActiveMeleeEffect) => eff.id !== effectId));
      }, 400); 
  }, [controlledUnit?.id]);

  // Define the core combat action dispatcher with useCallback
  const handleCombatActionDispatch = useCallback((actionPayload: CombatActionPayload) => {
    // Add any intermediate logic here if needed, e.g., validation, client-side prediction
    onCombatAction(actionPayload);
  }, [onCombatAction]); // Dependency on the original onCombatAction prop

  // --- Input Hooks (Called Unconditionally at Top Level) ---
  const keyboardInput = useKeyboardCombatInput({
      controlledUnit,
      controlledUnitDef,
      onCombatAction: handleCombatActionDispatch, // Use the memoized dispatcher
      triggerClientMeleeEffect: createClientSideSwingEffect, // Now defined
  });
  const joystickInput = useJoystickInput({ 
      onCombatAction: handleCombatActionDispatch // Use the memoized dispatcher
  });
  
  // --- Local State for Input Hooks (REMOVED) ---
  // Remove these useState calls as we use the hook results directly
  // const [keyboardInput, setKeyboardInput] = useState<{ lastKeyPressed: string | null }>({ lastKeyPressed: null });
  // const [joystickInput, setJoystickInput] = useState<{ /* ... type ... */ } | null>(null);

  // --- Effects --- 
  // Effect to handle projectile hit visuals
  useEffect(() => {
      if (lastProjectileHit && lastProjectileHit.targetId) {
          setHitUnitId(lastProjectileHit.targetId);
          const timer = setTimeout(() => setHitUnitId(null), 300); // Clear after 300ms
          return () => clearTimeout(timer);
      }
  }, [lastProjectileHit]); // Depend on lastProjectileHit

  // Effect to handle click events on the arena (for targeting)
  useEffect(() => {
    const arenaElement = arenaRef.current;
    if (!arenaElement || !targetingState.isActive || !controlledUnit || !controlledUnitDef) return;

    const handleClick = (event: MouseEvent) => {
      const rect = arenaElement.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      const targetPosition = { x: clickX, y: clickY };

      if (targetingState.abilityId) {
        onCombatAction({
          type: 'useAbility',
          abilityId: targetingState.abilityId,
          targetPosition: targetPosition,
          // targetUnitId might be needed for direct attacks
        });
        // Reset targeting state after action
        setTargetingState({ isActive: false, abilityId: null, abilityType: null });
      }
    };

    arenaElement.addEventListener('click', handleClick);
    return () => {
      arenaElement.removeEventListener('click', handleClick);
    };
  }, [arenaRef, targetingState, controlledUnit, controlledUnitDef, onCombatAction]);

  // --- REMOVED useEffect for Initializing Input Hooks --- 
  /*
  useEffect(() => {
    try {
      if (controlledUnit && controlledUnitDef) {
          console.log(`[CombatView ${playerSocketId}] Initializing input hooks inside useEffect. Unit ID: ${controlledUnit.id}`);
          const keyboardHookResult = useKeyboardCombatInput({
              controlledUnit,
              controlledUnitDef,
              onCombatAction,
              triggerClientMeleeEffect: createClientSideSwingEffect,
          });
          // setKeyboardInput(keyboardHookResult); 
          const joystickHookResult = useJoystickInput({ 
              onCombatAction
          });
          // setJoystickInput(joystickHookResult);
      } else {
          console.log(`[CombatView ${playerSocketId}] Skipping input hook initialization (no unit/def).`);
          // setKeyboardInput({ lastKeyPressed: null });
          // setJoystickInput(null);
      }
    } catch (error) {
      console.error(`[CombatView ${playerSocketId}] Error initializing input hooks:`, error);
    }
  }, [controlledUnit?.id, controlledUnitDef?.id, onCombatAction, createClientSideSwingEffect, playerSocketId]); 
  */

  // Use values directly from hooks
  const lastKeyPressed = keyboardInput.lastKeyPressed;
  const joystickProps = joystickInput;

  // Log the value being passed to KeyHintDisplay
  // console.log(`[CombatView ${playerSocketId}] Rendering KeyHintDisplay with lastKeyPressed: ${lastKeyPressed}`); // <-- REMOVE LOG

  // --- RENDER --- 
  if (!attacker || !defender) {
    return <div>Loading combatants...</div>;
  }

  const attackerDetails = getUnitDetails(attacker, unitDefinitions);
  const defenderDetails = getUnitDetails(defender, unitDefinitions);

  return (
    <div className="combat-view-container"> 
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
            keyOrder={ABILITY_KEY_DISPLAY_ORDER}
            lastKeyPressed={lastKeyPressed} // Pass the state here
            unitAbilities={controlledUnitDef?.combatAbilities ?? []}
        />
      </div>

      {/* Arena Component */} 
      <CombatArena
          units={units}
          projectiles={projectiles}
          activeAoEZones={activeAoEZones}
          meleeEffects={meleeEffects}
          unitDefinitions={unitDefinitions}
          playerIds={playerIds}
          hitUnitId={hitUnitId}
          arenaRef={arenaRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
      />

       {/* Controls Area (Should come AFTER key hints) */}
       <div className="combat-controls">
         {/* Touch Controls Area */} 
         {joystickProps && ( // Conditionally render joystick if initialized
           <div className="touch-controls">
             <div 
               className="joystick-area"
               ref={joystickProps.joystickBaseRef}
               onTouchStart={joystickProps.handleTouchStart} 
               onTouchMove={joystickProps.handleTouchMove}   
               onTouchEnd={joystickProps.handleTouchEnd}     
               onTouchCancel={joystickProps.handleTouchEnd}  
               onMouseDown={joystickProps.handleMouseDown}   
             >
                 <div 
                     ref={joystickProps.joystickHandleRef} // <-- Use ref from state
                     className="joystick-handle" 
                     style={{ left: `${joystickProps.handlePosition.x}px`, top: `${joystickProps.handlePosition.y}px` }}
                 ></div>
             </div>
              {/* Action Buttons Area Removed */}
             {/* <div className="action-buttons-area"> ... </div> */}
           </div>
         )}
 
        {/* Targeting Indicator */}
        {targetingState.isActive && (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div className="targeting-indicator">
                {/* Fix Linter Error: Use memoized controlledUnitDef safely */}
                Targeting active for: {controlledUnitDef?.combatAbilities?.find((a: AbilityDefinition) => a.id === targetingState.abilityId)?.name} 
                ({targetingState.abilityType === 'aoe_projectile' ? 'Click Ground' : 'Click Enemy'})
                <button type="button" onClick={() => { 
                    setTargetingState({ isActive: false, abilityId: null, abilityType: null });
                }}>Cancel</button>
            </div>
        )}
       </div> {/* End combat-controls */} 
     </div> // End combat-view-container 
   );
 }; 

// Export the memoized component
const CombatView = React.memo(CombatViewComponent);

 export default CombatView; // Ensure default export points to the memoized component