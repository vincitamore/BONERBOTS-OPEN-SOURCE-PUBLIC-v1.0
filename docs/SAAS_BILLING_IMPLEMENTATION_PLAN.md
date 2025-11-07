# BONERBOTS SaaS - Usage-Based Billing Implementation Plan

This document outlines the complete implementation plan for transforming BONERBOTS into a SaaS platform with usage-based billing through Stripe, comprehensive token tracking, and admin-managed LLM providers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase 1: Database Schema Changes](#phase-1-database-schema-changes)
3. [Phase 2: Token Usage Tracking](#phase-2-token-usage-tracking)
4. [Phase 3: Stripe Integration](#phase-3-stripe-integration)
5. [Phase 4: Provider Management Restrictions](#phase-4-provider-management-restrictions)
6. [Phase 5: Billing Dashboard & User Interface](#phase-5-billing-dashboard--user-interface)
7. [Phase 6: Admin Controls](#phase-6-admin-controls)
8. [Phase 7: Testing & Deployment](#phase-7-testing--deployment)
9. [Cost Estimation Examples](#cost-estimation-examples)

---

## Architecture Overview

### Key Changes from Self-Hosted to SaaS

**Current Architecture (Self-Hosted):**
- Users add their own LLM provider API keys
- Users pay LLM providers directly
- No usage tracking
- No billing system

**New Architecture (SaaS):**
- Admins configure LLM providers (centralized API keys)
- Users select from available providers
- All API calls tracked with token counts
- Monthly billing via Stripe based on usage
- Different pricing tiers per model/provider

### Billing Model

**Stripe Metered Billing** - Users are billed monthly based on:
- **Input tokens**: Tokens sent to LLM (prompts, history, market data)
- **Output tokens**: Tokens received from LLM (decisions, summaries)
- **Different rates per provider**: Gemini, OpenAI, Claude, Grok each have different costs

**Example Pricing Structure:**
```
Provider           Input (per 1M tokens)   Output (per 1M tokens)
─────────────────────────────────────────────────────────────────
Gemini Flash 2.5 Flash-Lite    $0.10                   $0.40
grok-4-fast-non-reasoning      $0.20                   $0.50
```

---

## Phase 1: Database Schema Changes

### 1.1 New Tables

#### `token_usage` Table
Tracks every LLM API call with token consumption.

```sql
CREATE TABLE IF NOT EXISTS token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  bot_id TEXT,
  provider_id INTEGER NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('decision', 'summary', 'sandbox')),
  
  -- Token counts
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  
  -- Cost calculation (in cents, for precision)
  input_cost_cents INTEGER NOT NULL,
  output_cost_cents INTEGER NOT NULL,
  total_cost_cents INTEGER NOT NULL,
  
  -- Metadata
  model_name TEXT NOT NULL,
  prompt_length INTEGER,
  response_length INTEGER,
  api_latency_ms INTEGER,
  
  -- Stripe reporting
  stripe_reported BOOLEAN DEFAULT 0,
  stripe_reported_at TIMESTAMP,
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL,
  FOREIGN KEY (provider_id) REFERENCES llm_providers(id)
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_bot ON token_usage(bot_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_stripe ON token_usage(stripe_reported, timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_month ON token_usage(user_id, timestamp);
```

#### `provider_pricing` Table
Admin-configured pricing for each model.

```sql
CREATE TABLE IF NOT EXISTS provider_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  
  -- Pricing (in cents per 1 million tokens for precision)
  input_price_per_million_cents INTEGER NOT NULL,
  output_price_per_million_cents INTEGER NOT NULL,
  
  -- Markup configuration (percentage over cost)
  markup_percentage INTEGER DEFAULT 20 CHECK (markup_percentage >= 0),
  
  -- Metadata
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  effective_until TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pricing_provider ON provider_pricing(provider_id);
CREATE INDEX IF NOT EXISTS idx_pricing_active ON provider_pricing(is_active, effective_from);
```

#### `user_subscriptions` Table
Links users to Stripe customers and subscriptions.

```sql
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  
  -- Stripe identifiers
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  
  -- Subscription status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  
  -- Usage limits (optional)
  monthly_token_limit INTEGER,
  
  -- Trial configuration
  trial_ends_at TIMESTAMP,
  
  -- Metadata
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON user_subscriptions(status);
```

#### `billing_periods` Table
Historical billing records for audit trail.

```sql
CREATE TABLE IF NOT EXISTS billing_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  
  -- Period details
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  -- Usage summary
  total_input_tokens BIGINT NOT NULL,
  total_output_tokens BIGINT NOT NULL,
  total_tokens BIGINT NOT NULL,
  
  -- Cost breakdown (in cents)
  total_cost_cents INTEGER NOT NULL,
  stripe_invoice_id TEXT,
  stripe_invoice_status TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finalized_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_periods(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_billing_stripe ON billing_periods(stripe_invoice_id);
```

### 1.2 Schema Modifications

#### Update `llm_providers` Table
Add fields for admin-only management and visibility.

```sql
-- Migration: Add SaaS-specific columns to llm_providers
ALTER TABLE llm_providers ADD COLUMN is_admin_managed BOOLEAN DEFAULT 1;
ALTER TABLE llm_providers ADD COLUMN is_visible_to_users BOOLEAN DEFAULT 1;
ALTER TABLE llm_providers ADD COLUMN display_name TEXT;
ALTER TABLE llm_providers ADD COLUMN description TEXT;
ALTER TABLE llm_providers ADD COLUMN max_tokens INTEGER DEFAULT 4096;
ALTER TABLE llm_providers ADD COLUMN supports_streaming BOOLEAN DEFAULT 0;

-- Update existing providers to be admin-managed
UPDATE llm_providers SET is_admin_managed = 1, is_visible_to_users = 1;
```

#### Update `users` Table
Add Stripe and billing fields.

```sql
-- Migration: Add billing fields to users
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN billing_email TEXT;
ALTER TABLE users ADD COLUMN usage_alert_threshold INTEGER DEFAULT 1000000; -- Alert at 1M tokens

CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
```

### 1.3 Migration Script

Create `server/migrations/007_saas_billing_schema.sql`:

```sql
-- ============================================================================
-- BONERBOTS SaaS - Billing & Token Usage Schema
-- Migration: 007_saas_billing_schema.sql
-- Description: Adds comprehensive token tracking and Stripe billing integration
-- ============================================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- [Include all CREATE TABLE statements from above]

-- Insert default pricing for common providers (admin can adjust)
INSERT INTO provider_pricing (provider_id, input_price_per_million_cents, output_price_per_million_cents, markup_percentage)
SELECT 
  id,
  -- Default pricing based on provider type (these are examples, update with real costs)
  CASE provider_type
    WHEN 'gemini' THEN 10    -- $0.10 per 1M input tokens = 10 cents
    WHEN 'openai' THEN 1000  -- $10.00 per 1M input tokens = 1000 cents
    WHEN 'anthropic' THEN 1500 -- $15.00 per 1M input tokens
    WHEN 'grok' THEN 500     -- $5.00 per 1M input tokens
    ELSE 100                 -- Default for custom/local
  END,
  CASE provider_type
    WHEN 'gemini' THEN 40    -- $0.40 per 1M output tokens
    WHEN 'openai' THEN 3000  -- $30.00 per 1M output tokens
    WHEN 'anthropic' THEN 7500
    WHEN 'grok' THEN 1500
    ELSE 300
  END,
  20 -- 20% markup by default
FROM llm_providers;

-- Insert audit log for migration
INSERT INTO audit_log (event_type, user_id, details) 
VALUES ('SCHEMA_MIGRATION', 'system', '{"migration": "007_saas_billing_schema", "timestamp": "' || datetime('now') || '"}');
```

---

## Phase 2: Token Usage Tracking

### 2.1 Token Counting Service

Create `server/services/tokenTracker.js`:

```javascript
/**
 * Token Usage Tracking Service
 * 
 * Tracks all LLM API calls with accurate token counting and cost calculation.
 * Reports usage to Stripe for metered billing.
 */

const db = require('../database/relational');

/**
 * Accurate token estimation using tiktoken-like logic
 * This is a simplified version - consider using actual tiktoken library for OpenAI models
 */
function estimateTokens(text, modelName) {
  if (!text) return 0;
  
  // Different models have different tokenization
  // Rough estimates: 1 token ≈ 4 characters for English
  // For more accuracy, use model-specific tokenizers
  const charCount = typeof text === 'string' ? text.length : JSON.stringify(text).length;
  
  // Adjust based on model
  if (modelName.includes('gemini')) {
    return Math.ceil(charCount / 4);
  } else if (modelName.includes('gpt')) {
    return Math.ceil(charCount / 4);
  } else if (modelName.includes('claude')) {
    return Math.ceil(charCount / 4);
  } else {
    return Math.ceil(charCount / 4); // Default
  }
}

/**
 * Extract actual token counts from API response
 * Most LLM APIs return usage statistics
 */
function extractTokensFromResponse(response, providerType) {
  try {
    // OpenAI, Groq, and compatible APIs
    if (response.data?.usage) {
      return {
        inputTokens: response.data.usage.prompt_tokens || 0,
        outputTokens: response.data.usage.completion_tokens || 0,
        totalTokens: response.data.usage.total_tokens || 0
      };
    }
    
    // Anthropic Claude
    if (response.data?.usage) {
      return {
        inputTokens: response.data.usage.input_tokens || 0,
        outputTokens: response.data.usage.output_tokens || 0,
        totalTokens: (response.data.usage.input_tokens || 0) + (response.data.usage.output_tokens || 0)
      };
    }
    
    // Gemini (may not return exact tokens)
    if (providerType === 'gemini' && response.data?.candidates) {
      // Gemini doesn't always return token counts, estimate
      return null; // Will fall back to estimation
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting tokens from response:', error);
    return null;
  }
}

/**
 * Calculate cost based on token usage and provider pricing
 */
function calculateCost(inputTokens, outputTokens, pricing) {
  if (!pricing) {
    console.warn('No pricing configured, cost will be 0');
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }
  
  // Pricing is stored as cents per million tokens
  const inputCostCents = Math.ceil((inputTokens / 1000000) * pricing.input_price_per_million_cents);
  const outputCostCents = Math.ceil((outputTokens / 1000000) * pricing.output_price_per_million_cents);
  
  // Apply markup
  const markup = 1 + (pricing.markup_percentage / 100);
  const finalInputCost = Math.ceil(inputCostCents * markup);
  const finalOutputCost = Math.ceil(outputCostCents * markup);
  
  return {
    inputCost: finalInputCost,
    outputCost: finalOutputCost,
    totalCost: finalInputCost + finalOutputCost
  };
}

/**
 * Track token usage for an LLM API call
 */
async function trackUsage(options) {
  const {
    userId,
    botId,
    providerId,
    requestType, // 'decision', 'summary', 'sandbox'
    prompt,
    response,
    apiResponse, // Full axios response
    providerType,
    modelName,
    apiLatencyMs
  } = options;
  
  try {
    // Try to get actual token counts from API response
    let tokenCounts = extractTokensFromResponse(apiResponse, providerType);
    
    // Fall back to estimation if not available
    if (!tokenCounts) {
      const inputTokens = estimateTokens(prompt, modelName);
      const outputTokens = estimateTokens(response, modelName);
      tokenCounts = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      };
      console.log(`⚠️ Estimated tokens for ${modelName}: ${tokenCounts.totalTokens} (no usage data in response)`);
    }
    
    // Get current pricing for this provider
    const pricing = db.db.prepare(`
      SELECT * FROM provider_pricing
      WHERE provider_id = ?
        AND is_active = 1
        AND effective_from <= datetime('now')
        AND (effective_until IS NULL OR effective_until >= datetime('now'))
      ORDER BY effective_from DESC
      LIMIT 1
    `).get(providerId);
    
    // Calculate cost
    const cost = calculateCost(tokenCounts.inputTokens, tokenCounts.outputTokens, pricing);
    
    // Insert usage record
    const insert = db.db.prepare(`
      INSERT INTO token_usage (
        user_id, bot_id, provider_id, request_type,
        input_tokens, output_tokens, total_tokens,
        input_cost_cents, output_cost_cents, total_cost_cents,
        model_name, prompt_length, response_length, api_latency_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      userId,
      botId,
      providerId,
      requestType,
      tokenCounts.inputTokens,
      tokenCounts.outputTokens,
      tokenCounts.totalTokens,
      cost.inputCost,
      cost.outputCost,
      cost.totalCost,
      modelName,
      prompt?.length || 0,
      response?.length || 0,
      apiLatencyMs
    );
    
    console.log(`✅ Tracked ${tokenCounts.totalTokens} tokens ($${(cost.totalCost / 100).toFixed(4)}) for user ${userId}`);
    
    return {
      usageId: result.lastInsertRowid,
      tokens: tokenCounts,
      cost: cost
    };
    
  } catch (error) {
    console.error('❌ Error tracking token usage:', error);
    // Don't throw - usage tracking should not break the main flow
    return null;
  }
}

/**
 * Get user's usage for current billing period
 */
function getUserUsage(userId, periodStart, periodEnd) {
  const query = db.db.prepare(`
    SELECT 
      COUNT(*) as request_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(total_cost_cents) as total_cost_cents,
      request_type,
      llm_providers.name as provider_name,
      llm_providers.display_name as provider_display_name
    FROM token_usage
    JOIN llm_providers ON token_usage.provider_id = llm_providers.id
    WHERE user_id = ?
      AND timestamp >= ?
      AND timestamp < ?
    GROUP BY request_type, provider_id
    ORDER BY total_cost_cents DESC
  `);
  
  return query.all(userId, periodStart, periodEnd);
}

/**
 * Get total usage summary for a user
 */
function getUserUsageSummary(userId, periodStart, periodEnd) {
  const query = db.db.prepare(`
    SELECT 
      COUNT(*) as total_requests,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(total_cost_cents) as total_cost_cents
    FROM token_usage
    WHERE user_id = ?
      AND timestamp >= ?
      AND timestamp < ?
  `);
  
  return query.get(userId, periodStart, periodEnd);
}

/**
 * Check if user is approaching usage limits/alerts
 */
function checkUsageAlerts(userId) {
  const user = db.db.prepare('SELECT usage_alert_threshold FROM users WHERE id = ?').get(userId);
  
  if (!user || !user.usage_alert_threshold) {
    return null;
  }
  
  // Get current month's usage
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  
  const summary = getUserUsageSummary(userId, periodStart, periodEnd);
  
  if (summary && summary.total_tokens >= user.usage_alert_threshold) {
    return {
      threshold: user.usage_alert_threshold,
      currentUsage: summary.total_tokens,
      percentUsed: (summary.total_tokens / user.usage_alert_threshold) * 100
    };
  }
  
  return null;
}

module.exports = {
  estimateTokens,
  extractTokensFromResponse,
  calculateCost,
  trackUsage,
  getUserUsage,
  getUserUsageSummary,
  checkUsageAlerts
};
```

### 2.2 Integrate Token Tracking into BotManager

Update `server/services/BotManager.js` - modify `callAIProvider` method:

```javascript
// At the top of the file
const tokenTracker = require('./tokenTracker');

// In the callAIProvider method (around line 1623)
async callAIProvider(bot, prompt) {
  const startTime = Date.now();
  
  try {
    // ... existing provider lookup code ...
    
    let response;
    let decisionText;
    
    // Make API call (existing code)
    // ... all the existing API calls ...
    
    // AFTER successful API call, track usage
    const apiLatencyMs = Date.now() - startTime;
    
    await tokenTracker.trackUsage({
      userId: bot.user_id,
      botId: bot.id,
      providerId: bot.provider_id,
      requestType: 'decision',
      prompt: prompt,
      response: decisionText,
      apiResponse: response, // Pass full axios response for token extraction
      providerType: providerType,
      modelName: modelName,
      apiLatencyMs: apiLatencyMs
    });
    
    return { text: decisionText, error: null };
    
  } catch (error) {
    const apiLatencyMs = Date.now() - startTime;
    
    // Still try to track usage even on error (we may have used tokens)
    if (error.response) {
      await tokenTracker.trackUsage({
        userId: bot.user_id,
        botId: bot.id,
        providerId: bot.provider_id,
        requestType: 'decision',
        prompt: prompt,
        response: null,
        apiResponse: error.response,
        providerType: providerType,
        modelName: modelName,
        apiLatencyMs: apiLatencyMs
      });
    }
    
    return { text: null, error: error.message };
  }
}
```

### 2.3 Integrate Token Tracking into History Summarizer

Update `server/services/historySummarizer.js` - modify `summarizeHistory` function:

```javascript
// At the top
const tokenTracker = require('./tokenTracker');

// In summarizeHistory function (around line 126)
async function summarizeHistory(bot, decisions, provider, previousSummaryContext = '') {
  const startTime = Date.now();
  
  try {
    // ... existing code to build summarization prompt ...
    
    let response;
    let summaryText;
    
    // Make API call (existing code for all providers)
    // ... all existing API calls ...
    
    // AFTER successful API call, track usage
    const apiLatencyMs = Date.now() - startTime;
    
    await tokenTracker.trackUsage({
      userId: bot.user_id,
      botId: bot.id,
      providerId: provider.id,
      requestType: 'summary',
      prompt: summarizationPrompt,
      response: summaryText,
      apiResponse: response,
      providerType: providerType,
      modelName: modelName,
      apiLatencyMs: apiLatencyMs
    });
    
    // ... rest of existing code ...
    
  } catch (error) {
    // Track error usage if possible
    const apiLatencyMs = Date.now() - startTime;
    if (error.response) {
      await tokenTracker.trackUsage({
        userId: bot.user_id,
        botId: bot.id,
        providerId: provider.id,
        requestType: 'summary',
        prompt: summarizationPrompt,
        response: null,
        apiResponse: error.response,
        providerType: providerType,
        modelName: modelName,
        apiLatencyMs: apiLatencyMs
      });
    }
    throw error;
  }
}
```

---

## Phase 3: Stripe Integration

### 3.1 Install Stripe SDK

```bash
cd server
pnpm add stripe
```

### 3.2 Stripe Configuration Service

Create `server/services/stripeService.js`:

```javascript
/**
 * Stripe Integration Service
 * 
 * Handles Stripe customer creation, subscription management,
 * and metered billing for token usage.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database/relational');

/**
 * Create Stripe customer for new user
 */
async function createStripeCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.billing_email || user.email,
      name: user.username,
      metadata: {
        user_id: user.id,
        username: user.username
      }
    });
    
    // Save customer ID to database
    db.db.prepare(`
      UPDATE users 
      SET stripe_customer_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(customer.id, user.id);
    
    console.log(`✅ Created Stripe customer ${customer.id} for user ${user.username}`);
    
    return customer;
  } catch (error) {
    console.error('❌ Error creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Create metered billing subscription
 * Uses Stripe's usage-based billing model
 */
async function createSubscription(userId, priceId, trialDays = 0) {
  try {
    const user = db.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Ensure user has Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await createStripeCustomer(user);
      customerId = customer.id;
    }
    
    // Create subscription with metered billing
    const subscriptionParams = {
      customer: customerId,
      items: [{
        price: priceId,
      }],
      metadata: {
        user_id: userId
      },
      billing_cycle_anchor: 'now',
      collection_method: 'charge_automatically'
    };
    
    if (trialDays > 0) {
      subscriptionParams.trial_period_days = trialDays;
    }
    
    const subscription = await stripe.subscriptions.create(subscriptionParams);
    
    // Save subscription to database
    db.db.prepare(`
      INSERT INTO user_subscriptions (
        user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        status, current_period_start, current_period_end, trial_ends_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      customerId,
      subscription.id,
      priceId,
      subscription.status,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
    );
    
    console.log(`✅ Created subscription ${subscription.id} for user ${userId}`);
    
    return subscription;
  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    throw error;
  }
}

/**
 * Report usage to Stripe for metered billing
 * This should be called periodically (e.g., daily or per API call)
 */
async function reportUsageToStripe(userId) {
  try {
    const subscription = db.db.prepare(`
      SELECT * FROM user_subscriptions
      WHERE user_id = ? AND status = 'active'
    `).get(userId);
    
    if (!subscription) {
      console.log(`No active subscription for user ${userId}`);
      return null;
    }
    
    // Get unreported usage
    const unreportedUsage = db.db.prepare(`
      SELECT 
        SUM(total_tokens) as total_tokens,
        COUNT(*) as request_count,
        MIN(timestamp) as oldest_timestamp,
        MAX(timestamp) as newest_timestamp
      FROM token_usage
      WHERE user_id = ? 
        AND stripe_reported = 0
    `).get(userId);
    
    if (!unreportedUsage || unreportedUsage.total_tokens === null || unreportedUsage.total_tokens === 0) {
      console.log(`No unreported usage for user ${userId}`);
      return null;
    }
    
    // Get subscription items (for metered billing)
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    const subscriptionItemId = stripeSubscription.items.data[0].id;
    
    // Report usage to Stripe
    // Stripe expects usage in the unit you defined in your price (e.g., tokens)
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity: unreportedUsage.total_tokens,
        timestamp: Math.floor(Date.now() / 1000), // Unix timestamp
        action: 'increment' // Add to existing usage in this period
      }
    );
    
    // Mark usage as reported
    db.db.prepare(`
      UPDATE token_usage
      SET stripe_reported = 1,
          stripe_reported_at = datetime('now')
      WHERE user_id = ? AND stripe_reported = 0
    `).run(userId);
    
    console.log(`✅ Reported ${unreportedUsage.total_tokens} tokens to Stripe for user ${userId}`);
    
    return usageRecord;
  } catch (error) {
    console.error(`❌ Error reporting usage to Stripe for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Batch report usage for all active users
 * Run this via cron job (e.g., daily)
 */
async function batchReportUsage() {
  const activeSubscriptions = db.db.prepare(`
    SELECT user_id FROM user_subscriptions
    WHERE status = 'active'
  `).all();
  
  console.log(`📊 Batch reporting usage for ${activeSubscriptions.length} users...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const sub of activeSubscriptions) {
    try {
      await reportUsageToStripe(sub.user_id);
      successCount++;
    } catch (error) {
      console.error(`Failed to report usage for user ${sub.user_id}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`✅ Batch report complete: ${successCount} successful, ${errorCount} failed`);
  
  return { successCount, errorCount };
}

/**
 * Cancel subscription
 */
async function cancelSubscription(userId, immediate = false) {
  try {
    const subscription = db.db.prepare(`
      SELECT * FROM user_subscriptions
      WHERE user_id = ?
    `).get(userId);
    
    if (!subscription || !subscription.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }
    
    // Cancel in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: !immediate
      }
    );
    
    if (immediate) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    }
    
    // Update database
    db.db.prepare(`
      UPDATE user_subscriptions
      SET status = ?,
          cancel_at_period_end = ?,
          updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      immediate ? 'canceled' : 'active',
      immediate ? 0 : 1,
      userId
    );
    
    console.log(`✅ ${immediate ? 'Immediately canceled' : 'Scheduled cancellation for'} subscription for user ${userId}`);
    
    return updatedSubscription;
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Webhook handler for Stripe events
 */
async function handleWebhook(event) {
  console.log(`🔔 Stripe webhook: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`❌ Error handling webhook ${event.type}:`, error);
    throw error;
  }
}

async function handleSubscriptionUpdate(subscription) {
  const userId = subscription.metadata.user_id;
  
  if (!userId) {
    console.warn('Subscription update has no user_id in metadata');
    return;
  }
  
  db.db.prepare(`
    UPDATE user_subscriptions
    SET status = ?,
        current_period_start = ?,
        current_period_end = ?,
        cancel_at_period_end = ?,
        updated_at = datetime('now')
    WHERE stripe_subscription_id = ?
  `).run(
    subscription.status,
    new Date(subscription.current_period_start * 1000).toISOString(),
    new Date(subscription.current_period_end * 1000).toISOString(),
    subscription.cancel_at_period_end ? 1 : 0,
    subscription.id
  );
  
  console.log(`✅ Updated subscription ${subscription.id} for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata.user_id;
  
  if (!userId) {
    console.warn('Subscription deletion has no user_id in metadata');
    return;
  }
  
  db.db.prepare(`
    UPDATE user_subscriptions
    SET status = 'canceled',
        updated_at = datetime('now')
    WHERE stripe_subscription_id = ?
  `).run(subscription.id);
  
  // Deactivate user's bots
  db.db.prepare(`
    UPDATE bots
    SET is_active = 0, is_paused = 1
    WHERE user_id = ?
  `).run(userId);
  
  console.log(`✅ Handled subscription deletion for user ${userId}`);
}

async function handleInvoicePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  
  // Create billing period record
  const subscription = db.db.prepare(`
    SELECT user_id FROM user_subscriptions
    WHERE stripe_customer_id = ?
  `).get(customerId);
  
  if (!subscription) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }
  
  // Get usage for this period
  const periodStart = new Date(invoice.period_start * 1000).toISOString();
  const periodEnd = new Date(invoice.period_end * 1000).toISOString();
  
  const usage = db.db.prepare(`
    SELECT 
      SUM(input_tokens) as total_input,
      SUM(output_tokens) as total_output,
      SUM(total_tokens) as total_tokens,
      SUM(total_cost_cents) as total_cost
    FROM token_usage
    WHERE user_id = ?
      AND timestamp >= ?
      AND timestamp < ?
  `).get(subscription.user_id, periodStart, periodEnd);
  
  db.db.prepare(`
    INSERT INTO billing_periods (
      user_id, period_start, period_end,
      total_input_tokens, total_output_tokens, total_tokens,
      total_cost_cents, stripe_invoice_id, stripe_invoice_status,
      finalized_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    subscription.user_id,
    periodStart,
    periodEnd,
    usage?.total_input || 0,
    usage?.total_output || 0,
    usage?.total_tokens || 0,
    usage?.total_cost || 0,
    invoice.id,
    'paid'
  );
  
  console.log(`✅ Recorded billing period for user ${subscription.user_id}`);
}

async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;
  
  const subscription = db.db.prepare(`
    SELECT user_id FROM user_subscriptions
    WHERE stripe_customer_id = ?
  `).get(customerId);
  
  if (!subscription) {
    console.warn(`No subscription found for customer ${customerId}`);
    return;
  }
  
  // Update subscription status
  db.db.prepare(`
    UPDATE user_subscriptions
    SET status = 'past_due',
        updated_at = datetime('now')
    WHERE stripe_customer_id = ?
  `).run(customerId);
  
  // Pause user's bots (don't deactivate, give them a chance to pay)
  db.db.prepare(`
    UPDATE bots
    SET is_paused = 1
    WHERE user_id = ?
  `).run(subscription.user_id);
  
  console.log(`⚠️ Payment failed for user ${subscription.user_id}, bots paused`);
}

module.exports = {
  createStripeCustomer,
  createSubscription,
  reportUsageToStripe,
  batchReportUsage,
  cancelSubscription,
  handleWebhook
};
```

### 3.3 Stripe Webhook Endpoint

Add to `server/server.js`:

```javascript
const stripeService = require('./services/stripeService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Stripe webhook (must be BEFORE express.json() middleware)
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    try {
      await stripeService.handleWebhook(event);
      res.json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);
```

### 3.4 Usage Reporting Cron Job

Create `server/jobs/reportUsageToStripe.js`:

```javascript
/**
 * Cron job to report usage to Stripe
 * Run this daily to keep Stripe updated with current usage
 */

const stripeService = require('../services/stripeService');

async function runUsageReporting() {
  console.log('\n=== Starting daily usage reporting to Stripe ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  try {
    const result = await stripeService.batchReportUsage();
    console.log(`\n✅ Daily usage reporting complete`);
    console.log(`   Successful: ${result.successCount}`);
    console.log(`   Failed: ${result.errorCount}`);
  } catch (error) {
    console.error('❌ Fatal error in usage reporting:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runUsageReporting()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runUsageReporting };
```

Configure cron in PM2 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    // ... main app ...
    {
      name: 'usage-reporter',
      script: 'server/jobs/reportUsageToStripe.js',
      cron_restart: '0 2 * * *', // Run daily at 2 AM
      autorestart: false
    }
  ]
};
```

### 3.5 Environment Variables

Add to `server/.env`:

```bash
# ============================================================================
# STRIPE CONFIGURATION
# ============================================================================
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs (create these in Stripe Dashboard)
STRIPE_METERED_PRICE_ID=price_your_metered_price_id
```

---

## Phase 4: Provider Management Restrictions

### 4.1 Update Provider Routes

Modify `server/routes/providers.js`:

```javascript
// Change POST / to require admin role (currently requires 'user')
router.post('/',
  authenticateToken,
  requireRole('admin'), // CHANGED from 'user' to 'admin'
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  // ... rest of validation ...
  async (req, res) => {
    // ... existing code ...
    
    // IMPORTANT: In SaaS mode, mark all providers as admin-managed
    const providerData = {
      ...req.body,
      is_admin_managed: true,
      is_visible_to_users: req.body.is_visible_to_users !== undefined ? req.body.is_visible_to_users : true
    };
    
    // ... create provider ...
  }
);

// Change PUT /:id to require admin role
router.put('/:id',
  authenticateToken,
  requireRole('admin'), // CHANGED from 'user' to 'admin'
  // ... rest unchanged ...
);

// GET / - filter to only show visible providers for non-admins
router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const user = db.getUser(userId);
      
      let providers;
      
      if (user.role === 'admin') {
        // Admins see all providers
        providers = db.getProviders(req.query);
      } else {
        // Regular users only see visible, active, admin-managed providers
        providers = db.getProviders({
          ...req.query,
          is_admin_managed: true,
          is_visible_to_users: true,
          is_active: true
        });
      }
      
      // Remove sensitive data for non-admins
      if (user.role !== 'admin') {
        providers = providers.map(p => ({
          id: p.id,
          name: p.name,
          display_name: p.display_name || p.name,
          description: p.description,
          provider_type: p.provider_type,
          model_name: p.model_name,
          max_tokens: p.max_tokens,
          is_active: p.is_active
          // DO NOT send api_key_encrypted, api_endpoint, config_json
        }));
      }
      
      res.json(providers);
    } catch (error) {
      console.error('Error fetching providers:', error);
      res.status(500).json({ error: 'Failed to fetch providers' });
    }
  }
);
```

### 4.2 Update Frontend Provider Selection

Update `components/BotConfiguration.tsx`:

```typescript
// Remove "Add Provider" button for non-admins
{isAdmin && (
  <button
    onClick={() => navigate('/config/providers/new')}
    className="btn-secondary"
  >
    + Add Provider
  </button>
)}

// In provider dropdown, show only display_name
<select value={provider_id} onChange={(e) => setProviderId(e.target.value)}>
  <option value="">Select LLM Provider</option>
  {providers.map(provider => (
    <option key={provider.id} value={provider.id}>
      {provider.display_name || provider.name}
      {provider.model_name && ` (${provider.model_name})`}
    </option>
  ))}
</select>
```

---

## Phase 5: Billing Dashboard & User Interface

### 5.1 Usage Dashboard Component

Create `components/billing/UsageDashboard.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

interface UsageSummary {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_cents: number;
}

interface UsageBreakdown {
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_cents: number;
  request_type: string;
  provider_name: string;
  provider_display_name: string;
}

export const UsageDashboard: React.FC = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [breakdown, setBreakdown] = useState<UsageBreakdown[]>([]);
  const [period, setPeriod] = useState<'current' | 'last'>('current');
  
  useEffect(() => {
    fetchUsage();
  }, [period, token]);
  
  const fetchUsage = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/billing/usage`, {
        params: { period },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSummary(response.data.summary);
      setBreakdown(response.data.breakdown);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="animate-spin">Loading...</div>;
  }
  
  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatTokens = (tokens: number) => tokens.toLocaleString();
  
  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriod('current')}
          className={`px-4 py-2 rounded ${period === 'current' ? 'bg-indigo-600' : 'bg-gray-700'}`}
        >
          Current Period
        </button>
        <button
          onClick={() => setPeriod('last')}
          className={`px-4 py-2 rounded ${period === 'last' ? 'bg-indigo-600' : 'bg-gray-700'}`}
        >
          Last Period
        </button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">Total API Calls</div>
          <div className="text-2xl font-bold text-white">{summary?.total_requests || 0}</div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">Input Tokens</div>
          <div className="text-2xl font-bold text-blue-400">
            {formatTokens(summary?.total_input_tokens || 0)}
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">Output Tokens</div>
          <div className="text-2xl font-bold text-green-400">
            {formatTokens(summary?.total_output_tokens || 0)}
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400">Total Cost</div>
          <div className="text-2xl font-bold text-yellow-400">
            {formatCost(summary?.total_cost_cents || 0)}
          </div>
        </div>
      </div>
      
      {/* Usage Breakdown Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Usage Breakdown</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2">Provider</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Requests</th>
              <th className="pb-2 text-right">Input Tokens</th>
              <th className="pb-2 text-right">Output Tokens</th>
              <th className="pb-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {breakdown.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-700">
                <td className="py-3">{item.provider_display_name || item.provider_name}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.request_type === 'decision' ? 'bg-blue-600' :
                    item.request_type === 'summary' ? 'bg-purple-600' :
                    'bg-green-600'
                  }`}>
                    {item.request_type}
                  </span>
                </td>
                <td className="py-3">{item.request_count}</td>
                <td className="py-3 text-right">{formatTokens(item.total_input_tokens)}</td>
                <td className="py-3 text-right">{formatTokens(item.total_output_tokens)}</td>
                <td className="py-3 text-right font-semibold">{formatCost(item.total_cost_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### 5.2 Billing API Routes

Create `server/routes/billing.js`:

```javascript
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getUserUsage, getUserUsageSummary } = require('../services/tokenTracker');
const db = require('../database/relational');

const router = express.Router();

// All billing routes require authentication
router.use(authenticateToken);

/**
 * GET /api/billing/usage - Get user's token usage
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || 'current'; // 'current' or 'last'
    
    // Calculate period dates
    const now = new Date();
    let periodStart, periodEnd;
    
    if (period === 'current') {
      // Current billing period (this month)
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else {
      // Last billing period (last month)
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const summary = getUserUsageSummary(
      userId, 
      periodStart.toISOString(), 
      periodEnd.toISOString()
    );
    
    const breakdown = getUserUsage(
      userId,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
    
    res.json({
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        type: period
      },
      summary: summary || {
        total_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        total_cost_cents: 0
      },
      breakdown: breakdown || []
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

/**
 * GET /api/billing/subscription - Get user's subscription info
 */
router.get('/subscription', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const subscription = db.db.prepare(`
      SELECT * FROM user_subscriptions
      WHERE user_id = ?
    `).get(userId);
    
    if (!subscription) {
      return res.json({ has_subscription: false });
    }
    
    res.json({
      has_subscription: true,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end === 1,
      trial_ends_at: subscription.trial_ends_at
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * GET /api/billing/history - Get billing history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 12; // Last 12 months by default
    
    const history = db.db.prepare(`
      SELECT * FROM billing_periods
      WHERE user_id = ?
      ORDER BY period_start DESC
      LIMIT ?
    `).all(userId, limit);
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

/**
 * POST /api/billing/cancel - Cancel subscription
 */
router.post('/cancel', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { immediate } = req.body;
    
    const stripeService = require('../services/stripeService');
    const result = await stripeService.cancelSubscription(userId, immediate);
    
    res.json({ 
      success: true, 
      message: immediate ? 'Subscription canceled immediately' : 'Subscription will cancel at end of period',
      subscription: result
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

Register in `server/server.js`:

```javascript
const billingRoutes = require('./routes/billing');
app.use('/api/billing', billingRoutes);
```

---

## Phase 6: Admin Controls

### 6.1 Provider Pricing Management

Create `components/admin/ProviderPricingManager.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

interface ProviderPricing {
  id: number;
  provider_id: number;
  provider_name: string;
  input_price_per_million_cents: number;
  output_price_per_million_cents: number;
  markup_percentage: number;
  is_active: boolean;
}

export const ProviderPricingManager: React.FC = () => {
  const { token } = useAuth();
  const [pricings, setPricings] = useState<ProviderPricing[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchPricings();
  }, [token]);
  
  const fetchPricings = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/provider-pricing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPricings(response.data);
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const updatePricing = async (id: number, updates: Partial<ProviderPricing>) => {
    try {
      await axios.put(
        `${API_BASE_URL}/api/admin/provider-pricing/${id}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPricings();
    } catch (error) {
      console.error('Failed to update pricing:', error);
    }
  };
  
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(4)}`;
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Provider Pricing Configuration</h2>
      
      <table className="w-full">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-700">
            <th className="pb-3">Provider</th>
            <th className="pb-3">Input (per 1M tokens)</th>
            <th className="pb-3">Output (per 1M tokens)</th>
            <th className="pb-3">Markup %</th>
            <th className="pb-3">Active</th>
            <th className="pb-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pricings.map(pricing => (
            <PricingRow
              key={pricing.id}
              pricing={pricing}
              onUpdate={updatePricing}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PricingRow: React.FC<{
  pricing: ProviderPricing;
  onUpdate: (id: number, updates: Partial<ProviderPricing>) => void;
}> = ({ pricing, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [inputPrice, setInputPrice] = useState(pricing.input_price_per_million_cents);
  const [outputPrice, setOutputPrice] = useState(pricing.output_price_per_million_cents);
  const [markup, setMarkup] = useState(pricing.markup_percentage);
  
  const handleSave = () => {
    onUpdate(pricing.id, {
      input_price_per_million_cents: inputPrice,
      output_price_per_million_cents: outputPrice,
      markup_percentage: markup
    });
    setEditing(false);
  };
  
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(4)}`;
  
  return (
    <tr className="border-b border-gray-700 text-white">
      <td className="py-3">{pricing.provider_name}</td>
      <td className="py-3">
        {editing ? (
          <input
            type="number"
            value={inputPrice}
            onChange={(e) => setInputPrice(parseInt(e.target.value))}
            className="w-24 bg-gray-700 px-2 py-1 rounded"
          />
        ) : (
          formatPrice(pricing.input_price_per_million_cents)
        )}
      </td>
      <td className="py-3">
        {editing ? (
          <input
            type="number"
            value={outputPrice}
            onChange={(e) => setOutputPrice(parseInt(e.target.value))}
            className="w-24 bg-gray-700 px-2 py-1 rounded"
          />
        ) : (
          formatPrice(pricing.output_price_per_million_cents)
        )}
      </td>
      <td className="py-3">
        {editing ? (
          <input
            type="number"
            value={markup}
            onChange={(e) => setMarkup(parseInt(e.target.value))}
            className="w-16 bg-gray-700 px-2 py-1 rounded"
          />
        ) : (
          `${pricing.markup_percentage}%`
        )}
      </td>
      <td className="py-3">
        <span className={`px-2 py-1 rounded text-xs ${pricing.is_active ? 'bg-green-600' : 'bg-red-600'}`}>
          {pricing.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="py-3">
        {editing ? (
          <div className="flex gap-2">
            <button onClick={handleSave} className="text-green-400 hover:text-green-300">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-300">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-indigo-400 hover:text-indigo-300">
            Edit
          </button>
        )}
      </td>
    </tr>
  );
};
```

### 6.2 Admin Pricing API Routes

Add to `server/routes/admin.js`:

```javascript
/**
 * GET /api/admin/provider-pricing - Get all provider pricing configurations
 */
router.get('/provider-pricing',
  authenticateToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const pricings = db.db.prepare(`
        SELECT 
          pp.*,
          lp.name as provider_name,
          lp.display_name as provider_display_name
        FROM provider_pricing pp
        JOIN llm_providers lp ON pp.provider_id = lp.id
        ORDER BY lp.name
      `).all();
      
      res.json(pricings);
    } catch (error) {
      console.error('Error fetching provider pricing:', error);
      res.status(500).json({ error: 'Failed to fetch pricing' });
    }
  }
);

/**
 * PUT /api/admin/provider-pricing/:id - Update provider pricing
 */
router.put('/provider-pricing/:id',
  authenticateToken,
  requireRole('admin'),
  param('id').isInt(),
  body('input_price_per_million_cents').optional().isInt({ min: 0 }),
  body('output_price_per_million_cents').optional().isInt({ min: 0 }),
  body('markup_percentage').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Build update query
      const fields = [];
      const values = [];
      
      if (updates.input_price_per_million_cents !== undefined) {
        fields.push('input_price_per_million_cents = ?');
        values.push(updates.input_price_per_million_cents);
      }
      if (updates.output_price_per_million_cents !== undefined) {
        fields.push('output_price_per_million_cents = ?');
        values.push(updates.output_price_per_million_cents);
      }
      if (updates.markup_percentage !== undefined) {
        fields.push('markup_percentage = ?');
        values.push(updates.markup_percentage);
      }
      if (updates.is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(updates.is_active ? 1 : 0);
      }
      
      fields.push('updated_at = datetime(\'now\')');
      values.push(id);
      
      db.db.prepare(`
        UPDATE provider_pricing
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating pricing:', error);
      res.status(500).json({ error: 'Failed to update pricing' });
    }
  }
);

/**
 * GET /api/admin/usage-stats - Get platform-wide usage statistics
 */
router.get('/usage-stats',
  authenticateToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const period = req.query.period || 'month'; // 'day', 'week', 'month', 'all'
      
      // Calculate date range
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0); // All time
      }
      
      const stats = db.db.prepare(`
        SELECT 
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) as total_requests,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost_cents) as total_revenue_cents,
          AVG(api_latency_ms) as avg_latency_ms
        FROM token_usage
        WHERE timestamp >= ?
      `).get(startDate.toISOString());
      
      const providerBreakdown = db.db.prepare(`
        SELECT 
          lp.name as provider_name,
          lp.display_name as provider_display_name,
          COUNT(*) as request_count,
          SUM(tu.total_tokens) as total_tokens,
          SUM(tu.total_cost_cents) as revenue_cents
        FROM token_usage tu
        JOIN llm_providers lp ON tu.provider_id = lp.id
        WHERE tu.timestamp >= ?
        GROUP BY tu.provider_id
        ORDER BY revenue_cents DESC
      `).all(startDate.toISOString());
      
      res.json({
        period: period,
        summary: stats,
        by_provider: providerBreakdown
      });
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }
);
```

---

## Phase 7: Testing & Deployment

### 7.1 Testing Checklist

#### Database Migration Testing
- [ ] Run migration on clean database
- [ ] Run migration on existing production database (backup first!)
- [ ] Verify all tables created correctly
- [ ] Verify indexes created
- [ ] Verify default pricing inserted

#### Token Tracking Testing
- [ ] Test token counting with each provider (OpenAI, Gemini, Claude, Grok)
- [ ] Verify actual token counts vs estimates
- [ ] Test tracking for bot decisions
- [ ] Test tracking for history summarization
- [ ] Test tracking for sandbox analysis
- [ ] Verify cost calculations are accurate
- [ ] Test with API errors (ensure tracking still works)

#### Stripe Integration Testing
- [ ] Test customer creation
- [ ] Test subscription creation (with trial)
- [ ] Test usage reporting to Stripe
- [ ] Test webhook handling (use Stripe CLI for local testing)
- [ ] Test subscription cancellation (immediate and end-of-period)
- [ ] Test payment failure handling
- [ ] Test invoice generation

#### Provider Management Testing
- [ ] Verify non-admins cannot create providers
- [ ] Verify non-admins only see visible providers
- [ ] Verify API keys are hidden from non-admins
- [ ] Verify admins can manage all provider settings

#### User Interface Testing
- [ ] Test usage dashboard displays correct data
- [ ] Test billing history displays correctly
- [ ] Test provider pricing manager (admin only)
- [ ] Test subscription status display
- [ ] Test cancellation flow

### 7.2 Deployment Steps

#### 1. Fork Repository
```bash
git clone https://github.com/yourcompany/bonerbots.git bonerbots-saas
cd bonerbots-saas
git remote rename origin upstream
git remote add origin https://github.com/yourcompany/bonerbots-saas.git
```

#### 2. Apply All Changes
- Implement all code changes from this plan
- Run all migrations
- Update environment variables

#### 3. Stripe Setup

**In Stripe Dashboard:**
1. Create product: "BONERBOTS Token Usage"
2. Create price: Metered billing, per unit pricing
3. Set up webhooks pointing to your domain `/api/webhooks/stripe`
4. Get webhook secret
5. Copy API keys

**Configure in `.env`:**
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_METERED_PRICE_ID=price_...
```

