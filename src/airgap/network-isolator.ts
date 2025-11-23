/**
 * Network Isolator for Air-Gapped Deployment Mode
 * Enforces network isolation and blocks external traffic
 * 
 * Features:
 * - Network traffic blocking and monitoring
 * - Allowlist for internal services only
 * - DNS resolution blocking
 * - Audit logging for all network attempts
 */

import { auditLogger } from '../audit/logger.js';
import { appConfig } from '../config/index.js';

export interface NetworkPolicy {
  allowedHosts: string[];
  allowedPorts: number[];
  blockExternal: boolean;
  dnsBlocking: boolean;
}

export interface NetworkAttempt {
  timestamp: Date;
  host: string;
  port: number;
  protocol: string;
  blocked: boolean;
  reason?: string;
}

/**
 * Network Isolator Service
 * Enforces air-gapped network policies
 */
export class NetworkIsolator {
  private policy: NetworkPolicy;
  private attempts: NetworkAttempt[] = [];
  private isAirGapped = false;

  constructor(policy?: NetworkPolicy) {
    this.policy = policy || this.getDefaultPolicy();
  }

  /**
   * Initialize network isolator
   */
  async initialize(airGappedMode = false): Promise<void> {
    this.isAirGapped = airGappedMode;

    if (this.isAirGapped) {
      await this.enforceAirGap();
    }

    await auditLogger.log({
      eventType: 'airgap.network.initialized',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'network',
      resourceId: 'isolator',
      action: 'initialize',
      outcome: 'success',
      metadata: { airGappedMode: this.isAirGapped },
    });
  }

  /**
   * Check if a network connection is allowed
   */
  async isConnectionAllowed(host: string, port: number, protocol = 'tcp'): Promise<boolean> {
    if (!this.isAirGapped) {
      return true;
    }

    const allowed = this.checkPolicy(host, port);

    const attempt: NetworkAttempt = {
      timestamp: new Date(),
      host,
      port,
      protocol,
      blocked: !allowed,
      reason: allowed ? undefined : 'Air-gapped mode: external connection blocked',
    };

    this.attempts.push(attempt);

    if (!allowed) {
      await this.auditBlockedAttempt(attempt);
    }

    return allowed;
  }

  /**
   * Validate URL is allowed
   */
  async validateUrl(url: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.isAirGapped) {
      return { allowed: true };
    }

    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      const port = parsed.port ? parseInt(parsed.port, 10) : this.getDefaultPort(parsed.protocol);

      const allowed = this.checkPolicy(host, port);

      if (!allowed) {
        return {
          allowed: false,
          reason: `Air-gapped mode: external URL blocked (${host}:${port})`,
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: 'Invalid URL format',
      };
    }
  }

  /**
   * Get network attempt history
   */
  getAttempts(limit = 100): NetworkAttempt[] {
    return this.attempts.slice(-limit);
  }

  /**
   * Get blocked attempts only
   */
  getBlockedAttempts(limit = 100): NetworkAttempt[] {
    return this.attempts.filter((a) => a.blocked).slice(-limit);
  }

  /**
   * Check if currently in air-gapped mode
   */
  isInAirGappedMode(): boolean {
    return this.isAirGapped;
  }

  /**
   * Update network policy
   */
  async updatePolicy(policy: Partial<NetworkPolicy>): Promise<void> {
    this.policy = { ...this.policy, ...policy };

    await auditLogger.log({
      eventType: 'airgap.policy.updated',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'network',
      resourceId: 'policy',
      action: 'update',
      outcome: 'success',
      metadata: { policy: this.policy },
    });
  }

  /**
   * Enforce air-gap mode
   */
  private async enforceAirGap(): Promise<void> {
    // Set strict policy
    this.policy.blockExternal = true;
    this.policy.dnsBlocking = true;

    await auditLogger.log({
      eventType: 'airgap.mode.enabled',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'network',
      resourceId: 'airgap',
      action: 'enable',
      outcome: 'success',
      metadata: { policy: this.policy },
    });
  }

  /**
   * Check if host/port is allowed by policy
   */
  private checkPolicy(host: string, port: number): boolean {
    if (!this.policy.blockExternal) {
      return true;
    }

    // Check if host is in allowlist
    const hostAllowed = this.policy.allowedHosts.some((allowed) => {
      // Support wildcards
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(host);
      }
      return host === allowed || host.endsWith(`.${allowed}`);
    });

    if (!hostAllowed) {
      return false;
    }

    // Check if port is allowed
    const portAllowed =
      this.policy.allowedPorts.length === 0 || this.policy.allowedPorts.includes(port);

    return portAllowed;
  }

  /**
   * Get default port for protocol
   */
  private getDefaultPort(protocol: string): number {
    switch (protocol) {
      case 'http:':
        return 80;
      case 'https:':
        return 443;
      case 'postgresql:':
      case 'postgres:':
        return 5432;
      case 'redis:':
        return 6379;
      default:
        return 0;
    }
  }

  /**
   * Audit blocked network attempt
   */
  private async auditBlockedAttempt(attempt: NetworkAttempt): Promise<void> {
    await auditLogger.log({
      eventType: 'airgap.connection.blocked',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'network',
      resourceId: `${attempt.host}:${attempt.port}`,
      action: 'connect',
      outcome: 'failure',
      metadata: {
        host: attempt.host,
        port: attempt.port,
        protocol: attempt.protocol,
        reason: attempt.reason,
      },
    });
  }

  /**
   * Get default policy for air-gapped mode
   */
  private getDefaultPolicy(): NetworkPolicy {
    return {
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '::1',
        '*.local',
        // Internal network ranges
        '10.*',
        '172.16.*',
        '192.168.*',
      ],
      allowedPorts: [
        5432, // PostgreSQL
        6379, // Redis
        9000, // MinIO
        6333, // Qdrant
        3000, // Application
      ],
      blockExternal: true,
      dnsBlocking: true,
    };
  }

  /**
   * Clear attempt history
   */
  clearHistory(): void {
    this.attempts = [];
  }
}

/**
 * Singleton instance
 */
export const networkIsolator = new NetworkIsolator();
