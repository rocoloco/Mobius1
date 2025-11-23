/**
 * Mobius 1 Platform API Client SDK
 * TypeScript client for interacting with the Mobius 1 API
 */

import type { WebhookEventType } from '../webhooks/types.js';

export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  workspaceId?: string;
  timeout?: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  correlationId?: string;
}

export class Mobius1Client {
  private baseUrl: string;
  private apiKey?: string;
  private workspaceId?: string;
  private timeout: number;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.workspaceId = config.workspaceId;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.apiKey) {
      requestHeaders['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (this.workspaceId) {
      requestHeaders['X-Workspace-Id'] = this.workspaceId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: 'E500',
            message: 'Request failed',
          },
          timestamp: data.timestamp || new Date().toISOString(),
          correlationId: data.correlationId,
        };
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(
        `API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Document Processing API
   */
  documents = {
    upload: async (file: File | Buffer, metadata?: any) => {
      // In a real implementation, this would handle multipart/form-data
      return this.request('POST', '/api/v1/documents', {
        file: file instanceof Buffer ? file.toString('base64') : null,
        metadata,
      });
    },

    classify: async (documentId: string) => {
      return this.request('POST', `/api/v1/documents/${documentId}/classify`);
    },

    extract: async (documentId: string) => {
      return this.request('POST', `/api/v1/documents/${documentId}/extract`);
    },

    get: async (documentId: string) => {
      return this.request('GET', `/api/v1/documents/${documentId}`);
    },

    list: async (params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.request('GET', `/api/v1/documents${query ? `?${query}` : ''}`);
    },
  };

  /**
   * Template & Workflow API
   */
  templates = {
    list: async () => {
      return this.request('GET', '/api/v1/templates');
    },

    get: async (templateId: string) => {
      return this.request('GET', `/api/v1/templates/${templateId}`);
    },

    validate: async (template: any) => {
      return this.request('POST', '/api/v1/templates/validate', template);
    },
  };

  workflows = {
    execute: async (templateId: string, data: any) => {
      return this.request('POST', `/api/v1/workflows/execute`, {
        templateId,
        data,
      });
    },

    getStatus: async (executionId: string) => {
      return this.request('GET', `/api/v1/workflows/${executionId}`);
    },
  };

  /**
   * Compliance API
   */
  compliance = {
    generateReport: async (params: {
      startDate: string;
      endDate: string;
      format?: 'json' | 'pdf';
    }) => {
      return this.request('POST', '/api/v1/compliance/reports', params);
    },

    getReport: async (reportId: string) => {
      return this.request('GET', `/api/v1/compliance/reports/${reportId}`);
    },

    exportAudit: async (params: { startDate: string; endDate: string }) => {
      return this.request('POST', '/api/v1/compliance/audit-export', params);
    },
  };

  /**
   * Webhook API
   */
  webhooks = {
    register: async (params: {
      url: string;
      events: WebhookEventType[];
      secret?: string;
    }) => {
      return this.request('POST', '/api/v1/webhooks', params);
    },

    list: async () => {
      return this.request('GET', '/api/v1/webhooks');
    },

    delete: async (webhookId: string) => {
      return this.request('DELETE', `/api/v1/webhooks/${webhookId}`);
    },

    test: async (webhookId: string) => {
      return this.request('POST', `/api/v1/webhooks/${webhookId}/test`);
    },
  };

  /**
   * Health & Status API
   */
  health = {
    check: async () => {
      return this.request('GET', '/health');
    },

    ready: async () => {
      return this.request('GET', '/ready');
    },

    info: async () => {
      return this.request('GET', '/info');
    },
  };
}
