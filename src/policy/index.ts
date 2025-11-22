/**
 * Policy Engine Module Exports
 * Central export point for all policy functionality
 */

// Core policy engine
export {
  PolicyEngine,
  policyEngine,
  DEFAULT_POLICY_ENGINE_CONFIG,
  type PolicyEngineConfig,
  type PolicyEngineRequest,
} from './engine.js';

// Residency validation
export {
  ResidencyValidator,
  residencyValidator,
  DEFAULT_RESIDENCY_CONFIG,
} from './residencyValidator.js';

// PII detection and redaction
export {
  PIIDetector,
  piiDetector,
  DEFAULT_REDACTION_CONFIG,
  type PIIDetectionResult,
} from './piiDetector.js';

// Policy evaluation
export {
  PolicyEvaluator,
  policyEvaluator,
} from './evaluator.js';

// Types
export * from './types.js';