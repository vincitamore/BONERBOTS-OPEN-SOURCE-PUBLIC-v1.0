/**
 * WebSocket client service for real-time state updates
 * Replaces Supabase Realtime functionality
 */

import { WS_URL } from '../config';

type EventCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimeout: number | null = null;
  private isIntentionalClose = false;
  private heartbeatInterval: number | null = null;

  /**
   * Connect to the WebSocket server
   */
  connect(url: string = WS_URL): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isIntentionalClose = false;

    try {
      console.log(`Connecting to WebSocket at ${url}`);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.setupHeartbeat();
        
        // Notify connection listeners
        this.notifyListeners('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle different message types
          if (message.type === 'state_update') {
            this.notifyListeners('state_update', message.payload);
          } else if (message.type === 'heartbeat') {
            // Server responded to heartbeat, connection is alive
            console.debug('Heartbeat received');
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifyListeners('connection', { status: 'error', error });
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.cleanup();
        this.notifyListeners('connection', { status: 'disconnected' });
        
        if (!this.isIntentionalClose) {
          this.handleReconnect();
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isIntentionalClose = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('WebSocket disconnected');
  }

  /**
   * Subscribe to an event
   */
  subscribe(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const callbacks = this.listeners.get(event)!;
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
    }
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Send a message to the server
   */
  send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message: WebSocket not connected');
      return;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Giving up.');
      this.notifyListeners('connection', { status: 'failed' });
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff with max delay of 60 seconds
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Set up heartbeat to keep connection alive
   */
  private setupHeartbeat(): void {
    this.cleanup();
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'heartbeat', timestamp: Date.now() });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Clean up intervals and timeouts
   */
  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Notify all listeners for a specific event
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
