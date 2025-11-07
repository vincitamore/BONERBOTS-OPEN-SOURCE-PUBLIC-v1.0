/**
 * @license
 * SPDX-License-Identifier: MIT
 */

/**
 * Central router configuration
 * Aggregates all API routes for the application
 */

const express = require('express');
const botsRoutes = require('./bots');
const providersRoutes = require('./providers');
const walletsRoutes = require('./wallets');
const settingsRoutes = require('./settings');
const analyticsRoutes = require('./analytics');
const auditRoutes = require('./audit');

const router = express.Router();

// Mount all route modules
// Note: admin and leaderboard routes are mounted directly in server.js
router.use('/bots', botsRoutes);
router.use('/providers', providersRoutes);
router.use('/wallets', walletsRoutes);
router.use('/settings', settingsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/audit', auditRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0'
  });
});

module.exports = router;

