/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const WebSocket = require('ws');

/**
 * WebSocket server for broadcasting arena state updates
 */
class WebSocketServer {
  constructor(port) {
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    this.heartbeatInterval = null;
  }

  /**
   * Initialize and start the WebSocket server
   */
  start() {
    this.wss = new WebSocket.Server({ port: this.port });
    
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket client connected');
      this.clients.add(ws);
      
      // Set up client metadata
      ws.isAlive = true;
      
      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          
          // Handle heartbeat
          if (data.type === 'heartbeat') {
            ws.send(JSON.stringify({ 
              type: 'heartbeat', 
              timestamp: Date.now() 
            }));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Handle client disconnection
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        this.clients.delete(ws);
      });
    });
    
    // Set up heartbeat to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('Terminating inactive WebSocket client');
          this.clients.delete(ws);
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
    
    console.log(`WebSocket server listening on port ${this.port}`);
  }

  /**
   * Broadcast arena state to all connected clients
   * @param {Object} state - The arena state to broadcast
   */
  broadcastState(state) {
    if (!this.wss) {
      console.warn('WebSocket server not initialized');
      return;
    }
    
    const message = JSON.stringify({
      type: 'state_update',
      payload: state
    });
    
    let successCount = 0;
    let failCount = 0;
    
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          successCount++;
        } catch (error) {
          console.error('Error sending to WebSocket client:', error);
          failCount++;
        }
      } else {
        failCount++;
      }
    });
    
    if (successCount > 0 || failCount > 0) {
      console.log(`Broadcasted state to ${successCount} clients (${failCount} failed)`);
    }
  }

  /**
   * Get the number of connected clients
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Shut down the WebSocket server
   */
  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket server closed');
      });
    }
  }
}

module.exports = WebSocketServer;
