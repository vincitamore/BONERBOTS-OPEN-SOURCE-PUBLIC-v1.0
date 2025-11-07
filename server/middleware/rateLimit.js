/**
 * Rate Limiting Middleware
 * 
 * Protects API endpoints from abuse by limiting request rates.
 * Uses express-rate-limit with different limits for different endpoint types.
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Applies to all API endpoints not covered by more specific limiters
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again after 15 minutes.',
      retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Protects against brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again after 15 minutes.',
      retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  }
});

/**
 * Stricter rate limiter for registration
 * Prevents spam account creation
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 registration attempts per hour
  message: {
    error: 'Too many accounts created from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many account creation attempts. Please try again after 1 hour.',
      retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
  }
});

/**
 * Rate limiter for password reset attempts
 * Prevents abuse of password recovery system
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many password reset attempts. Please try again after 1 hour.',
      retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
  }
});

/**
 * Lenient rate limiter for data queries
 * Allows more requests for read-only operations
 */
const queryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Moderate rate limiter for write operations
 * Creates, updates, deletes
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 write operations per windowMs
  message: {
    error: 'Too many write operations from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many write operations. Please slow down and try again after 15 minutes.',
      retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  }
});

/**
 * Admin operations rate limiter
 * More lenient for admin users but still protected
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: {
    error: 'Too many admin requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  queryLimiter,
  writeLimiter,
  adminLimiter,
};

