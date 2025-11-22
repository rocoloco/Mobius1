/**
 * Gateway Security Module Exports
 * Central export point for all security functionality
 */

// Prompt sanitization
export {
  PromptSanitizer,
  promptSanitizer,
  SanitizationConfigSchema,
  DEFAULT_SANITIZATION_CONFIG,
  type SanitizationConfig,
  type SanitizationResult,
  type RemovalStats,
} from './promptSanitizer.js';

// Tool validation
export {
  ToolValidator,
  toolValidator,
  AllowedTool,
  type ToolValidationResult,
  type ToolExecutionRequest,
} from './toolValidator.js';