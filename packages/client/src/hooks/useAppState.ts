import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type {
    GameState,
    GameObjectId,
    MatchId,
    CombatStartedEventPayload,
    CombatStateUpdatePayload,
    MeleeHitEventPayload,
    ProjectileHitEventPayload,
    ServerToClientEvents,
    ClientToServerEvents
} from '@archess/shared';
import type { AvailablePresetInfo } from '../services/api';
import {
    COMBAT_STATE_UPDATE,
    MELEE_HIT,
    PROJECTILE_HIT,
    COMBAT_END,
    COMBAT_STARTED
} from '@archess/shared';
import { fetchAvailablePresets } from '../services/api';

// Define the shape of the state and setters returned by the hook
interface AppState {
  matchId: string | null;
  gameState: GameState | null;
  combatState: CombatStateUpdatePayload | null;
  isInCombat: boolean;
  combatAttackerId: GameObjectId | null;
  combatDefenderId: GameObjectId | null;
  lastMeleeHit: MeleeHitEventPayload | null;
  lastProjectileHit: ProjectileHitEventPayload | null;
  presets: AvailablePresetInfo[];
  selectedPresetId: string | null;
  isLoadingPresets: boolean;
  setSelectedPresetId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useAppState(socket: Socket<ServerToClientEvents, ClientToServerEvents> | null): AppState {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [combatState, setCombatState] = useState<CombatStateUpdatePayload | null>(null);
  const [isInCombat, setIsInCombat] = useState<boolean>(false);
  const [combatAttackerId, setCombatAttackerId] = useState<GameObjectId | null>(null);
  const [combatDefenderId, setCombatDefenderId] = useState<GameObjectId | null>(null);
  const [lastMeleeHit, setLastMeleeHit] = useState<MeleeHitEventPayload | null>(null);
  const [lastProjectileHit, setLastProjectileHit] = useState<ProjectileHitEventPayload | null>(null);
  const [presets, setPresets] = useState<AvailablePresetInfo[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState<boolean>(true);

  useEffect(() => {
    if (socket) {
      const loadPresets = async () => {
        setIsLoadingPresets(true);
        try {
          const fetchedPresets = await fetchAvailablePresets();
          setPresets(fetchedPresets);
          if (fetchedPresets.length > 0 && fetchedPresets[0] && !selectedPresetId) {
            setSelectedPresetId(fetchedPresets[0].id);
          }
          console.log("[useAppState] Presets fetched successfully.", fetchedPresets);
        } catch (error) {
          console.error('[useAppState] Failed to fetch presets:', error);
        } finally {
          setIsLoadingPresets(false);
        }
      };
      loadPresets();
    }
  }, [socket]);

  useEffect(() => {
    // Only attach listeners if the socket instance exists
    if (!socket) return;

    console.log("[useAppState] Attaching listeners...");

    // Listener for match creation confirmation
    const handleMatchCreated = ({ matchId: newMatchId, presetId }: { matchId: MatchId, presetId: string }) => {
        console.log(`[useAppState] Server confirmed match created: ${newMatchId} with preset ${presetId}`);
        setMatchId(newMatchId);
        setGameState(null); // Ensure no stale game state when waiting
        setCombatState(null); // Clear combat state
        setIsInCombat(false); // Ensure not in combat
    };
    socket.on('matchCreated', handleMatchCreated);

    // Listener for game state updates (Strategy mode)
    const handleGameStateUpdate = (newState: GameState | null) => {
        if (!newState) {
            console.warn('[useAppState gameStateUpdate] Received empty/null state.');
            return;
        }
        // Basic type check (can be more robust)
        if (typeof newState === 'object' && newState !== null && 'boardConfig' in newState && 'players' in newState) {
            console.log('[useAppState gameStateUpdate] Processing as GameState:', newState);
            setGameState(newState);
            setMatchId(newState.matchId); // Update matchId from gameState too
            if (combatState !== null) {
                console.log('[useAppState gameStateUpdate] Received GameState, clearing combatState.');
                setCombatState(null); // Clear combat state if receiving game state
            }
            if (isInCombat) { // If we received game state, we are no longer in combat
                console.log('[useAppState gameStateUpdate] Received GameState, setting isInCombat=false.');
                setIsInCombat(false);
                setCombatAttackerId(null);
                setCombatDefenderId(null);
            }
        }
        else {
             console.error('[useAppState gameStateUpdate] Received unexpected data format:', newState);
        }
    };
    socket.on('gameStateUpdate', handleGameStateUpdate);

    // Listener for combat state updates
    const handleCombatStateUpdate = (newState: CombatStateUpdatePayload | null) => {
        if (!newState) {
            console.warn('[useAppState combatStateUpdate] Received empty/null state.');
            return;
        }
        if (typeof newState === 'object' && newState !== null && 'matchId' in newState && 'units' in newState) {
            const validState = newState as CombatStateUpdatePayload;
            setCombatState(validState);
        } else {
            console.warn('[useAppState combatStateUpdate] Received unexpected state structure:', newState);
        }
    };
    socket.on(COMBAT_STATE_UPDATE, handleCombatStateUpdate);

    // Listener for melee hit events
    const handleMeleeHit = (payload: MeleeHitEventPayload) => {
        console.log(`[useAppState ${MELEE_HIT}] Received:`, payload);
        setLastMeleeHit(payload);
    };
    socket.on(MELEE_HIT, handleMeleeHit);

    // Listener for projectile hit events
    const handleProjectileHit = (payload: ProjectileHitEventPayload) => {
        console.log(`[useAppState ${PROJECTILE_HIT}] Received:`, payload);
        setLastProjectileHit(payload);
        // Keep the timeout logic for clearing the visual effect state here
        setTimeout(() => setLastProjectileHit(null), 300);
    };
    socket.on(PROJECTILE_HIT, handleProjectileHit);

    // Listener for combat ending
    const handleCombatEnd = (payload: { matchId: MatchId, winnerId: GameObjectId, loserId: GameObjectId }) => {
        console.log(`[useAppState ${COMBAT_END}] Received for match ${payload.matchId}. Winner: ${payload.winnerId}, Loser: ${payload.loserId}`);
        // Combat ends, switch flag. GameStateUpdate should provide the new board state.
        setIsInCombat(false);
        // Clear combat-specific state
        setCombatState(null);
        setCombatAttackerId(null);
        setCombatDefenderId(null);
        // Clear hit states as well
        setLastMeleeHit(null);
        setLastProjectileHit(null);
    };
    socket.on(COMBAT_END, handleCombatEnd);

    // Listener for combat starting
    const handleCombatStarted = (payload: CombatStartedEventPayload) => {
        console.log(`[useAppState] ${COMBAT_STARTED} received:`, payload);
        if (payload.initialCombatState && payload.attackerUnitId && payload.defenderUnitId) {
            setCombatState(payload.initialCombatState);
            setCombatAttackerId(payload.attackerUnitId);
            setCombatDefenderId(payload.defenderUnitId);
            setMatchId(payload.matchId); // Ensure matchId is set from combat start
            console.log('[useAppState combatStarted] setIsInCombat(true) called.');
            setIsInCombat(true); // Set flag to render combat view
        } else {
            console.error('[useAppState] Invalid combatStarted payload received:', payload);
        }
    };
    socket.on(COMBAT_STARTED, handleCombatStarted);
    
    // Listener for general server errors (moved from connection hook)
    const handleError = (error: any) => {
        console.error('[useAppState] Server error message:', error);
        // Consider how to surface this error to the UI, maybe return an error state from the hook?
        alert(`Server Error: ${error.message || 'Unknown error'}`);
    };
    socket.on('error', handleError);

    // Cleanup function
    return () => {
      console.log("[useAppState] Cleaning up listeners...");
      socket.off('matchCreated', handleMatchCreated);
      socket.off('gameStateUpdate', handleGameStateUpdate);
      socket.off(COMBAT_STATE_UPDATE, handleCombatStateUpdate);
      socket.off(MELEE_HIT, handleMeleeHit);
      socket.off(PROJECTILE_HIT, handleProjectileHit);
      socket.off(COMBAT_END, handleCombatEnd);
      socket.off(COMBAT_STARTED, handleCombatStarted);
      socket.off('error', handleError);
    };
  // Only depends on the socket instance. 
  // State setters are stable and don't need to be dependencies.
  // Reading state within listeners (like combatState, isInCombat) uses the latest value due to closure.
  }, [socket]); 

  // Return all state values needed by the App component
  return {
    matchId,
    gameState,
    combatState,
    isInCombat,
    combatAttackerId,
    combatDefenderId,
    lastMeleeHit,
    lastProjectileHit,
    presets,
    selectedPresetId,
    isLoadingPresets,
    setSelectedPresetId,
  };
} 