#### 4. Deploy to Production

Follow existing deployment guide but with additional Stripe webhook configuration.

**For Railway:**
```bash
railway up
railway env set STRIPE_SECRET_KEY=sk_live_...
railway env set STRIPE_WEBHOOK_SECRET=whsec_...
```

**Configure Stripe webhook URL:**
`https://your-domain.railway.app/api/webhooks/stripe`

#### 5. Test in Production
- Create test user
- Add test provider (admin)
- Create test bot
- Force trading turn
- Verify usage tracking
- Check Stripe dashboard for reported usage

### 7.3 Monitoring

#### Key Metrics to Monitor
- Token usage per user
- API call success/failure rates
- Cost per user
- Stripe webhook failures
- Payment failures
- Subscription churn

#### Logging
Add comprehensive logging for:
- Token tracking failures
- Stripe API errors
- Webhook processing
- Usage reporting job

#### Alerts
Set up alerts for:
- High token usage (potential abuse)
- Payment failures
- Webhook failures
- Cost anomalies

---

## Cost Estimation Examples

### Example 1: Light User
- 2 bots running
- 10 trading decisions per day
- 1 history summarization per week
- Uses Gemini Flash 2.0

**Monthly Usage:**
- Trading decisions: 600/month
- History summarizations: 4/month
- Avg tokens per decision: 5,000 (4k input, 1k output)
- Avg tokens per summary: 50,000 (40k input, 10k output)

