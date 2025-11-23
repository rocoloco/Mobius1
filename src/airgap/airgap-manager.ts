/**
 * Air-Gap Manager for Mobius 1 Platform
 * Orchestrates air-gapped deployment mode
 * 
 * Features:
 * - Enable/disable air-gapped mode
 * - Coordinate network isolation, updates, and integrity checks
 * - Monitor air-gap status
 * - Enforce air-gap policies
 */

import { networkIsolator } from './network-isolator.js';
import { offlineUpdater } from './offline-updater.js';
import { integrityVerifier } from './integrity-verifier.js';
import { auditLogger } from '../audit/logger.js';

export interface AirGapStatus {
  enabled: boolean;
  networkIsolated: boolean;
  integrityVerified: boolean;
  lastIntegrityCheck: Date | null;
  currentVersion: string;
  blockedAttempts: number;
}

export interface AirGapConfig {
  enableNetworkIsolation: boolean;
  enableIntegrityChecks: boolean;
  integrityCheckInterval: number; // milliseconds
  allowedHosts: string[];
  allowedPorts: number[];
}

/**
 * Air-Gap Manager
 * Central orchestrator for air-gapped deployment mode
 */
export class AirGapManager {
  private enabled = false;
  private config: AirGapConfig;
  private integrityCheckTimer: NodeJS.Timeout | null = null;
  private lastIntegrityCheck: Date | null = null;
  private integrityVerified = false;

  constructor(config?: AirGapConfig) {
    this.config = config || this.getDefaultConfig();
  }

  /**
   * Initialize air-gap manager
   */
  async initialize(enableAirGap = false): Promise<void> {
    this.enabled = enableAirGap;

    if (this.enabled) {
      await this.enableAirGapMode();
    }

    await auditLogger.log({
      eventType: 'airgap.manager.initialized',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'airgap',
      resourceId: 'manager',
      action: 'initialize',
      outcome: 'success',
      metadata: { enabled: this.enabled },
    });
  }

  /**
   * Enable air-gapped mode
   */
  async enableAirGapMode(): Promise<void> {
    this.enabled = true;

    // Initialize network isolation
    if (this.config.enableNetworkIsolation) {
      await networkIsolator.initialize(true);
      await networkIsolator.updatePolicy({
        allowedHosts: this.config.allowedHosts,
        allowedPorts: this.config.allowedPorts,
        blockExternal: true,
        dnsBlocking: true,
      });
    }

    // Initialize offline updater
    await offlineUpdater.initialize();

    // Initialize integrity verifier
    if (this.config.enableIntegrityChecks) {
      await integrityVerifier.initialize();

      // Run initial integrity check
      await this.runIntegrityCheck();

      // Schedule periodic checks
      this.scheduleIntegrityChecks();
    }

    await auditLogger.log({
      eventType: 'airgap.mode.enabled',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'airgap',
      resourceId: 'mode',
      action: 'enable',
      outcome: 'success',
      metadata: { config: this.config },
    });
  }

  /**
   * Disable air-gapped mode
   */
  async disableAirGapMode(): Promise<void> {
    this.enabled = false;

    // Stop integrity checks
    if (this.integrityCheckTimer) {
      clearInterval(this.integrityCheckTimer);
      this.integrityCheckTimer = null;
    }

    await auditLogger.log({
      eventType: 'airgap.mode.disabled',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'airgap',
      resourceId: 'mode',
      action: 'disable',
      outcome: 'success',
      metadata: {},
    });
  }

  /**
   * Get air-gap status
   */
  async getStatus(): Promise<AirGapStatus> {
    const blockedAttempts = networkIsolator.getBlockedAttempts().length;

    return {
      enabled: this.enabled,
      networkIsolated: networkIsolator.isInAirGappedMode(),
      integrityVerified: this.integrityVerified,
      lastIntegrityCheck: this.lastIntegrityCheck,
      currentVersion: offlineUpdater.getCurrentVersion(),
      blockedAttempts,
    };
  }

