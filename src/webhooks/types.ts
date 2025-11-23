/**
 * Webhook System Types
 * Defines types for webhook delivery and management
 */

export enum WebhookEventType {
  DOCUMENT_PROCESSED = 'document.processed',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  COMPLIANCE_REPORT_GENERATED = 'compliance.report_generated',
  BUDGET_THRESHOLD_REACHED = 'budget.threshold_reached',
  POLICY_VIOLATION = 'policy.violation',
}

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  workspaceId: string;
  timestamp: string;
  data: any;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastError?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  maxPayloadSize: number;
}
