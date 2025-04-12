import express, { Request, Response } from 'express'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import dotenv from 'dotenv'
import path from 'path'
import cors from 'cors'

import { presetService } from './services/PresetService'
import { LobbyManager } from './services/LobbyManager'
import { GameManager } from './services/GameManager'
import { CombatManager } from './services/CombatManager'
import type { 
    ServerToClientEvents,
    ClientToServerEvents,
    MoveActionPayload,
    CombatActionPayload
} from '@archess/shared'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') }) // Load root .env

const app = express()
const server = http.createServer(app)

// Configure CORS
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
app.use(cors({ origin: clientUrl })) // Use cors middleware

// Create the io instance WITH types
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST'],
  },
})

const PORT = parseInt(process.env.SERVER_PORT || '3001', 10)

// --- API Endpoints --- 
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('Server healthy')
})

app.get('/api/presets', (_req: Request, res: Response) => {
    const presets = presetService.listAvailablePresets();
    res.status(200).json(presets);
});

// --- Socket.IO Connections --- 
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id)

  // --- Store Player ID on Socket --- 
  // Assign the socket.id as the playerId in socket.data for later lookup
  // Note: If you have a separate login/authentication system, 
  // you might assign a different unique user ID here instead.
  socket.data.playerId = socket.id; 

  socket.emit('message', `Welcome, you are connected with ID: ${socket.id}`)

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
    // TODO: Handle player leaving a match (e.g., call a GameManager function)
  })

  // Register Event Handlers - Payloads are strongly typed
  socket.on('createMatch', (payload) => LobbyManager.handleCreateMatch(socket, payload));
  socket.on('joinMatch', (payload) => LobbyManager.handleJoinMatch(socket, payload));
  
  // Destructured payload is typed
  socket.on('playerAction', ({ matchId, actionType, payload }) => {
      // Validation is still good practice
      if (!matchId || !actionType) {
          console.warn(`[Socket ${socket.id}] Invalid playerAction received: Missing matchId or actionType`, { matchId, actionType, payload });
          socket.emit('error', { message: 'Invalid action: Missing matchId or actionType.' });
          return;
      }
      console.log(`[Socket ${socket.id}] Received playerAction for match ${matchId}:`, { actionType, payload });
      // Suppress warnings for this line
      const handlerPayload = payload as MoveActionPayload | Record<string, never>; 
      GameManager.handlePlayerAction(socket.id, matchId, actionType, handlerPayload); // eslint-disable-line
  });
})

// --- Server Startup Logic --- 
async function startServer() {
  console.log("[Server] Attempting to start...");
  try {
    // Load game presets before starting the server
    // Presets are loaded automatically when presetService is instantiated
    // console.log("[Server] Loading presets...");
    // await presetService.loadAllPresets() // REMOVED - presets loaded in constructor
    // console.log("[Server] Presets loaded successfully.");

    // *** Initialize Managers with the IO instance ***
    console.log("[Server] Initializing LobbyManager...");
    GameManager.initialize(io);
    LobbyManager.initialize(io);
    console.log("[Server] LobbyManager initialized.");
    
    console.log("[Server] Initializing CombatManager...");
    CombatManager.initialize(io);
    console.log("[Server] CombatManager initialized.");

    // *** Start the Combat Loop ***
    console.log("[Server] Starting combat loop...");
    CombatManager.startCombatLoop()
    console.log("[Server] Combat loop initiated.");

    console.log(`[Server] Attempting to listen on port ${PORT}...`);
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
      console.log(`Allowing connections from: ${clientUrl}`)
      console.log(`Available presets loaded: ${presetService.listAvailablePresets().length}`)
    })

    server.on('error', (error: NodeJS.ErrnoException) => {
      console.error('Server error:', error)
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`)
      }
      process.exit(1)
    })

  } catch (error) {
    console.error("[Server] CRITICAL ERROR during startup sequence:", error);
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server gracefully...')
  io.close(() => {
    console.log('Socket.IO server closed.')
    CombatManager.stopCombatLoop()
    server.close(() => {
      console.log('HTTP server closed.')
      process.exit(0)
    })
  })

  setTimeout(() => {
    console.error('Could not close connections in time, forcing shutdown')
    process.exit(1)
  }, 5000)
})

// Optional: Graceful shutdown
process.on('SIGTERM', () => {
    console.info('SIGTERM signal received: closing HTTP server');
    CombatManager.stopCombatLoop();
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Start the server
startServer().catch(err => {
    console.error("Unhandled error during server startup:", err);
    process.exit(1);
}); 