**Cost Calculation:**
```
Decisions: 600 × 4k input tokens = 2.4M input tokens
           600 × 1k output tokens = 0.6M output tokens

Summaries: 4 × 40k = 160k input tokens
           4 × 10k = 40k output tokens

Total: 2.56M input, 0.64M output

Input cost: 2.56 × $0.10 = $0.256
Output cost: 0.64 × $0.40 = $0.256

Base cost: $0.512
With 20% markup: $0.61/month
```

### Example 2: Power User
- 5 bots running
- 50 trading decisions per day per bot
- 2 history summarizations per week per bot
- Uses GPT-4 Turbo and Claude Opus

**Monthly Usage:**
- Trading decisions: 7,500/month
- History summarizations: 40/month
- Avg tokens per decision: 8,000 (6k input, 2k output)
- Avg tokens per summary: 80,000 (60k input, 20k output)

**Cost Calculation:**
```
GPT-4 Turbo (50% of usage):
Input: (3750 × 6k + 20 × 60k) / 1M × $10 = $237
Output: (3750 × 2k + 20 × 20k) / 1M × $30 = $237

Claude Opus (50% of usage):
Input: (3750 × 6k + 20 × 60k) / 1M × $15 = $355.50
Output: (3750 × 2k + 20 × 20k) / 1M × $75 = $592.50

Base cost: $1,422
With 20% markup: $1,706.40/month
```

