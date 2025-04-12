import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
    CombatUnitState, 
    UnitDefinition, 
    AbilityDefinition, 
    CombatActionPayload, 
    Vector2 
} from '@archess/shared';

// Define key bindings outside the hook (or pass as arg if configurable)
const ABILITY_KEY_MAP: { [key: string]: number } = {
  u: 0,
  i: 1,
  o: 2,
  p: 3,
};
const ABILITY_KEYS = Object.keys(ABILITY_KEY_MAP); // ['u', 'i', 'o', 'p']

// Helper to normalize vectors (can be moved to a shared util later)
const normalize = (vec: Vector2): Vector2 => {
  const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: vec.x / len, y: vec.y / len };
}

interface KeyboardInputOptions {
  controlledUnit: CombatUnitState | undefined;
  controlledUnitDef: UnitDefinition | undefined;
  onCombatAction: (payload: CombatActionPayload) => void;
  // Callback for triggering client-side effects immediately
  triggerClientMeleeEffect?: (attackerPos: Vector2, targetPos: Vector2) => void; 
}

export function useKeyboardCombatInput({
  controlledUnit,
  controlledUnitDef,
  onCombatAction,
  triggerClientMeleeEffect
}: KeyboardInputOptions) {
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null);
  // Use a ref to track currently pressed movement keys
  const activeMovementKeys = useRef(new Set<string>());
  // Use a ref to prevent action spam from key repeat
  const keyPressState = useRef<Record<string, boolean>>({});

  // --- Refs for latest state/props needed inside listeners --- 
  const controlledUnitRef = useRef(controlledUnit);
  const controlledUnitDefRef = useRef(controlledUnitDef);
  const onCombatActionRef = useRef(onCombatAction);
  const triggerClientMeleeEffectRef = useRef(triggerClientMeleeEffect);

  // --- Update refs whenever props change --- 
  useEffect(() => {
      controlledUnitRef.current = controlledUnit;
  }, [controlledUnit]);

  useEffect(() => {
      controlledUnitDefRef.current = controlledUnitDef;
  }, [controlledUnitDef]);

  useEffect(() => {
      onCombatActionRef.current = onCombatAction;
  }, [onCombatAction]);

  useEffect(() => {
      triggerClientMeleeEffectRef.current = triggerClientMeleeEffect;
  }, [triggerClientMeleeEffect]);

  // Memoize the core action handler
  const handleAction = useCallback((action: CombatActionPayload) => {
    // console.log("[useKeyboardInput] handleAction called with:", action); // <-- REMOVE LOG
    onCombatActionRef.current(action);
  }, []); // Keep dependencies empty for stability with refs

  // Function to calculate the net movement vector based on active keys
  const calculateNetMovement = useCallback(() => {
    let moveVector: Vector2 = { x: 0, y: 0 };
    if (activeMovementKeys.current.has('w')) moveVector.y -= 1;
    if (activeMovementKeys.current.has('s')) moveVector.y += 1;
    if (activeMovementKeys.current.has('a')) moveVector.x -= 1;
    if (activeMovementKeys.current.has('d')) moveVector.x += 1;
    // Normalize only if there is movement
    return (moveVector.x !== 0 || moveVector.y !== 0) ? normalize(moveVector) : null;
  }, []);

  useEffect(() => {
    // console.log("[useKeyboardInput Effect] ATTACHING listeners..."); // <-- REMOVE LOG

    // Define handlers *inside* the effect so they close over the refs
    // and don't need to be dependencies themselves.
    const handleKeyDown = (event: KeyboardEvent) => {
      // console.log('[useKeyboardInput] Raw KeyDown Event:', event.key); // <-- REMOVE
      // --- Add Initial Log --- 
      // console.log(`[useKeyboardInput] KeyDown: key='${event.key}', code='${event.code}', repeat=${event.repeat}`); // <-- REMOVE

      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          // console.log("[useKeyboardInput KeyDown] Ignored: Input focused."); // <-- REMOVE
          return;
      }
      // --- Read latest unit data from refs --- 
      const currentUnit = controlledUnitRef.current;
      const currentUnitDef = controlledUnitDefRef.current;
      if (!currentUnit || !currentUnitDef) {
          // console.log("[useKeyboardInput KeyDown] Ignored: Ref has no controlled unit/def."); // <-- REMOVE
          return;
      }

      const keyLower = event.key.toLowerCase();

      if (['w', 'a', 's', 'd', 'u', 'i', 'o', 'p'].includes(keyLower)) {
          // console.log("[useKeyboardInput KeyDown] Preventing default for:", keyLower);
          event.preventDefault();
      }

      if (keyPressState.current[keyLower]) {
          // console.log("[useKeyboardInput KeyDown] Ignored: Key repeat.");
          return;
      }
      keyPressState.current[keyLower] = true;
      // console.log(`[useKeyboardInput KeyDown] Processing NEW key press: ${keyLower}`); // <-- REMOVE

      // --- Movement Handling --- 
      if (['w', 'a', 's', 'd'].includes(keyLower)) {
        // console.log("[useKeyboardInput KeyDown] Movement key detected:", keyLower); // <-- REMOVE
        activeMovementKeys.current.add(keyLower);
        const netMovement = calculateNetMovement();
        if (netMovement) {
            // console.log(`[useKeyboardInput KeyDown] Sending startMove:`, netMovement, `Keys:`, Array.from(activeMovementKeys.current)); // <-- REMOVE
            handleAction({ type: 'startMove', direction: netMovement });
        } else {
            // console.log("[useKeyboardInput KeyDown] Calculated no net movement despite key press?"); // <-- REMOVE
        }
      }

      // --- Ability Handling --- 
      // Find the index associated with the key
      const abilityIndex = ABILITY_KEY_MAP[keyLower];
      const isAbilityKey = abilityIndex !== undefined;

      // Use index to find the ability definition
      const abilityDef = isAbilityKey && currentUnitDef.combatAbilities ? currentUnitDef.combatAbilities[abilityIndex] : undefined;
      const isMoving = calculateNetMovement() !== null;

      // Allow triggering if it's a valid ability key for this unit AND (not moving OR it's the 'W' key)
      // Note: We might need more sophisticated logic later (e.g., allow casting while moving)
      const canTriggerAbility = abilityDef && (!isMoving || keyLower === 'w');

      if (canTriggerAbility) {
         // Use abilityDef.id directly now
         const abilityId = abilityDef.id;
         // console.log(`[useKeyboardInput KeyDown] Ability key candidate: ${keyLower}, Index: ${abilityIndex}, ID: ${abilityId}, isMoving: ${isMoving}`); // <-- REMOVE

         // Set key flash state only for the defined ABILITY_KEYS (u, i, o, p)
         if (ABILITY_KEYS.includes(keyLower)) {
             // console.log("[useKeyboardInput KeyDown] Setting key flash for:", keyLower); // <-- REMOVE
             setLastKeyPressed(keyLower);
             setTimeout(() => setLastKeyPressed(null), 150);
         }

         // Rest of the ability handling logic using abilityDef and abilityId
         // const abilityDef = currentUnitDef.combatAbilities.find((ab: AbilityDefinition) => ab.id === abilityId); // This line is removed/replaced above
         // if (abilityDef) { // Check is now done implicitly by canTriggerAbility
             const now = Date.now();
             const cooldownEndTime = currentUnit.abilityCooldowns[abilityId] ?? 0;
             if (now < cooldownEndTime) {
                 // console.log(`[useKeyboardInput KeyDown] Ability ${abilityId} on cooldown.`); // <-- REMOVE
                 return;
             }

             // console.log(`[useKeyboardInput KeyDown] Triggering ability action via handleAction: ${abilityId}`); // <-- REMOVE
             let payload: CombatActionPayload | null = null;
             let triggerClientMeleeVisual = false;
             let estimatedTargetPos: Vector2 | null = null;
             let facingDir = currentUnit.facingDirection ?? { x: 1, y: 0 };
             if (currentUnit.velocity.x !== 0 || currentUnit.velocity.y !== 0) {
                 const normVel = Math.sqrt(currentUnit.velocity.x**2 + currentUnit.velocity.y**2);
                 if (normVel > 0.01) {
                      facingDir = { x: currentUnit.velocity.x / normVel, y: currentUnit.velocity.y / normVel };
                 }
             } else if (currentUnit.lastMovementDirection) {
                 facingDir = currentUnit.lastMovementDirection;
             }
             
             if (abilityDef.attackType === 'melee' || 
                 abilityDef.attackType === 'direct_projectile' || 
                 abilityDef.attackType === 'boomerang_projectile' ||
                 abilityDef.type === 'movement' ||
                 abilityDef.type === 'support') { 
                 payload = { type: 'useAbility', abilityId: abilityId }; 
                 if (abilityDef.attackType === 'melee' && triggerClientMeleeEffectRef.current) {
                     triggerClientMeleeVisual = true;
                     const range = abilityDef.range ?? 35;
                     estimatedTargetPos = {
                         x: currentUnit.position.x + facingDir.x * range,
                         y: currentUnit.position.y + facingDir.y * range
                     };
                 }
             } else if (abilityDef.attackType === 'aoe_projectile') {
                  const range = abilityDef.range ?? 200; 
                 const targetPosition: Vector2 = {
                     x: currentUnit.position.x + facingDir.x * range,
                     y: currentUnit.position.y + facingDir.y * range
                 };
                 payload = { type: 'useAbility', abilityId: abilityId, targetPosition: targetPosition };
             } else {
                 // console.warn(`[useKeyboardInput KeyDown] Unhandled ability type/attackType for ${abilityId}: ${abilityDef.type}/${abilityDef.attackType}`); // <-- REMOVE
             }

             // --- P2 DEBUG --- 
             // console.log(`[P2 DEBUG ${currentUnit?.owner}] Before if(payload):`, { abilityId, payloadBuilt: payload, unitPos: currentUnit?.position, def: currentUnitDef }); // <-- REMOVE
             // --- END P2 DEBUG ---

             if (payload) {
                 // console.log(`[useKeyboardInput KeyDown] handleAction(${JSON.stringify(payload)})`); // <-- REMOVE
                 handleAction(payload);
                 if (triggerClientMeleeVisual && currentUnit.position && estimatedTargetPos && triggerClientMeleeEffectRef.current) {
                     // console.log(`[useKeyboardInput KeyDown] Triggering client melee visual effect.`); // <-- REMOVE
                     triggerClientMeleeEffectRef.current(currentUnit.position, estimatedTargetPos);
                 }
             } 
         // } // Removed closing brace for the old if(abilityDef)
         // else { // Removed else block
         //     console.warn(`[useKeyboardInput KeyDown] Ability definition not found for ID: ${abilityId}`);
         // } // Removed closing brace
      } else if (isAbilityKey && !abilityDef) {
          // console.log(`[useKeyboardInput KeyDown] Key ${keyLower} (Index ${abilityIndex}) pressed, but no ability found at that index for unit ${currentUnitDef.id}. Available: ${currentUnitDef.combatAbilities.map(a => a.id).join(', ')}`); // <-- REMOVE
      } else if (isAbilityKey && !canTriggerAbility) {
           // console.log(`[useKeyboardInput KeyDown] Ability (Index ${abilityIndex}) not triggered. isMoving: ${isMoving}, key: ${keyLower}`); // <-- REMOVE
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // console.log('[useKeyboardInput] Raw KeyUp Event:', event.key); // <-- REMOVE
       // --- Add Initial Log ---
      // console.log(`[useKeyboardInput] KeyUp: key='${event.key}', code='${event.code}'`); // <-- REMOVE

      const keyLower = event.key.toLowerCase();
      keyPressState.current[keyLower] = false; // Reset key press state

      if (['w', 'a', 's', 'd'].includes(keyLower)) {
        // console.log("[useKeyboardInput KeyUp] Movement key released:", keyLower); // <-- REMOVE
        event.preventDefault();
        activeMovementKeys.current.delete(keyLower);
        const netMovement = calculateNetMovement();
        if (netMovement) {
            // console.log(`[useKeyboardInput KeyUp] Sending update startMove:`, netMovement, `Keys:`, Array.from(activeMovementKeys.current)); // <-- REMOVE
            handleAction({ type: 'startMove', direction: netMovement });
        } else {
            // console.log(`[useKeyboardInput KeyUp] Sending stopMove. Keys empty:`, Array.from(activeMovementKeys.current)); // <-- REMOVE
            // Use action ref directly (Fixed typo)
            onCombatActionRef.current({ type: 'stopMove' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Cleanup function
    return () => {
      // console.log("[useKeyboardInput Effect] CLEANING UP listeners..."); // <-- REMOVE LOG
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      activeMovementKeys.current.clear();
      keyPressState.current = {};
    };
  // Dependencies: The user's unit/definition and the action callback functions
  }, [calculateNetMovement]); // <-- Restore dependency

  // Return state needed by the component (e.g., for visual feedback)
  return { lastKeyPressed };
} 