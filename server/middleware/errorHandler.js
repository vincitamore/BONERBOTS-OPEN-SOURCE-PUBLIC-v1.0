/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const logger = require('../utils/logger');

/**
 * Error handling middleware
 * Catches all errors and sends appropriate responses
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Prepare error response
  const errorResponse = {
    error: err.message || 'Internal server error',
    path: req.path
  };
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for unknown routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
