import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSocketConnection } from './hooks/useSocketConnection'; // <-- Import the new hook
import { useAppState } from './hooks/useAppState'; // <-- Import the new AppState hook
// import { Placeholder } from '@archess/shared' // Not used currently
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import { fetchAvailablePresets, type AvailablePresetInfo } from './services/api'
// Import types separately
import type { 
    GameState, 
    GameObjectId, 
    MoveActionPayload, 
    MatchId, 
    // PlayerId, // Remove unused type
    // GridPosition, // Remove unused type
    CombatStartedEventPayload, // <-- Add new event type
    CombatStateUpdatePayload, // <-- Ensure this is imported
    MeleeHitEventPayload, // <-- Import the new type
    ProjectileHitEventPayload, // <-- Add new payload type
    CombatActionPayload, // <-- Add new type for combat action payload
    ServerToClientEvents, ClientToServerEvents,
    BoardUnit
} from '@archess/shared'
// Import runtime constants separately
import { 
    COMBAT_STATE_UPDATE, // <-- Import the constant
    MELEE_HIT, // <-- Import the constant
    PROJECTILE_HIT, // <-- Import the constant
    COMBAT_END, // <-- Corrected name here
    COMBAT_ACTION, // Ensure this is imported from main entry point
    COMBAT_STARTED // <-- Add import for COMBAT_STARTED
} from '@archess/shared'
import './App.css'
// import GameBoard from './components/GameBoard' // Remove unused import
import CombatView from './components/CombatView'
import GameView from './components/GameView'
import LobbyView from './components/LobbyView'; // <-- Import LobbyView
import WaitingView from './components/WaitingView'; // <-- Import WaitingView