---

## Environment Variables Summary

Add to `server/.env`:

```bash
# ============================================================================
# STRIPE CONFIGURATION
# ============================================================================
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_METERED_PRICE_ID=price_your_metered_price_id_here

# Optional: Trial period in days for new users
STRIPE_TRIAL_DAYS=14
```

---

## Implementation Order

1. **Week 1: Database & Core Tracking**
   - Implement database schema changes (Phase 1)
   - Implement token tracking service (Phase 2.1)
   - Integrate tracking into BotManager and historySummarizer (Phase 2.2-2.3)
   - Test token counting accuracy

2. **Week 2: Stripe Integration**
   - Implement Stripe service (Phase 3.2)
   - Add webhook endpoint (Phase 3.3)
   - Add usage reporting job (Phase 3.4)
   - Test with Stripe test mode

3. **Week 3: Provider Restrictions & UI**
   - Update provider routes (Phase 4)
   - Build usage dashboard (Phase 5.1)
   - Build billing API routes (Phase 5.2)
   - Test user experience flow

4. **Week 4: Admin Tools & Testing**
   - Build admin pricing manager (Phase 6)
   - Comprehensive testing (Phase 7.1)
   - Deploy to staging
   - Production deployment (Phase 7.2)

---

## Success Criteria

- ✅ All LLM API calls tracked with accurate token counts
- ✅ Cost calculations match actual provider costs
- ✅ Stripe receives usage data correctly
- ✅ Users billed accurately based on usage
- ✅ Non-admins cannot add/edit providers
- ✅ Admin can configure pricing with markup
- ✅ Usage dashboard shows real-time data
- ✅ Webhook handling is robust and reliable
- ✅ No data loss during migration
- ✅ Performance impact of tracking is minimal (<50ms per request)

---

## Additional Considerations

### Security
- API keys stored encrypted in database
- Webhook signature verification
- Rate limiting on billing endpoints
- Audit logging for pricing changes

### Performance
- Index token_usage table properly
- Batch usage reporting (don't report per API call)
- Cache pricing configurations
- Consider archiving old usage data (>1 year)

### Compliance
- GDPR: User data export/deletion
- PCI: Stripe handles payment data (we don't store credit cards)
- Terms of Service: Update for usage-based billing
- Privacy Policy: Disclose usage tracking

### Support
- Usage alerts when approaching limits
- Email notifications for payment failures
- Admin tools to investigate billing issues
- User-friendly error messages for payment problems

---

**End of Implementation Plan**

This plan provides a complete roadmap for transforming BONERBOTS into a SaaS platform with comprehensive token tracking and usage-based billing through Stripe. Each phase is designed to be implemented incrementally with thorough testing at each step.

