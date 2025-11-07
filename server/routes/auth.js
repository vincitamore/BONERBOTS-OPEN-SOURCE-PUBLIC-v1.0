/**
 * Authentication Routes
 * Handles user registration, login, logout, token refresh, and account recovery
 */

const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const authService = require('../services/authService');
const { authLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register',
  registerLimiter, // Apply strict rate limiting for registration
  body('username').isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  validateRequest,
  async (req, res) => {
    try {
      const { username, password, email } = req.body;
      
      // Create user and get recovery phrase
      const result = await authService.createUser(username, password, email);
      
      // Auto-login: create session and generate tokens
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');
      const authResult = await authService.authenticateUser(result.username, password, ipAddress, userAgent);
      
      res.status(201).json({
        user: authResult.user,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        recoveryPhrase: result.recoveryPhrase, // CRITICAL: Show this once to user
        message: 'Registration successful. SAVE YOUR RECOVERY PHRASE - it cannot be retrieved later!'
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Registration failed', message: error.message });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT tokens
 */
router.post('/login',
  authLimiter, // Apply rate limiting to prevent brute force
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest,
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');
      
      const result = await authService.authenticateUser(username, password, ipAddress, userAgent);
      
      res.json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.message.includes('Invalid credentials') || error.message.includes('disabled')) {
        return res.status(401).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Authentication failed', message: error.message });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user (revoke refresh token session)
 */
router.post('/logout',
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validateRequest,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const revoked = await authService.revokeSession(refreshToken);
      
      if (revoked) {
        res.json({ message: 'Logged out successfully' });
      } else {
        res.json({ message: 'Session already expired or invalid' });
      }
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validateRequest,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshAccessToken(refreshToken);
      
      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: error.message || 'Token refresh failed' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user info from token
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put('/me',
  authenticateToken,
  body('displayName').optional().isLength({ max: 50 }).withMessage('Display name too long'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio too long'),
  validateRequest,
  async (req, res) => {
    try {
      const updates = {};
      const allowedFields = ['displayName', 'bio', 'avatarUrl', 'country', 'timezone', 'preferences'];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field === 'displayName' ? 'display_name' : field] = req.body[field];
        }
      }
      
      await authService.updateUserProfile(req.user.userId, updates);
      const user = await authService.getUserById(req.user.userId);
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          displayName: user.display_name,
          bio: user.bio,
          avatarUrl: user.avatar_url,
          preferences: user.preferences
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

/**
 * POST /api/auth/recover
 * Verify recovery phrase for account recovery
 */
router.post('/recover',
  authLimiter, // Apply rate limiting
  body('username').notEmpty().withMessage('Username is required'),
  body('recoveryPhrase').notEmpty().withMessage('Recovery phrase is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  validateRequest,
  async (req, res) => {
    try {
      const { username, recoveryPhrase, newPassword } = req.body;
      const result = await authService.resetPassword(username, recoveryPhrase, newPassword);
      
      res.json({
        message: 'Password reset successfully. Please log in with your new password.',
        userId: result.userId,
        username: result.username
      });
    } catch (error) {
      console.error('Account recovery error:', error);
      
      if (error.message.includes('not found') || error.message.includes('Invalid')) {
        return res.status(401).json({ error: 'Invalid username or recovery phrase' });
      }
      
      res.status(500).json({ error: 'Account recovery failed' });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reset password using recovery phrase
 */
router.post('/reset-password',
  passwordResetLimiter, // Strict rate limiting for password resets
  body('username').notEmpty().withMessage('Username is required'),
  body('recoveryPhrase').notEmpty().withMessage('Recovery phrase is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validateRequest,
  async (req, res) => {
    try {
      const { username, recoveryPhrase, newPassword } = req.body;
      const result = await authService.resetPassword(username, recoveryPhrase, newPassword);
      
      res.json({
        message: 'Password reset successfully',
        userId: result.userId,
        username: result.username
      });
    } catch (error) {
      console.error('Password reset error:', error);
      
      if (error.message.includes('not found') || error.message.includes('Invalid')) {
        return res.status(401).json({ error: 'Invalid username or recovery phrase' });
      }
      
      res.status(500).json({ error: 'Password reset failed' });
    }
  }
);

/**
 * PUT /api/auth/password
 * Change password (requires current password)
 */
router.put('/password',
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  validateRequest,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user.userId, currentPassword, newPassword);
      
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      
      if (error.message.includes('incorrect')) {
        return res.status(401).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Password change failed' });
    }
  }
);

module.exports = router;