  /**
   * Validate network connection
   */
  async validateConnection(host: string, port: number): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    return networkIsolator.isConnectionAllowed(host, port);
  }

  /**
   * Validate URL
   */
  async validateUrl(url: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.enabled) {
      return { allowed: true };
    }

    return networkIsolator.validateUrl(url);
  }

  /**
   * Apply offline update
   */
  async applyUpdate(packagePath: string): Promise<{
    success: boolean;
    version: string;
    errors: string[];
  }> {
    if (!this.enabled) {
      return {
        success: false,
        version: '',
        errors: ['Air-gapped mode not enabled'],
      };
    }

    // Validate package
    const validation = await offlineUpdater.validatePackage(packagePath);
    if (!validation.valid) {
      return {
        success: false,
        version: '',
        errors: validation.errors,
      };
    }

    // Apply update
    const result = await offlineUpdater.applyUpdate(packagePath);

    // Run integrity check after update
    if (result.success) {
      await this.runIntegrityCheck();
    }

    return result;
  }

  /**
   * Rollback update
   */
  async rollbackUpdate(): Promise<{ success: boolean; error?: string }> {
    const result = await offlineUpdater.rollback();

    if (result.success) {
      await this.runIntegrityCheck();
    }

    return result;
  }

  /**
   * Run integrity check
   */
  async runIntegrityCheck(): Promise<{
    valid: boolean;
    filesChecked: number;
    issues: string[];
  }> {
    if (!integrityVerifier.hasManifest()) {
      return {
        valid: false,
        filesChecked: 0,
        issues: ['No integrity manifest available'],
      };
    }

    const result = await integrityVerifier.verifyIntegrity();

    this.lastIntegrityCheck = new Date();
    this.integrityVerified = result.valid;

    const issues = [
      ...result.filesModified.map((f) => `Modified: ${f}`),
      ...result.filesMissing.map((f) => `Missing: ${f}`),
      ...result.filesAdded.map((f) => `Added: ${f}`),
      ...result.errors,
    ];

    return {
      valid: result.valid,
      filesChecked: result.filesChecked,
      issues,
    };
  }

  /**
   * Get blocked network attempts
   */
  getBlockedAttempts(limit = 100): Array<{
    timestamp: Date;
    host: string;
    port: number;
    reason?: string;
  }> {
    return networkIsolator.getBlockedAttempts(limit);
  }

  /**
   * Update air-gap configuration
   */
  async updateConfig(config: Partial<AirGapConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    if (this.enabled && this.config.enableNetworkIsolation) {
      await networkIsolator.updatePolicy({
        allowedHosts: this.config.allowedHosts,
        allowedPorts: this.config.allowedPorts,
      });
    }

    await auditLogger.log({
      eventType: 'airgap.config.updated',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'airgap',
      resourceId: 'config',
      action: 'update',
      outcome: 'success',
      metadata: { config: this.config },
    });
  }

  /**
   * Check if air-gapped mode is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Schedule periodic integrity checks
   */
  private scheduleIntegrityChecks(): void {
    if (this.integrityCheckTimer) {
      clearInterval(this.integrityCheckTimer);
    }

    this.integrityCheckTimer = setInterval(
      () => this.runIntegrityCheck(),
      this.config.integrityCheckInterval
    );
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AirGapConfig {
    return {
      enableNetworkIsolation: true,
      enableIntegrityChecks: true,
      integrityCheckInterval: 3600000, // 1 hour
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '::1',
        '*.local',
        '10.*',
        '172.16.*',
        '192.168.*',
      ],
      allowedPorts: [5432, 6379, 9000, 6333, 3000],
    };
  }

  /**
   * Shutdown air-gap manager
   */
  async shutdown(): Promise<void> {
    if (this.integrityCheckTimer) {
      clearInterval(this.integrityCheckTimer);
      this.integrityCheckTimer = null;
    }

    await auditLogger.log({
      eventType: 'airgap.manager.shutdown',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'airgap',
      resourceId: 'manager',
      action: 'shutdown',
      outcome: 'success',
      metadata: {},
    });
  }
}

/**
 * Singleton instance
 */
export const airGapManager = new AirGapManager();
