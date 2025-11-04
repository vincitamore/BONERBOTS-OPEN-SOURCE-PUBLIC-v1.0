// services/stateService.ts
import { wsService } from './websocketService';
import { ArenaState } from '../types';
import { API_URL } from '../config';

/**
 * Update the arena state (Broadcast mode only)
 * This sends the state to the server, which persists it and broadcasts to spectators
 */
export const updateState = async (newState: ArenaState): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`State updated and broadcasted to ${result.clients} clients`);
  } catch (error) {
    console.error('Error updating state:', error);
    throw error;
  }
};

/**
 * Subscribe to state changes (Spectator mode)
 * Returns an unsubscribe function
 */
export const subscribeToStateChanges = (callback: (newState: ArenaState) => void): (() => void) => {
  // Connect to WebSocket if not already connected
  if (!wsService.isConnected()) {
    wsService.connect();
  }
  
  // Subscribe to state updates
  wsService.subscribe('state_update', callback);
  
  // Return unsubscribe function
  return () => {
    wsService.unsubscribe('state_update', callback);
  };
};

/**
 * Get the current arena state from the server
 */
export const getArenaState = async (): Promise<ArenaState | null> => {
  try {
    const response = await fetch(`${API_URL}/api/state`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No state exists yet
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching arena state:', error);
    return null;
  }
};
