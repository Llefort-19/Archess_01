import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@archess/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export function useSocketConnection() {
  // Use useRef to store the socket instance persistently across renders
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection only once
    if (!socketRef.current) {
      console.log(`Connecting socket to ${SERVER_URL}...`);
      // Store the socket instance in the ref
      socketRef.current = io(SERVER_URL, {
        // Optional: Add connection options if needed
        // reconnectionAttempts: 5,
        // reconnectionDelay: 1000,
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected!', socketRef.current?.id);
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket disconnected.', reason);
        setIsConnected(false);
        // Note: State resets originally here (e.g., setMatchId(null)) 
        // should happen where the state lives (likely in App or useAppState later)
      });

      socketRef.current.on('connect_error', (err) => {
        console.error("Socket connection error:", err);
        setIsConnected(false);
        // Note: Setting serverMessage state should happen where that state lives (App)
      });
    }

    // Cleanup on component unmount
    return () => {
      if (socketRef.current?.connected) {
        console.log('Disconnecting socket on unmount...');
        socketRef.current.disconnect();
        // We don't nullify the ref here, as the component might remount.
        // The effect guard (!socketRef.current) prevents re-initialization.
        setIsConnected(false);
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Return the current socket instance (from the ref) and connection status
  return { socket: socketRef.current, isConnected };
} 