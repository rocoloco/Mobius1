/**
 * Template Layer - Workflow Template Management System
 * 
 * Provides YAML-based template system for Spanish administrative processes
 * with validation, schema enforcement, and workflow execution capabilities.
 * 
 * Requirements: FR-006, FR-010
 */

export { TemplateManager } from './templateManager.js';
export { WorkflowEngine } from './workflowEngine.js';
export { TemplateValidator } from './templateValidator.js';
export { FormGenerator } from './formGenerator.js';
export { WorkflowProcessor } from './workflowProcessor.js';
export * from './types.js';