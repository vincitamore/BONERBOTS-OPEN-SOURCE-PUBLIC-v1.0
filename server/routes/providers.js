/**
 * @license
 * SPDX-License-Identifier: MIT
 */

const express = require('express');
const { body, query, param } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { encrypt, redact } = require('../utils/encryption');
const { createAuditLog } = require('../database/relational');
const db = require('../database/relational');
const axios = require('axios');

const router = express.Router();

/**
 * GET /api/providers - List all LLM providers
 * MULTI-TENANT: Returns only providers owned by authenticated user (unless admin)
 */
router.get('/',
  authenticateToken,
  query('active').optional().isBoolean().withMessage('Active must be a boolean'),
  query('provider_type').optional().isIn(['openai', 'anthropic', 'gemini', 'grok', 'local', 'custom']).withMessage('Invalid provider type'),
  validateRequest,
  (req, res) => {
    try {
      const filters = {};
      
      // CRITICAL: Filter by user_id unless admin
      if (req.user.role !== 'admin') {
        filters.user_id = req.user.userId;
      }
      
      if (req.query.active !== undefined) {
        filters.active = req.query.active === 'true';
      }
      
      if (req.query.provider_type) {
        filters.provider_type = req.query.provider_type;
      }
      
      let providers = db.getProviders(filters);
      
      // Redact API keys for non-admin users
      if (req.user.role !== 'admin') {
        providers = providers.map(p => ({
          ...p,
          api_key_encrypted: p.api_key_encrypted ? redact(p.id.toString()) : null
        }));
      }
      
      res.json(providers);
    } catch (error) {
      console.error('Error fetching providers:', error);
      res.status(500).json({ error: 'Failed to fetch providers', message: error.message });
    }
  }
);

/**
 * GET /api/providers/:id - Get specific provider
 * MULTI-TENANT: Returns provider only if owned by authenticated user (unless admin)
 */
router.get('/:id',
  authenticateToken,
  param('id').isInt().withMessage('Provider ID must be an integer'),
  validateRequest,
  (req, res) => {
    try {
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      let provider = db.getProvider(parseInt(req.params.id), userId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found or access denied' });
      }
      
      // Redact API key for non-admin users
      if (req.user.role !== 'admin') {
        provider = {
          ...provider,
          api_key_encrypted: provider.api_key_encrypted ? redact(provider.id.toString()) : null
        };
      }
      
      res.json(provider);
    } catch (error) {
      console.error('Error fetching provider:', error);
      res.status(500).json({ error: 'Failed to fetch provider', message: error.message });
    }
  }
);

/**
 * POST /api/providers - Create new LLM provider
 */
