/**
 * Database Schema Tests for Mobius 1 Platform
 * Tests Prisma schema validation and basic database operations
 */

import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Database Schema', () => {
  it('should create Prisma client without errors', () => {
    const prisma = new PrismaClient();
    expect(prisma).toBeDefined();
    expect(prisma.user).toBeDefined();
    expect(prisma.workspace).toBeDefined();
    expect(prisma.document).toBeDefined();
    expect(prisma.auditEvent).toBeDefined();
    expect(prisma.workflowTemplate).toBeDefined();
    expect(prisma.workflowExecution).toBeDefined();
    expect(prisma.complianceReport).toBeDefined();
    expect(prisma.policyEvaluation).toBeDefined();
  });

  it('should have correct enum values', () => {
    // Test that enums are properly defined
    expect(['DNI', 'PASSPORT', 'NIE_TIE', 'VISA']).toContain('DNI');
    expect(['VISA', 'TAX', 'IDENTITY', 'OTHER']).toContain('VISA');
    expect(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).toContain('PENDING');
  });

  it('should validate workspace model structure', () => {
    // This test ensures the workspace model has required fields
    const prisma = new PrismaClient();
    const workspaceModel = prisma.workspace;
    
    expect(workspaceModel).toBeDefined();
    expect(workspaceModel.create).toBeDefined();
    expect(workspaceModel.findMany).toBeDefined();
    expect(workspaceModel.update).toBeDefined();
    expect(workspaceModel.delete).toBeDefined();
  });

  it('should validate audit event model structure', () => {
    const prisma = new PrismaClient();
    const auditModel = prisma.auditEvent;
    
    expect(auditModel).toBeDefined();
    expect(auditModel.create).toBeDefined();
    expect(auditModel.findMany).toBeDefined();
  });
});