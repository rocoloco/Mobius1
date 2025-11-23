/**
 * Tests for Structured Logger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, LogLevel } from '../../src/observability/logger.js';

describe('Logger', () => {
  let consoleOutput: string[] = [];

  beforeEach(() => {
    consoleOutput = [];
    
    // Mock console methods
    vi.spyOn(console, 'debug').mockImplementation((msg) => consoleOutput.push(msg));
    vi.spyOn(console, 'info').mockImplementation((msg) => consoleOutput.push(msg));
    vi.spyOn(console, 'warn').mockImplementation((msg) => consoleOutput.push(msg));
    vi.spyOn(console, 'error').mockImplementation((msg) => consoleOutput.push(msg));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      logger.info('Test info message');

      expect(consoleOutput.length).toBeGreaterThan(0);
      const log = JSON.parse(consoleOutput[0]);
      expect(log.level).toBe('info');
      expect(log.message).toBe('Test info message');
      expect(log.timestamp).toBeDefined();
    });

    it('should log warn messages', () => {
      logger.warn('Test warning');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.level).toBe('warn');
      expect(log.message).toBe('Test warning');
    });

    it('should log error messages', () => {
      logger.error('Test error');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.level).toBe('error');
      expect(log.message).toBe('Test error');
    });

    it('should log debug messages when level is set', () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('Test debug');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.level).toBe('debug');
      expect(log.message).toBe('Test debug');
    });
  });

  describe('Context Logging', () => {
    it('should include context in log entries', () => {
      logger.info('Test with context', {
        workspaceId: 'ws-123',
        userId: 'user-456',
      });

      const log = JSON.parse(consoleOutput[0]);
      expect(log.context.workspaceId).toBe('ws-123');
      expect(log.context.userId).toBe('user-456');
    });

    it('should include correlation ID in context', () => {
      logger.info('Test correlation', {
        correlationId: 'corr-789',
      });

      const log = JSON.parse(consoleOutput[0]);
      expect(log.context.correlationId).toBe('corr-789');
    });
  });

  describe('Error Logging', () => {
    it('should log errors with stack traces', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      const log = JSON.parse(consoleOutput[0]);
      expect(log.level).toBe('error');
      expect(log.message).toBe('Error occurred');
      expect(log.context.error).toBeDefined();
      expect(log.context.error.name).toBe('Error');
      expect(log.context.error.message).toBe('Test error');
      expect(log.context.error.stack).toBeDefined();
    });

    it('should log errors with additional context', () => {
      const error = new Error('Test error');
      logger.error('Error with context', error, {
        workspaceId: 'ws-123',
        operation: 'test-operation',
      });

      const log = JSON.parse(consoleOutput[0]);
      expect(log.context.workspaceId).toBe('ws-123');
      expect(log.context.operation).toBe('test-operation');
      expect(log.context.error).toBeDefined();
    });
  });

  describe('PII Redaction', () => {
    it('should redact DNI from log messages', () => {
      logger.info('User DNI is 12345678A');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.message).toBe('User DNI is [DNI_REDACTED]');
      expect(log.message).not.toContain('12345678A');
    });

    it('should redact email from log messages', () => {
      logger.info('Contact: user@example.com');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.message).toBe('Contact: [EMAIL_REDACTED]');
    });

    it('should redact PII from context', () => {
      logger.info('User info', {
        dni: '12345678A',
        email: 'user@example.com',
      });

      const log = JSON.parse(consoleOutput[0]);
      expect(log.context.dni).toBe('[DNI_REDACTED]');
      expect(log.context.email).toBe('[EMAIL_REDACTED]');
    });

    it('should handle nested PII in context', () => {
      logger.info('Nested user data', {
        user: {
          contact: {
            email: 'test@example.com',
            dni: '87654321B',
          },
        },
      });

      const log = JSON.parse(consoleOutput[0]);
      expect(log.context.user.contact.email).toBe('[EMAIL_REDACTED]');
      expect(log.context.user.contact.dni).toBe('[DNI_REDACTED]');
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect minimum log level', () => {
      logger.setLevel(LogLevel.WARN);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleOutput.length).toBe(2); // Only warn and error
      
      const log1 = JSON.parse(consoleOutput[0]);
      const log2 = JSON.parse(consoleOutput[1]);
      
      expect(log1.level).toBe('warn');
      expect(log2.level).toBe('error');
    });

    it('should log all levels when set to DEBUG', () => {
      logger.setLevel(LogLevel.DEBUG);
      
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleOutput.length).toBe(4);
    });
  });

  describe('Configuration', () => {
    it('should allow disabling PII redaction', () => {
      logger.setPIIRedaction(false);
      logger.info('DNI: 12345678A');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.message).toBe('DNI: 12345678A');

      // Re-enable for other tests
      logger.setPIIRedaction(true);
    });

    it('should allow changing log level', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.info('Should not appear');
      
      expect(consoleOutput.length).toBe(0);

      logger.error('Should appear');
      expect(consoleOutput.length).toBe(1);

      // Reset for other tests
      logger.setLevel(LogLevel.INFO);
    });
  });

  describe('Structured Output', () => {
    it('should produce valid JSON output', () => {
      logger.info('Test message', { key: 'value' });

      expect(() => JSON.parse(consoleOutput[0])).not.toThrow();
    });

    it('should include timestamp in ISO format', () => {
      logger.info('Test timestamp');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle special characters in messages', () => {
      logger.info('Message with "quotes" and \\backslashes\\');

      const log = JSON.parse(consoleOutput[0]);
      expect(log.message).toContain('quotes');
      expect(log.message).toContain('backslashes');
    });
  });
});
