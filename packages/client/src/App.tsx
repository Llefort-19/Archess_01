import React, { useState, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
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

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null 

function App() {
  // const [count, setCount] = useState(0)
  const [isConnected, setIsConnected] = useState(socket?.connected || false)
  const [serverMessage, setServerMessage] = useState('')
  // const [sharedData, setSharedData] = useState<Placeholder | null>(null) // Not used
  const [presets, setPresets] = useState<AvailablePresetInfo[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [matchId, setMatchId] = useState<string | null>(null); // Store match ID if created/joined
  const [gameState, setGameState] = useState<GameState | null>(null); // <-- Holds strategy state
  const [combatState, setCombatState] = useState<CombatStateUpdatePayload | null>(null); // <-- Holds combat state
  const [selectedUnitId, setSelectedUnitId] = useState<GameObjectId | null>(null); // <-- Add state for selection
  const [isInCombat, setIsInCombat] = useState<boolean>(false); // <-- Simpler state to track if combat view should be shown
  const [lastMeleeHit, setLastMeleeHit] = useState<MeleeHitEventPayload | null>(null); // <-- New state for hit info
  const [lastProjectileHit, setLastProjectileHit] = useState<ProjectileHitEventPayload | null>(null); // <-- New state for projectile hit
  // State to store combat roles
  const [combatAttackerId, setCombatAttackerId] = useState<GameObjectId | null>(null);
  const [combatDefenderId, setCombatDefenderId] = useState<GameObjectId | null>(null);

  // Fetch presets on component mount
  useEffect(() => {
    async function loadPresets() {
      setIsLoadingPresets(true);
      const availablePresets = await fetchAvailablePresets();
      setPresets(availablePresets);
      // Select the first preset by default if available
      if (availablePresets.length > 0 && availablePresets[0]) {
           setSelectedPresetId(availablePresets[0].id);
      }
      setIsLoadingPresets(false);
    }
    loadPresets().catch(console.error); // Handle potential errors during load
  }, []);

  // Effect for Socket.IO connection management
  useEffect(() => {
    // Connect only once
    if (!socket) {
      console.log(`Connecting socket to ${SERVER_URL}...`)
      socket = io(SERVER_URL)

      socket.on('connect', () => {
        console.log('Socket connected!', socket?.id)
        setIsConnected(true)
      })

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected.', reason)
        setIsConnected(false)
        setServerMessage('')
        setMatchId(null); // Reset match state on disconnect
        setGameState(null); // <-- Reset game state on disconnect
      })

      socket.on('connect_error', (err) => {
          console.error("Socket connection error:", err);
          setIsConnected(false);
          setServerMessage(`Connection failed: ${err.message}`);
      });

      socket.on('message', (data: string) => {
        console.log('Message from server:', data)
        setServerMessage(data)
      })
      
      socket.on('matchCreated', ({ matchId: newMatchId, presetId }) => {
          console.log(`Server confirmed match created: ${newMatchId} with preset ${presetId}`);
          setMatchId(newMatchId);
          setGameState(null); // Ensure no stale game state when waiting
      });
      
      socket.on('gameStateUpdate', (newState) => { 
            if (!newState) {
                console.warn('[Client gameStateUpdate] Received empty/null state.');
                return;
            }
            if (typeof newState === 'object' && 'boardConfig' in newState && 'players' in newState) { 
                console.log('[Client gameStateUpdate] Processing as GameState:', newState);
                setGameState(newState);
                setMatchId(newState.matchId);
                if (combatState !== null) {
                    console.log('[Client gameStateUpdate] Received GameState, clearing combatState.');
                    setCombatState(null);
                }
            } 
            else {
                 console.error('[Client gameStateUpdate] Received unexpected data format:', newState);
            }
      });
      
      socket.on(COMBAT_STATE_UPDATE, (newState) => { 
            console.log("[App] Received COMBAT_STATE_UPDATE:", JSON.stringify(newState, null, 2));
            if (!newState) {
                console.warn('[Client combatStateUpdate] Received empty/null state.');
                return;
            }
            if (typeof newState === 'object' && newState !== null && 'matchId' in newState && 'units' in newState) {
                const validState = newState as CombatStateUpdatePayload;
                setCombatState(validState);
            } else {
                console.warn('[Client combatStateUpdate] Received unexpected state structure:', newState);
            }
      });

      socket.on(MELEE_HIT, (payload: MeleeHitEventPayload) => {
          console.log(`[Client ${MELEE_HIT}] Received:`, payload);
          setLastMeleeHit(payload);
      });

      socket.on(PROJECTILE_HIT, (payload: ProjectileHitEventPayload) => {
          console.log(`[Client ${PROJECTILE_HIT}] Received:`, payload);
          setLastProjectileHit(payload);
          setTimeout(() => setLastProjectileHit(null), 300);
      });

      socket.on(COMBAT_END, (payload: { matchId: MatchId, winnerId: GameObjectId, loserId: GameObjectId }) => {
          console.log(`[Client ${COMBAT_END}] Received for match ${payload.matchId}. Winner: ${payload.winnerId}, Loser: ${payload.loserId}`);
          setIsInCombat(false);
      });

      socket.on('error', (error) => {
          console.error('Server error message:', error);
          alert(`Server Error: ${error.message || 'Unknown error'}`);
      });

      socket.on(COMBAT_STARTED, (payload: CombatStartedEventPayload) => {
          console.log(`[Client] ${COMBAT_STARTED} received:`, payload);
          if (payload.initialCombatState && payload.attackerUnitId && payload.defenderUnitId) {
              setCombatState(payload.initialCombatState);
              setCombatAttackerId(payload.attackerUnitId);
              setCombatDefenderId(payload.defenderUnitId);
              setMatchId(payload.matchId);
              console.log('[Client combatStarted] setIsInCombat(true) called.');
              setIsInCombat(true);
          } else {
              console.error('[Client] Invalid combatStarted payload received:', payload);
          }
      });
    }

    // Cleanup on component unmount
    return () => {
      if (socket?.connected) {
        console.log('Disconnecting socket on unmount...')
        socket.disconnect()
        socket = null // Allow reconnect on next mount if needed
        setIsConnected(false)
      }
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Ensure dependency array is empty for mount-only execution

  // Add a separate useEffect to monitor gameState changes
  useEffect(() => {
    if (gameState) {
        console.log('[Client useEffect] gameState has been updated:', JSON.stringify(gameState, null, 2));
    } else {
        console.log('[Client useEffect] gameState is currently null.');
    }
  }, [gameState]); // Run whenever gameState changes

  // --- Event Handlers --- 
  
  function handlePresetChange(event: React.ChangeEvent<HTMLSelectElement>) {
      setSelectedPresetId(event.target.value);
  }

  function handleCreateMatch() {
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
          playerName: 'Player_' + socket.id?.substring(0, 5), // Example player name
          presetId: selectedPresetId,
      };
      socket.emit('createMatch', payload);
      // UI should update based on 'matchCreated' event from server
  }

  // Simplify join logic - requires manual input for now
  function handleJoinMatch() {
    if (!socket?.connected) {
      alert('Not connected to server.');
      return;
    }
    const matchToJoin = prompt("Enter Match ID to join:"); // Very basic join UI
    if (!matchToJoin) return;
    
    console.log(`Requesting joinMatch for: ${matchToJoin}`);
    socket.emit('joinMatch', { matchId: matchToJoin });
    // UI should update based on 'gameStateUpdate' event from server if successful
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
      
      // Log just before emitting
      console.log(`[Client] Emitting playerAction:`, { matchId, actionType: 'moveUnit', payload });

      socket.emit('playerAction', { 
          matchId, 
          actionType: 'moveUnit', 
          payload 
      });

      // Deselect unit visually immediately for responsiveness
      // The actual state update will come from the server via gameStateUpdate
      setSelectedUnitId(null); 
  }

  function handleEndTurn() {
      if (!gameState || !matchId || gameState.currentTurn !== socket?.id) return; // Must be your turn
      if (!socket?.connected) { alert('Not connected.'); return; }

      console.log(`Player ${socket.id} ending turn in match ${matchId}`);

      socket.emit('playerAction', { 
          matchId, 
          actionType: 'endTurn', 
          payload: {} // No specific payload needed for end turn
      });
      
      // Optional: visually disable button immediately? 
      // Server's gameStateUpdate will confirm the turn change.
  }

  const handleCombatStateUpdate = useCallback((payload: CombatStateUpdatePayload) => {
    if (payload.matchId === matchId) {
      setCombatState(payload); // Update local combat state
    }
  }, [matchId]);

  const handleCombatAction = useCallback((payload: CombatActionPayload) => {
    if (!socket || !matchId) return;
    socket.emit('combatAction', { matchId, actionPayload: payload });
  }, [socket, matchId]);

  // --- Conditional Rendering Logic --- 
  function renderContent() {
      // --- Add Debug Logging --- 
      // console.log(`[DEBUG renderContent] isInCombat: ${isInCombat}, gameState exists: ${!!gameState}, combatState exists: ${!!combatState}, matchId: ${matchId}`);
      // --- End Debug Logging ---

      // Render CombatView if isInCombat flag is true and combatState is available
      if (isInCombat && combatState && matchId && combatAttackerId && combatDefenderId) { // Check for stored IDs
           // console.log("[DEBUG renderContent] Entering CombatView rendering block."); 
           try {
               // Log the units received in combatState
               // console.log("[DEBUG renderContent] combatState.units:", JSON.stringify(combatState.units)); 

               // Remove outdated calculation based on players array
               /*
               const players = Array.from(new Set(combatState.units.map(u => u.owner)));
               const attackerId = combatState.units.find(u => u.owner === players[0])?.id;
               const defenderId = combatState.units.find(u => u.owner === players[1])?.id;
               console.log(`[DEBUG renderContent] Extracted players: ${players.join(', ')}, attackerId: ${attackerId}, defenderId: ${defenderId}`); 

               if (!attackerId || !defenderId) {
                   console.error("[App] Could not determine attacker/defender IDs from combatState units for CombatView.");
                   return <div>Error loading combat view: Invalid unit data.</div>; // More specific error
               }
               */
               // --- Add check for socket ID before rendering CombatView ---
               if (!socket?.id) {
                   console.error("[App] Cannot render CombatView: socket ID is missing.");
                   return <div>Error: Missing connection ID.</div>;
               }
               // --- Add check for gameState and players before rendering CombatView ---
               if (!gameState || !gameState.players || gameState.players.length < 2) {
                   console.error("[App] Cannot render CombatView: gameState or players list is missing/invalid.");
                   return <div>Error loading combat view: Invalid game state data.</div>;
               }
               // --- End check ---

              // console.log("[DEBUG renderContent] Rendering CombatView component."); 
              return (
                  <CombatView 
                      matchId={matchId} 
                      attackerId={combatAttackerId} // Use stored attacker ID
                      defenderId={combatDefenderId} // Use stored defender ID
                      // Pass combatState (contains units, projectiles)
                      combatState={combatState} 
                      // Pass unit definitions from gameState (needed for rendering names, max HP etc.)
                      unitDefinitions={gameState?.unitDefinitions} 
                      onCombatAction={handleCombatAction} // Pass handler to emit actions
                      playerSocketId={socket.id} // <-- Pass the socket ID
                      lastMeleeHit={lastMeleeHit} // <-- Pass down melee hit info
                      lastProjectileHit={lastProjectileHit} // <-- Pass down projectile hit info
                      playerIds={gameState.players} // <-- Pass players array
                  />
              );
           } catch (error) {
               console.error("[DEBUG renderContent] Error during ID extraction or rendering CombatView:", error);
               return <div>Error loading combat view: Exception occurred.</div>;
           }
      } else if (gameState && matchId) {
          // Calculate isMyTurn here
          const isMyTurn = gameState.currentTurn === socket?.id; 
          
          // Render GameView
          return (
              <GameView
                  gameState={gameState}
                  selectedUnitId={selectedUnitId}
                  isMyTurn={isMyTurn} // <-- Pass prop
                  onUnitClick={handleUnitClick} 
                  onTileClick={handleTileClick}
                  onEndTurnClick={handleEndTurn} 
              />
          );
      } else if (matchId) {
          // Match created/joined, but no game state yet (waiting for opponent)
          return (
              <div>
                  <h3>Match Created: {matchId}</h3>
                  <p>Waiting for opponent to join...</p>
              </div>
          );
      } else {
          // Initial lobby view
          return (
             <div>
                 <h3>Create or Join a Match</h3>
                 {isLoadingPresets ? (
                     <p>Loading presets...</p>
                 ) : presets.length > 0 ? (
                     <div>
                         <label htmlFor="preset-select">Select Preset: </label>
                         <select 
                             id="preset-select" 
                             value={selectedPresetId ?? ''} 
                             onChange={handlePresetChange}
                             disabled={!isConnected}
                         >
                             {presets.map((p) => (
                                 <option key={p.id} value={p.id}>
                                     {p.name} ({p.description})
                                 </option>
                             ))}
                         </select>
                         <button type="button" onClick={handleCreateMatch} disabled={!isConnected || !selectedPresetId}>
                             Create Match
                         </button>
                     </div>
                 ) : (
                     <p>No game presets available from server.</p>
                 )}

                <button type="button" onClick={handleJoinMatch} disabled={!isConnected} style={{marginTop: '10px'}}>
                    Join Match by ID
                </button>
             </div>
          );
      }
  }

  return (
    <div className="App">
        <header className="App-header">
            {/* <img src={viteLogo} className="logo" alt="Vite logo" /> */}
            {/* <img src={reactLogo} className="logo react" alt="React logo" /> */}
            <h1>Archess Game</h1>
            <p>Status: {isConnected ? `Connected (${socket?.id})` : 'Disconnected'}</p>
            {serverMessage && <p>Server: {serverMessage}</p>}
        </header>
        <main>
            {renderContent()}
        </main>
    </div>
  )
}

export default App 