router.post('/',
  authenticateToken,
  requireRole('user'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('provider_type').isIn(['openai', 'anthropic', 'gemini', 'grok', 'local', 'custom']).withMessage('Invalid provider type'),
  body('api_endpoint').trim().isLength({ min: 1 }).withMessage('API endpoint is required')
    .custom((value) => {
      // More lenient URL validation - just check it starts with http:// or https://
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        throw new Error('API endpoint must start with http:// or https://');
      }
      return true;
    }),
  body('model_name').optional().trim().isLength({ max: 100 }).withMessage('Model name max 100 characters'),
  body('api_key').optional().trim().isLength({ min: 1 }).withMessage('API key cannot be empty if provided'),
  body('config_json').optional().isJSON().withMessage('Config must be valid JSON'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  validateRequest,
  (req, res) => {
    try {
      // Check if provider name already exists for this user
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const existing = db.getProviders({ user_id: userId }).find(p => p.name === req.body.name);
      if (existing) {
        return res.status(409).json({ error: 'Provider with this name already exists' });
      }
      
      // Encrypt API key if provided (per-user encryption)
      let apiKeyEncrypted = null;
      if (req.body.api_key) {
        apiKeyEncrypted = encrypt(req.body.api_key, req.user.userId);
      }
      
      const provider = db.createProvider({
        user_id: req.user.userId, // CRITICAL: Set user_id from authenticated user
        name: req.body.name,
        provider_type: req.body.provider_type,
        api_endpoint: req.body.api_endpoint,
        model_name: req.body.model_name || null,
        api_key_encrypted: apiKeyEncrypted,
        config_json: req.body.config_json || null,
        is_active: req.body.is_active !== undefined ? req.body.is_active : true
      });
      
      // Create audit log
      createAuditLog({
        event_type: 'provider_created',
        entity_type: 'provider',
        entity_id: provider.id.toString(),
        user_id: req.user.userId,
        details: { provider_name: provider.name, provider_type: provider.provider_type },
        ip_address: req.ip
      });
      
      // Redact API key in response
      const response = {
        ...provider,
        api_key_encrypted: provider.api_key_encrypted ? redact(provider.id.toString()) : null
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating provider:', error);
      res.status(500).json({ error: 'Failed to create provider', message: error.message });
    }
  }
);

/**
 * PUT /api/providers/:id - Update provider
 */
router.put('/:id',
  authenticateToken,
  requireRole('user'),
  param('id').isInt().withMessage('Provider ID must be an integer'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('provider_type').optional().isIn(['openai', 'anthropic', 'gemini', 'grok', 'local', 'custom']).withMessage('Invalid provider type'),
  body('api_endpoint').optional().trim().isLength({ min: 1 }).withMessage('API endpoint cannot be empty')
    .custom((value) => {
      // More lenient URL validation - just check it starts with http:// or https://
      if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
        throw new Error('API endpoint must start with http:// or https://');
      }
      return true;
    }),
  body('model_name').optional().trim().isLength({ max: 100 }).withMessage('Model name max 100 characters'),
  body('api_key').optional().trim().isLength({ min: 1 }).withMessage('API key cannot be empty if provided'),
  body('config_json').optional().isJSON().withMessage('Config must be valid JSON'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  validateRequest,
  (req, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const userId = req.user.role === 'admin' ? null : req.user.userId;
      const provider = db.getProvider(providerId, userId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found or access denied' });
      }
      
      const updates = { ...req.body };
      
      // If updating API key, encrypt it
      if (updates.api_key) {
        updates.api_key_encrypted = encrypt(updates.api_key, req.user.userId);
        delete updates.api_key;
      }
      
      const updatedProvider = db.updateProvider(providerId, updates, userId);
      
      // Create audit log
      createAuditLog({
        event_type: 'provider_updated',
        entity_type: 'provider',
        entity_id: providerId.toString(),
        user_id: req.user?.userId,
        details: { updates: Object.keys(updates) },
        ip_address: req.ip
      });
      
      // Redact API key in response
      const response = {
        ...updatedProvider,
        api_key_encrypted: updatedProvider.api_key_encrypted ? redact(providerId.toString()) : null
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error updating provider:', error);
      res.status(500).json({ error: 'Failed to update provider', message: error.message });
    }
  }
);

/**
 * DELETE /api/providers/:id - Delete provider
 */
router.delete('/:id',
  authenticateToken,
  requireRole('admin'),
  param('id').isInt().withMessage('Provider ID must be an integer'),
  validateRequest,
  (req, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const provider = db.getProvider(providerId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      
      // Will throw error if bots are using this provider
      db.deleteProvider(providerId);
      
      // Create audit log
      createAuditLog({
        event_type: 'provider_deleted',
        entity_type: 'provider',
        entity_id: providerId.toString(),
        user_id: req.user?.userId,
        details: { provider_name: provider.name },
        ip_address: req.ip
      });
      
      res.json({ success: true, message: 'Provider deleted successfully' });
    } catch (error) {
      console.error('Error deleting provider:', error);
      
      if (error.message.includes('bot(s) are using it')) {
        return res.status(409).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to delete provider', message: error.message });
    }
  }
);

/**
 * POST /api/providers/:id/test - Test provider connection
 */
router.post('/:id/test',
  authenticateToken,
  requireRole('admin'),
  param('id').isInt().withMessage('Provider ID must be an integer'),
  validateRequest,
  async (req, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const provider = db.getProvider(providerId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      
      if (!provider.api_key_encrypted) {
        return res.status(400).json({ error: 'Provider has no API key configured' });
      }
      
      // Decrypt API key
      const { decrypt } = require('../utils/encryption');
      let apiKey;
      try {
        apiKey = decrypt(provider.api_key_encrypted);
      } catch (error) {
        return res.status(500).json({ error: 'Failed to decrypt API key' });
      }
      
      // Test connection based on provider type
      let testResult;
      
      try {
        switch (provider.provider_type) {
          case 'gemini':
            testResult = await axios.get(
              `${provider.api_endpoint.replace(':generateContent', '')}?key=${apiKey}`,
              { timeout: 10000 }
            );
            break;
            
          case 'openai':
          case 'grok':
            testResult = await axios.get(
              provider.api_endpoint.replace('/chat/completions', '/models'),
              {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 10000
              }
            );
            break;
            
          case 'anthropic':
            testResult = await axios.post(
              provider.api_endpoint,
              {
                model: provider.model_name,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01'
                },
                timeout: 10000
              }
            );
            break;
            
          case 'local':
            testResult = await axios.get(
              provider.api_endpoint.replace('/api/generate', '/api/tags'),
              { timeout: 10000 }
            );
            break;
            
          default:
            return res.status(400).json({ error: 'Provider type not supported for testing' });
        }
        
        res.json({
          success: true,
          message: 'Provider connection successful',
          status: testResult.status
        });
        
      } catch (testError) {
        console.error('Provider test failed:', testError.message);
        res.status(200).json({
          success: false,
          message: 'Provider connection failed',
          error: testError.response?.data?.error?.message || testError.message
        });
      }
      
    } catch (error) {
      console.error('Error testing provider:', error);
      res.status(500).json({ error: 'Failed to test provider', message: error.message });
    }
  }
);

module.exports = router;

