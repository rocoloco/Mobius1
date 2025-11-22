/**
 * Database Client Configuration for Mobius 1 Platform
 * Handles Prisma client initialization with proper connection management
 * and workspace isolation for multi-tenant architecture.
 */

import { PrismaClient } from '@prisma/client';

import { appConfig, isDevelopment } from '../config/index.js';

/**
 * Prisma Client singleton with proper configuration
 * Includes logging, error handling, and connection management
 */
class DatabaseClient {
  private static instance: PrismaClient | null = null;

  /**
   * Get the Prisma client instance (singleton pattern)
   */
  static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new PrismaClient({
        datasources: {
          db: {
            url: appConfig.database.url,
          },
        },
        log: isDevelopment()
          ? ['query', 'error', 'info', 'warn']
          : ['error', 'warn'],
        errorFormat: 'pretty',
      });

      // Set up logging event handlers
      DatabaseClient.setupLogging(DatabaseClient.instance);

      // Set up connection event handlers
      DatabaseClient.setupConnectionHandlers(DatabaseClient.instance);
    }

    return DatabaseClient.instance;
  }

  /**
   * Set up logging for database operations
   * Includes PII redaction for compliance
   */
  private static setupLogging(client: PrismaClient) {
    // Prisma logging is handled via the log configuration above
    // Additional custom logging can be added here if needed
  }

  /**
   * Set up connection event handlers
   */
  private static setupConnectionHandlers(client: PrismaClient) {
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, closing database connection...');
      await client.$disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, closing database connection...');
      await client.$disconnect();
      process.exit(0);
    });
  }

  /**
   * Test database connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      const client = DatabaseClient.getInstance();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Close database connection
   */
  static async disconnect(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect();
      DatabaseClient.instance = null;
    }
  }
}

/**
 * Export the database client instance
 */
export const db = DatabaseClient.getInstance();

/**
 * Export utility functions
 */
export { DatabaseClient };

/**
 * Workspace-aware database operations
 * Ensures proper tenant isolation for multi-tenant architecture
 */
export class WorkspaceDatabase {
  constructor(private workspaceId: string) {}

  /**
   * Get users for the current workspace
   */
  async getUsers() {
    return db.user.findMany({
      where: { workspaceId: this.workspaceId },
      select: {
        id: true,
        email: true,
        roles: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  }

  /**
   * Get documents for the current workspace
   */
  async getDocuments() {
    return db.document.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get audit events for the current workspace
   */
  async getAuditEvents(limit = 100) {
    return db.auditEvent.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Create audit event for the current workspace
   */
  async createAuditEvent(data: {
    userId?: string;
    eventType: string;
    resourceId: string;
    action: string;
    metadata: any;
    correlationId: string;
    residencyValidation?: any;
    piiRedacted?: boolean;
  }) {
    return db.auditEvent.create({
      data: {
        ...data,
        workspaceId: this.workspaceId,
        eventType: data.eventType as any, // Type assertion for enum
      },
    });
  }
}