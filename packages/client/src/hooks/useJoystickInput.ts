import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { throttle } from 'lodash';
import type { CombatActionPayload, Vector2 } from '@archess/shared';

// Constants for the Joystick dimensions
const JOYSTICK_SIZE = 100; 
const HANDLE_SIZE = 40; 
const JOYSTICK_CENTER = JOYSTICK_SIZE / 2;
const HANDLE_RADIUS = HANDLE_SIZE / 2;
const MAX_HANDLE_OFFSET = JOYSTICK_CENTER - HANDLE_RADIUS;
const MOVE_ACTION_THROTTLE_MS = 100; // Throttle interval

interface JoystickInputOptions {
  onCombatAction: (payload: CombatActionPayload) => void;
  // Add an optional enabled flag if needed
  // isEnabled?: boolean;
}

export function useJoystickInput({
  onCombatAction,
}: JoystickInputOptions) {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickHandleRef = useRef<HTMLDivElement>(null);
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const [handlePosition, setHandlePosition] = useState({ x: JOYSTICK_CENTER, y: JOYSTICK_CENTER });

  // --- Refs for latest state/props needed inside listeners --- 
  const onCombatActionRef = useRef(onCombatAction);

  // Ref to track dragging state reliably for global listeners
  const isDraggingRef = useRef(false);

  // Keep the ref synchronized with the state
  useEffect(() => {
    isDraggingRef.current = isDraggingJoystick;
  }, [isDraggingJoystick]);

  // Throttle the startMove action
  const throttledStartMove = useMemo(() => 
    throttle((direction: Vector2) => {
        console.log('[useJoystickInput throttledStartMove] Executing with direction:', direction);
        // Accessing the ref's current value ensures we call the *latest* onCombatAction
        onCombatActionRef.current({ type: 'startMove', direction });
    }, MOVE_ACTION_THROTTLE_MS, { leading: true, trailing: false }), 
    // Dependency is only the ref container, which is stable
    [onCombatActionRef] 
  );

  // Update the ref whenever the prop changes
  useEffect(() => {
    onCombatActionRef.current = onCombatAction;
  }, [onCombatAction]);

  // Define handleAction for logging consistency
  const handleAction = useCallback((action: CombatActionPayload) => {
    // console.log("[useJoystickInput] handleAction called with:", action); // <-- REMOVE LOG
    onCombatActionRef.current(action);
  }, []); // Keep dependencies empty for stability with refs

  // Handler for touch start on the joystick base
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    console.log("[useJoystickInput] handleTouchStart triggered");
    event.preventDefault(); // Prevent scrolling/page zoom
    if (event.touches.length > 0) {
        setIsDraggingJoystick(true);
        // No need to call updateJoystick here, touchMove handles it
        console.log(`[useJoystickInput handleTouchStart] Setting dragging to true.`);
    }
  }, []);

  // Common logic for updating joystick based on coordinates (relative to base center)
  const updateJoystickPosition = useCallback((clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    console.log(`[useJoystickInput updateJoystickPosition] Updating for ${clientX},${clientY}`);

    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + JOYSTICK_CENTER;
    const centerY = rect.top + JOYSTICK_CENTER;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX*deltaX + deltaY*deltaY);

    let handleOffsetX = JOYSTICK_CENTER + deltaX; // Visual offset from top-left
    let handleOffsetY = JOYSTICK_CENTER + deltaY;

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
        // Send throttled move action
        throttledStartMove(moveVector);
    } else {
        // If exactly at center, visual position is center
        console.log("[useJoystickInput updateJoystickPosition] At center, stopping move.");
        handleOffsetX = JOYSTICK_CENTER;
        handleOffsetY = JOYSTICK_CENTER;
        // Stop moving (cancel any pending throttled calls)
        throttledStartMove.cancel();
        handleAction({ type: 'stopMove' });
    }

    // Update the visual handle position state
    setHandlePosition({ x: handleOffsetX, y: handleOffsetY });
  }, [throttledStartMove, handleAction]);

  // Handler for touch move on the joystick base
  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    // console.log("[useJoystickInput] handleTouchMove triggered"); // Can be noisy
    event.preventDefault();
    if (isDraggingRef.current && event.touches.length > 0 && event.touches[0]) {
        updateJoystickPosition(event.touches[0].clientX, event.touches[0].clientY);
    }
  }, [updateJoystickPosition]);

  // Handler for touch end/cancel anywhere
  const handleTouchEnd = useCallback(() => {
    console.log("[useJoystickInput] handleTouchEnd triggered");
    if (isDraggingRef.current) { // Only act if we were dragging
        throttledStartMove.cancel();
        console.log("[useJoystickInput handleTouchEnd] Sending stopMove.");
        handleAction({ type: 'stopMove' });
        setIsDraggingJoystick(false);
        setHandlePosition({ x: JOYSTICK_CENTER, y: JOYSTICK_CENTER }); // Reset visual
    }
  }, [handleAction, throttledStartMove]);

  // --- Mouse Handlers --- 

  // Handler for mouse down on the joystick handle itself
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
     // Only start drag if clicking the handle directly
     if (event.target === joystickHandleRef.current) {
       console.log("[useJoystickInput] handleMouseDown triggered on handle");
       event.preventDefault(); 
       setIsDraggingJoystick(true);
       console.log(`[useJoystickInput handleMouseDown] Setting dragging to true.`);
     } 
   }, []); 

   // Global mouse move handler (attached only when dragging)
   const handleGlobalMouseMove = useCallback((event: MouseEvent) => {
     if (!isDraggingRef.current) return; // Extra check
     // console.log("[useJoystickInput] handleGlobalMouseMove triggered"); // Noisy
     updateJoystickPosition(event.clientX, event.clientY);
   }, [updateJoystickPosition]);

   // Global mouse up handler (attached only when dragging)
   const handleGlobalMouseUp = useCallback(() => {
    if (isDraggingRef.current) { // Only act if we were dragging
        console.log("[useJoystickInput] handleGlobalMouseUp triggered while dragging");
        throttledStartMove.cancel();
        console.log("[useJoystickInput handleGlobalMouseUp] Sending stopMove.");
        handleAction({ type: 'stopMove' });
        setIsDraggingJoystick(false);
        setHandlePosition({ x: JOYSTICK_CENTER, y: JOYSTICK_CENTER }); // Reset visual
    }
  }, [handleAction, throttledStartMove]);

  // Effect to add/remove global mouse listeners for dragging
  useEffect(() => {
    // Define handlers *inside* the effect so they close over the refs
    // and don't need to be dependencies themselves.
    const moveHandler = (e: MouseEvent) => {
        // Access update function directly through ref if needed, or ensure it's stable.
        // For now, assume updateJoystickPosition is stable or handled by its own useCallback.
        handleGlobalMouseMove(e);
    };
    const upHandler = () => {
        handleGlobalMouseUp();
    };

    if (isDraggingJoystick) {
      console.log("[useJoystickInput Effect] Adding global mouse listeners");
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    } else {
      console.log("[useJoystickInput Effect] Removing global mouse listeners");
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    }

    // Cleanup function
    return () => {
      console.log("[useJoystickInput Effect] Cleanup: Removing global mouse listeners");
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };
    // Dependencies: Only isDraggingJoystick. Inner handlers use stable refs/callbacks.
  }, [isDraggingJoystick, handleGlobalMouseMove, handleGlobalMouseUp]); // <-- Keep isDraggingJoystick, remove handlers if stable

  // Return refs and state needed by the component
  return {
    joystickBaseRef,    // Ref for the base div
    joystickHandleRef,  // Ref for the handle div
    handlePosition,     // State for handle CSS position
    // Event handlers to attach to the joystick base/handle elements
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,    
  };
} 