/**
 * Enhanced Validation Utilities
 * 
 * Provides validation functions for user input including password strength,
 * username format, and email validation.
 */

/**
 * Validate password strength
 * @param {string} password - The password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];
  
  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }
  
  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  // Maximum length (prevent DOS attacks)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Check for special character
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;']/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common patterns
  const commonPatterns = ['password', '123456', 'qwerty', 'abc123', 'letmein'];
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    errors.push('Password contains common patterns and is too weak');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate password strength score (0-4)
 * @param {string} password - The password to score
 * @returns {number} - Strength score: 0 (very weak) to 4 (very strong)
 */
function calculatePasswordStrength(password) {
  if (!password) return 0;
  
  let score = 0;
  
  // Length bonus
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  
  // Character variety bonus
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;']/.test(password)) score++;
  
  // Penalty for common patterns
  const commonPatterns = ['password', '123456', 'qwerty', 'abc123', 'letmein'];
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    score = Math.max(0, score - 2);
  }
  
  // Cap at 4
  return Math.min(4, score);
}

/**
 * Validate username format
 * @param {string} username - The username to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateUsername(username) {
  const errors = [];
  
  if (!username) {
    return { valid: false, errors: ['Username is required'] };
  }
  
  // Length check
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 20) {
    errors.push('Username must be less than 20 characters');
  }
  
  // Character check - alphanumeric, underscores, hyphens only
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  // Must start with letter
  if (!/^[a-zA-Z]/.test(username)) {
    errors.push('Username must start with a letter');
  }
  
  // Reserved usernames
  const reserved = ['admin', 'root', 'system', 'moderator', 'guest', 'api', 'test'];
  if (reserved.includes(username.toLowerCase())) {
    errors.push('This username is reserved and cannot be used');
  }
  
  // Prevent offensive content (basic check)
  const offensive = ['fuck', 'shit', 'ass', 'bitch'];
  if (offensive.some(word => username.toLowerCase().includes(word))) {
    errors.push('Username contains inappropriate content');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate email format (more thorough than basic regex)
 * @param {string} email - The email to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateEmail(email) {
  const errors = [];
  
  if (!email) {
    return { valid: true, errors: [] }; // Email is optional
  }
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
    return { valid: false, errors };
  }
  
  // Length checks
  if (email.length > 254) {
    errors.push('Email is too long (max 254 characters)');
  }
  
  const [localPart, domain] = email.split('@');
  
  // Local part validation
  if (localPart.length > 64) {
    errors.push('Email local part is too long (max 64 characters)');
  }
  
  // Domain validation
  if (domain.length > 253) {
    errors.push('Email domain is too long (max 253 characters)');
  }
  
  // Check for common typos in popular domains
  const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const typoSuggestions = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'outlok.com': 'outlook.com',
  };
  
  if (typoSuggestions[domain.toLowerCase()]) {
    errors.push(`Did you mean ${typoSuggestions[domain.toLowerCase()]}?`);
  }
  
  // Disposable email detection (basic list)
  const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
  if (disposableDomains.some(d => domain.toLowerCase().includes(d))) {
    errors.push('Disposable email addresses are not allowed');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 * @param {string} input - The input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Validate recovery phrase format
 * @param {string} phrase - The recovery phrase to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateRecoveryPhrase(phrase) {
  const errors = [];
  
  if (!phrase) {
    return { valid: false, errors: ['Recovery phrase is required'] };
  }
  
  const words = phrase.trim().split(/\s+/);
  
  // Should be 12 words
  if (words.length !== 12) {
    errors.push('Recovery phrase must be exactly 12 words');
  }
  
  // Each word should be alphabetic and lowercase
  if (words.some(word => !/^[a-z]+$/.test(word))) {
    errors.push('Recovery phrase should contain only lowercase alphabetic words');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validatePassword,
  calculatePasswordStrength,
  validateUsername,
  validateEmail,
  sanitizeInput,
  validateRecoveryPhrase,
};

