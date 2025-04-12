import type { Socket } from 'socket.io'
import type { Server as SocketIOServer } from 'socket.io'; // Import the type
import type { PresetId } from '@archess/shared'
import { presetService } from './PresetService'
import { GameManager } from './GameManager' // Assuming GameManager manages active games
// import { io } from '../index' // REMOVE THIS LINE

let matchCounter = 1; // Simple counter for dev IDs

// Simple in-memory storage for matches waiting for players
// In a real app, this would likely be more robust (e.g., Redis, DB)
interface PendingMatch {
  matchId: string
  hostPlayerId: string
  presetId: PresetId
  createdAt: number
}
const pendingMatches: Map<string, PendingMatch> = new Map()
let ioInstance: SocketIOServer | null = null; // Add variable to hold the io instance

// --- Socket Event Handlers --- 

/** Initializes the LobbyManager with the Socket.IO server instance. */
function initialize(io: SocketIOServer): void {
    console.log("[LobbyManager] Initializing with IO instance.");
    if (ioInstance) {
        console.warn("[LobbyManager] Already initialized.");
        return;
    }
    ioInstance = io;
}

interface CreateMatchPayload {
  playerName: string // Optional: Use for display
  presetId: PresetId
}

/** Handles a client request to create a new match. */
function handleCreateMatch(socket: Socket, payload: CreateMatchPayload): void {
  console.log(`Player ${socket.id} requested to create match with preset: ${payload.presetId}`)

  const { presetId } = payload
  const preset = presetService.getPresetById(presetId)

  if (!preset) {
    console.error(`Preset not found: ${presetId}`)
    socket.emit('error', { message: `Invalid game preset selected.` })
    return
  }

  // TODO: Add validation - is the player already in a match?

  // Use a simpler match ID for development
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const matchId = isDevelopment 
      ? `m${matchCounter++}` // Simplified development ID
      : `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
  // Reset counter if it gets too high in dev (unlikely)
  if (isDevelopment && matchCounter > 9999) matchCounter = 1;

  const newMatch: PendingMatch = {
    matchId,
    hostPlayerId: socket.id,
    presetId: payload.presetId, // Use presetId from payload
    createdAt: Date.now(),
  }

  pendingMatches.set(matchId, newMatch)
  console.log(`[Lobby] Created pending match: ${matchId}`)
  socket.join(matchId)
  socket.emit('matchCreated', { matchId, presetId: payload.presetId })

  // TODO: Broadcast available matches to a general lobby room?
}

interface JoinMatchPayload {
  matchId: string
}

/** Handles a client request to join an existing match. */
function handleJoinMatch(socket: Socket, payload: JoinMatchPayload): void {
  const { matchId } = payload
  console.log(`[Lobby] Player ${socket.id} attempting to join match: ${matchId}`)

  const match = pendingMatches.get(matchId)
  if (!match) {
    console.error(`[Lobby] Match not found or already started: ${matchId}`)
    socket.emit('error', { message: `Match not found or is already full.` })
    return
  }

  if (match.hostPlayerId === socket.id) {
      console.warn(`[Lobby] Host ${socket.id} tried to join their own match ${matchId}. Ignoring.`)
      return
  }

  // Found the match, remove from pending
  pendingMatches.delete(matchId)
  console.log(`[Lobby] Removed pending match ${matchId}. Starting game...`);

  const playerIds = [match.hostPlayerId, socket.id]

  // Join the second player to the match room
  // The host is already in the room from handleCreateMatch
  socket.join(matchId)
  console.log(`[Lobby] Player ${socket.id} joined room ${matchId}`);

  // Initialize the game state using GameManager
  try {
    console.log(`[Lobby] Calling GameManager.initializeGame for ${matchId}...`);
    const initialState = GameManager.initializeGame(matchId, match.presetId, playerIds)
    
    // Double-check: Although initializeGame should emit, log here too
    if (initialState) {
        console.log(`[Lobby] Game ${matchId} initialized by GameManager. State ready.`);
        // GameManager.initializeGame already emits the state
    } else {
        // This case shouldn't happen if initializeGame throws on error
        console.error(`[Lobby] GameManager.initializeGame did not return state for ${matchId}`);
        ioInstance?.to(matchId).emit('error', { message: 'Failed to start game state.' }); // Use ioInstance
    }

  } catch (error) {
    console.error(`[Lobby] Error initializing game ${matchId}:`, error)
    // Notify players in the room about the error
    ioInstance?.to(matchId).emit('error', { message: 'Failed to start game due to server error.' }); // Use ioInstance
    // Consider how to handle this state - maybe kick players?
    socket.leave(matchId);
    // Attempt to leave the host too (might require finding the host socket)
    // io.sockets.sockets.get(match.hostPlayerId)?.leave(matchId);
  }
}

export const LobbyManager = {
  initialize, // Export the new function
  handleCreateMatch,
  handleJoinMatch,
  // Add functions to list pending matches, etc.
} 