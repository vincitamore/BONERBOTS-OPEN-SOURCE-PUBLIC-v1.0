/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * 
 * Validates JWT tokens and attaches user info to request
 */

const JWT_SECRET = process.env.JWT_SECRET || 'bonerbots-default-jwt-secret-change-in-production';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: No JWT_SECRET set in environment. Using default secret (not secure!)');
  console.warn('   Please set JWT_SECRET in server/.env to a random string');
}

/**
 * Middleware to authenticate JWT tokens
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  });
}

/**
 * Middleware to require specific role
 * @param {string} role - Required role ('admin', 'user', 'viewer')
 */
function requireRole(role) {
  const roleHierarchy = {
    'viewer': 1,
    'user': 2,
    'admin': 3
  };
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRole = req.user.role || 'viewer';
    const requiredLevel = roleHierarchy[role] || 1;
    const userLevel = roleHierarchy[userRole] || 1;
    
    if (userLevel < requiredLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: role,
        current: userRole
      });
    }
    
    next();
  };
}

/**
 * Generate a JWT token
 * @param {object} payload - Token payload (userId, username, role)
 * @param {string} expiresIn - Token expiration (default: 24h)
 */
function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @returns {object|null} - Decoded token or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Optional authentication (doesn't fail if no token provided)
 * Useful for endpoints that work for both authenticated and anonymous users
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
}

/**
 * Require resource ownership middleware
 * Verifies that the authenticated user owns the requested resource
 * @param {string} resourceType - Type of resource ('bot', 'provider', 'wallet', etc.)
 * @param {string} idParam - Request parameter name containing resource ID (default: 'id')
 * @param {string} userIdField - Field name in resource containing user_id (default: 'user_id')
 */
function requireOwnership(resourceType, idParam = 'id', userIdField = 'user_id') {
  return async (req, res, next) => {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Admins can access any resource
    if (req.user.role === 'admin') {
      return next();
    }
    
    const resourceId = req.params[idParam];
    if (!resourceId) {
      return res.status(400).json({ error: `${idParam} parameter required` });
    }
    
    try {
      const Database = require('better-sqlite3');
      const path = require('path');
      const dbPath = path.join(__dirname, '..', '..', 'data', 'arena.db');
      const db = new Database(dbPath, { readonly: true });
      
      try {
        // Map resource types to table names
        const tableMap = {
          'bot': 'bots',
          'provider': 'llm_providers',
          'wallet': 'wallets',
          'position': 'positions',
          'trade': 'trades'
        };
        
        const tableName = tableMap[resourceType] || resourceType;
        
        // Query to check ownership
        const query = `SELECT ${userIdField} FROM ${tableName} WHERE id = ?`;
        const resource = db.prepare(query).get(resourceId);
        
        if (!resource) {
          return res.status(404).json({ error: `${resourceType} not found` });
        }
        
        if (resource[userIdField] !== req.user.userId) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'You do not have permission to access this resource'
          });
        }
        
        next();
      } finally {
        db.close();
      }
    } catch (error) {
      console.error('Error checking resource ownership:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Require admin role
 * Shorthand for requireRole('admin')
 */
const requireAdmin = requireRole('admin');

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireOwnership,
  generateToken,
  verifyToken,
  optionalAuth,
  JWT_SECRET
};

