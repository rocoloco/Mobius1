/**
 * Structured Logger with PII Redaction
 * 
 * Provides structured logging with automatic PII redaction and trace correlation.
 * Integrates with OpenTelemetry for distributed tracing context.
 */

import { getTraceContext } from './telemetry.js';
import { redactPII, redactPIIFromObject } from './pii-redactor.js';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  workspaceId?: string;
  userId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private minLevel: LogLevel = LogLevel.INFO;
  private enablePIIRedaction: boolean = true;

  constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (envLevel && Object.values(LogLevel).includes(envLevel as LogLevel)) {
      this.minLevel = envLevel as LogLevel;
    }

    // Enable/disable PII redaction
    this.enablePIIRedaction = process.env.ENABLE_PII_REDACTION !== 'false';
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : context;

    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    // Get trace context if available
    const traceContext = getTraceContext();

    // Build log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.enablePIIRedaction ? redactPII(message) : message,
      context: {
        ...context,
        traceId: traceContext?.traceId,
        spanId: traceContext?.spanId,
      },
    };

    // Redact PII from context
    if (this.enablePIIRedaction && entry.context) {
      entry.context = redactPIIFromObject(entry.context);
    }

    // Output log entry
    this.output(entry);
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Output log entry to console
   */
  private output(entry: LogEntry): void {
    const output = JSON.stringify(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
    }
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Enable or disable PII redaction
   */
  setPIIRedaction(enabled: boolean): void {
    this.enablePIIRedaction = enabled;
  }
}

// Singleton instance
export const logger = new Logger();
