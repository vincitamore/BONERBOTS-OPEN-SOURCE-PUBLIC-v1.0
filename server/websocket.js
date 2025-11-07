/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const WebSocket = require('ws');
const url = require('url');
const authService = require('./services/authService');

/**
 * WebSocket server for broadcasting arena state updates (Multi-Tenant)
 * Supports JWT authentication and user-specific channels
 */
class WebSocketServer {
  constructor(port) {
    this.port = port;
    this.wss = null;
    this.clients = new Set(); // All authenticated clients
    this.userClients = new Map(); // userId -> Set of ws clients
    this.heartbeatInterval = null;
  }

  /**
   * Initialize and start the WebSocket server with authentication
   */
  start() {
    this.wss = new WebSocket.Server({ port: this.port });
    
    this.wss.on('connection', async (ws, req) => {
      console.log('📞 New WebSocket connection attempt...');
      
      // Extract token from query parameters
      const parameters = url.parse(req.url, true);
      const token = parameters.query.token;
      
      if (!token) {
        console.warn('⚠️  WebSocket connection rejected: No authentication token');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      // Verify JWT token
      try {
        const decoded = authService.verifyAccessToken(token);
        
        // Set up client metadata
        ws.userId = decoded.userId;
        ws.username = decoded.username;
        ws.role = decoded.role;
        ws.isAlive = true;
        ws.isAuthenticated = true;
        
        // Add to clients set
        this.clients.add(ws);
        
        // Add to user-specific clients map
        if (!this.userClients.has(ws.userId)) {
          this.userClients.set(ws.userId, new Set());
        }
        this.userClients.get(ws.userId).add(ws);
        
        console.log(`✅ WebSocket client authenticated: ${ws.username} (${ws.role})`);
        
        // Send authentication success message
        ws.send(JSON.stringify({
          type: 'auth_success',
          user: {
            id: ws.userId,
            username: ws.username,
            role: ws.role
          },
          timestamp: Date.now()
        }));
        
      } catch (error) {
        console.warn('⚠️  WebSocket authentication failed:', error.message);
        ws.close(1008, 'Invalid authentication token');
        return;
      }
      
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
          
          // Handle subscribe to specific channels
          if (data.type === 'subscribe') {
            const channel = data.channel;
            if (!ws.channels) {
              ws.channels = new Set();
            }
            ws.channels.add(channel);
            console.log(`📢 ${ws.username} subscribed to channel: ${channel}`);
          }
          
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Handle client disconnection
      ws.on('close', () => {
        console.log(`👋 WebSocket client disconnected: ${ws.username}`);
        this.clients.delete(ws);
        
        // Remove from user-specific clients
        if (ws.userId && this.userClients.has(ws.userId)) {
          const userClients = this.userClients.get(ws.userId);
          userClients.delete(ws);
          if (userClients.size === 0) {
            this.userClients.delete(ws.userId);
          }
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        this.clients.delete(ws);
        if (ws.userId && this.userClients.has(ws.userId)) {
          const userClients = this.userClients.get(ws.userId);
          userClients.delete(ws);
          if (userClients.size === 0) {
            this.userClients.delete(ws.userId);
          }
        }
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
   * Broadcast arena state to all connected clients (DEPRECATED - use broadcastToUser or broadcastToAdmins)
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
      if (ws.readyState === WebSocket.OPEN && ws.isAuthenticated) {
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
   * Broadcast message to a specific user
   * @param {string} userId - The user ID to send to
   * @param {Object} message - The message object to send
   */
  broadcastToUser(userId, message) {
    if (!this.wss) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const userClients = this.userClients.get(userId);
    if (!userClients || userClients.size === 0) {
      console.log(`No active connections for user ${userId.substring(0, 8)}...`);
      return;
    }

    const messageStr = JSON.stringify(message);
    let successCount = 0;

    userClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          successCount++;
        } catch (error) {
          console.error(`Error sending to user ${userId}:`, error);
        }
      }
    });

    console.log(`Sent message to ${successCount} connection(s) for user ${userId.substring(0, 8)}...`);
  }

  /**
   * Broadcast message to all admin users
   * @param {Object} message - The message object to send
   */
  broadcastToAdmins(message) {
    if (!this.wss) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const messageStr = JSON.stringify(message);
    let successCount = 0;

    this.clients.forEach((ws) => {
      if (ws.role === 'admin' && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          successCount++;
        } catch (error) {
          console.error('Error sending to admin:', error);
        }
      }
    });

    console.log(`Broadcasted message to ${successCount} admin connection(s)`);
  }

  /**
   * Broadcast user-specific bot state updates
   * Sends bot data only to the owning user or admins
   * @param {string} userId - The user who owns the bots
   * @param {Object} botState - The bot state to broadcast
   */
  broadcastBotState(userId, botState) {
    const message = {
      type: 'bot_state_update',
      userId,
      payload: botState,
      timestamp: Date.now()
    };

    // Send to the user
    this.broadcastToUser(userId, message);

    // Also send to all admins for monitoring
    this.broadcastToAdmins(message);
  }

  /**
   * Broadcast to a specific channel
   * @param {string} channel - The channel name
   * @param {Object} message - The message to broadcast
   */
  broadcastToChannel(channel, message) {
    if (!this.wss) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const messageStr = JSON.stringify({
      ...message,
      channel
    });

    let successCount = 0;

    this.clients.forEach((ws) => {
      if (ws.channels && ws.channels.has(channel) && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          successCount++;
        } catch (error) {
          console.error(`Error sending to channel ${channel}:`, error);
        }
      }
    });

    if (successCount > 0) {
      console.log(`Broadcasted to channel "${channel}": ${successCount} recipient(s)`);
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