function App() {
  // Get socket connection state
  const { socket, isConnected } = useSocketConnection();
  
  // Get core application state from the new hook, passing the socket instance
  const {
    matchId,
    gameState,
    combatState,
    isInCombat,
    combatAttackerId,
    combatDefenderId,
    lastMeleeHit,
    lastProjectileHit,
    isLoadingPresets,
    presets,
    selectedPresetId,
    setSelectedPresetId,
  } = useAppState(socket);

  // Keep state not managed by useAppState here
  const [serverMessage, setServerMessage] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState<GameObjectId | null>(null); // Unit selection state remains here for now

  // --- Effect to monitor simple server messages (Keep this, as serverMessage state is still in App) ---
  useEffect(() => {
      if (!socket) return;
      const handleMessage = (data: string) => {
          console.log('Message from server:', data)
          setServerMessage(data)
      };
      socket.on('message', handleMessage);
      // Add listener for connect_error to update message state
      const handleConnectError = (err: Error) => {
          setServerMessage(`Connection failed: ${err.message}`);
      };
      socket.on('connect_error', handleConnectError);
      // Reset message on disconnect
      const handleDisconnect = () => {
           setServerMessage('');
      };
      socket.on('disconnect', handleDisconnect);

      return () => {
          socket.off('message', handleMessage);
          socket.off('connect_error', handleConnectError);
          socket.off('disconnect', handleDisconnect);
      };
  }, [socket]); // Only depends on socket

  // --- Effect to monitor gameState changes (Keep this for logging or derived state if needed) ---
  useEffect(() => {
    if (gameState) {
        console.log('[Client App useEffect] gameState has been updated via useAppState:', JSON.stringify(gameState, null, 2));
    } else {
        console.log('[Client App useEffect] gameState from useAppState is currently null.');
    }
  }, [gameState]); // Run whenever gameState from useAppState changes

  // --- Event Handlers (Keep these in App for now) --- 
  // These handlers interact with the socket instance from useSocketConnection
  // and may update local App state like selectedUnitId or selectedPresetId.
  
  function handlePresetChange(event: React.ChangeEvent<HTMLSelectElement>) {
      setSelectedPresetId(event.target.value);
  }

  function handleCreateMatch() {
      // Use socket from hook
      if (!socket?.connected) {
          alert('Not connected to server.');
          return;
      }
      if (!selectedPresetId) {
          alert('Please select a game preset.');
          return;
      }
      console.log(`Requesting createMatch with preset: ${selectedPresetId}`);
      const payload = {
          playerName: 'Player_' + socket.id?.substring(0, 5), // Use socket from hook
          presetId: selectedPresetId,
      };
      socket.emit('createMatch', payload); // Use socket from hook
  }

  function handleJoinMatch() {
    // Use socket from hook
    if (!socket?.connected) {
      alert('Not connected to server.');
      return;
    }
    const matchToJoin = prompt("Enter Match ID to join:");
    if (!matchToJoin) return;
    
    console.log(`Requesting joinMatch for: ${matchToJoin}`);
    socket.emit('joinMatch', { matchId: matchToJoin }); // Use socket from hook
  }

  function handleUnitClick(unit: BoardUnit) {
    if (!gameState || gameState.currentTurn !== socket?.id) return;
    if (unit.owner !== socket?.id) return;
    console.log(`Selected unit: ${unit.id}`);
    setSelectedUnitId(unit.id);
  }

  function handleTileClick(x: number, y: number) {
      if (!selectedUnitId || !gameState || !matchId || gameState.currentTurn !== socket?.id) return;

      console.log(`Attempting move for unit ${selectedUnitId} to (${x}, ${y}) in match ${matchId}`);

      const payload: MoveActionPayload = {
          unitId: selectedUnitId,
          targetPosition: { x, y },
      };
      
      console.log(`[Client] Emitting playerAction:`, { matchId, actionType: 'moveUnit', payload });

      // Use socket from hook
      socket.emit('playerAction', { 
          matchId, 
          actionType: 'moveUnit', 
          payload 
      });

      setSelectedUnitId(null); 
  }

  function handleEndTurn() {
      if (!gameState || !matchId || gameState.currentTurn !== socket?.id) return;
      if (!socket?.connected) { alert('Not connected.'); return; }

      console.log(`Player ${socket.id} ending turn in match ${matchId}`);

      // Use socket from hook
      socket.emit('playerAction', { 
          matchId, 
          actionType: 'endTurn', 
          payload: {} 
      });
  }

  // Centralized handler to send actions to the server
  const handleCombatAction = useCallback(
    (actionPayload: CombatActionPayload) => {
      if (!gameState?.matchId) {
        console.error('[App handleCombatAction] Cannot send action, no matchId');
        return;
      }
      if (!socket) {
          console.error('[App handleCombatAction] Cannot send action, socket is null');
          return;
      }
      const payload = { matchId: gameState.matchId, actionPayload };
      socket.emit(COMBAT_ACTION, payload);
    },
    [gameState?.matchId]
  );

  // --- Derived State / Memoized Values (Moved outside conditional rendering) ---
  // Memoize values derived from combatState or gameState unconditionally
  const units = useMemo(() => combatState?.units ?? [], [combatState?.units]);
  const projectiles = useMemo(() => combatState?.projectiles ?? [], [combatState?.projectiles]);
  const activeAoEZones = useMemo(() => combatState?.activeAoEZones ?? [], [combatState?.activeAoEZones]);
  const playerIds = useMemo(() => gameState?.players ?? [], [gameState?.players]);
  const unitDefinitions = useMemo(() => gameState?.unitDefinitions, [gameState?.unitDefinitions]);
  const isMyTurn = useMemo(() => (gameState && socket?.id) ? gameState.currentTurn === socket.id : false, [gameState, socket?.id]);

  // --- Conditional Rendering Logic --- 
  function renderContent() {
      // Use state from useAppState
      if (isInCombat && combatState && matchId && combatAttackerId && combatDefenderId) { 
           try {
               // Use socket ID from useSocketConnection
               if (!socket?.id) {
                   console.error("[App] Cannot render CombatView: socket ID is missing.");
                   return <div>Error: Missing connection ID.</div>;
               }
               // if (!gameState || !gameState.players || gameState.players.length < 2) { // Keep commented out
                   // console.warn("[App] gameState missing or invalid while rendering CombatView.");
               // }

              return (
                  <CombatView 
                      matchId={matchId} 
                      attackerId={combatAttackerId}
                      defenderId={combatDefenderId}
                      // Pass memoized, individual props instead of the whole combatState object
                      units={units}
                      projectiles={projectiles}
                      activeAoEZones={activeAoEZones}
                      unitDefinitions={unitDefinitions} 
                      onCombatAction={handleCombatAction} 
                      playerSocketId={socket.id} 
                      lastMeleeHit={lastMeleeHit} 
                      lastProjectileHit={lastProjectileHit} 
                      playerIds={playerIds} 
                  />
              );
           } catch (error) {
               console.error("[DEBUG renderContent] Error rendering CombatView:", error);
               return <div>Error loading combat view.</div>;
           }
      // Use state from useAppState
      } else if (gameState && matchId) {
          // Use the memoized isMyTurn value calculated outside
          return (
              <GameView
                  gameState={gameState}
                  selectedUnitId={selectedUnitId} // Pass local state
                  isMyTurn={isMyTurn} 
                  onUnitClick={handleUnitClick} // Pass local handler
                  onTileClick={handleTileClick} // Pass local handler
                  onEndTurnClick={handleEndTurn} // Pass local handler
              />
          );
      // Use state from useAppState
      } else if (matchId) {
          // Render WaitingView component
          return <WaitingView matchId={matchId} />;
      } else {
          // Render LobbyView component
          return (
             <LobbyView 
                presets={presets}
                selectedPresetId={selectedPresetId}
                isLoadingPresets={isLoadingPresets}
                isConnected={isConnected}
                onPresetChange={handlePresetChange}
                onCreateMatch={handleCreateMatch}
                onJoinMatch={handleJoinMatch}
             />
          );
      }
  }

  return (
    <div className="App">
        <header className="App-header">
            {/* <img src={viteLogo} className="logo" alt="Vite logo" /> */}
            {/* <img src={reactLogo} className="logo react" alt="React logo" /> */}
            <h1>Archess Game</h1>
            {/* Use isConnected and socket ID from useSocketConnection */}
            <p>Status: {isConnected ? `Connected (${socket?.id})` : 'Disconnected'}</p>
            {/* Use serverMessage state still local to App */}
            {serverMessage && <p>Server: {serverMessage}</p>}
        </header>
        <main>
            {renderContent()}
        </main>
    </div>
  )
}

export default App 