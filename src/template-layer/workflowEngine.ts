/**
 * Workflow Engine - Executes workflow templates with step dependencies
 * 
 * Handles the execution of workflow templates, managing step dependencies,
 * error handling, and state management for Spanish administrative processes.
 */

import { PrismaClient, WorkflowStatus } from '@prisma/client';
import { 
  WorkflowTemplate, 
  WorkflowExecution, 
  WorkflowStep,
  StepResult,
  ExecutionContext,
  ExecutionEngineConfig,
  ExecutionMetrics,
  StepMetrics,
  WorkflowExecutionError,
  TemplateError
} from './types.js';
import { TemplateManager } from './templateManager.js';

export class WorkflowEngine {
  private db: PrismaClient;
  private templateManager: TemplateManager;
  private config: ExecutionEngineConfig;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private executionMetrics: Map<string, ExecutionMetrics> = new Map();

  constructor(
    db: PrismaClient, 
    templateManager: TemplateManager, 
    config?: Partial<ExecutionEngineConfig>
  ) {
    this.db = db;
    this.templateManager = templateManager;
    this.config = {
      maxConcurrentExecutions: 10,
      defaultTimeout: 300, // 5 minutes
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000,
        backoffMultiplier: 2
      },
      enableMetrics: true,
      auditEnabled: true,
      ...config
    };
  }

  /**
   * Start a new workflow execution
   */
  async startExecution(
    templateId: string,
    workspaceId: string,
    userId: string,
    inputData: Record<string, any>,
    correlationId?: string
  ): Promise<WorkflowExecution> {
    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      throw new WorkflowExecutionError(
        'Maximum concurrent executions reached',
        'EXECUTION_LIMIT_REACHED'
      );
    }

    // Get template
    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      throw new TemplateError(`Template ${templateId} not found`, 'TEMPLATE_NOT_FOUND');
    }

    // Validate input data against template schema
    const validationResult = await this.templateManager.validateTemplateData(templateId, inputData);
    if (!validationResult.isValid) {
      throw new WorkflowExecutionError(
        `Input validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
        'INPUT_VALIDATION_FAILED',
        undefined,
        { errors: validationResult.errors }
      );
    }

    // Create execution record in database
    const execution = await this.db.workflowExecution.create({
      data: {
        templateId,
        workspaceId,
        inputData,
        status: WorkflowStatus.PENDING,
        currentStep: 0,
        retryCount: 0
      }
    });

    // Create in-memory execution state
    const workflowExecution: WorkflowExecution = {
      id: execution.id,
      templateId,
      workspaceId,
      status: WorkflowStatus.PENDING,
      currentStep: 0,
      inputData,
      stepResults: template.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
        inputData: {},
        retryCount: 0
      })),
      retryCount: 0,
      startedAt: execution.startedAt
    };

    // Store active execution
    this.activeExecutions.set(execution.id, workflowExecution);

    // Initialize metrics if enabled
    if (this.config.enableMetrics) {
      this.executionMetrics.set(execution.id, {
        executionId: execution.id,
        templateId,
        startTime: new Date(),
        stepMetrics: [],
        status: WorkflowStatus.PENDING,
        errorCount: 0,
        retryCount: 0
      });
    }

    // Create execution context
    const context: ExecutionContext = {
      workspaceId,
      userId,
      correlationId: correlationId || execution.id,
      data: { ...inputData },
      metadata: {
        executionId: execution.id,
        templateId,
        templateName: template.name,
        startedAt: execution.startedAt.toISOString()
      }
    };

    // Start execution asynchronously
    this.executeWorkflow(execution.id, template, context).catch(error => {
      console.error(`Workflow execution ${execution.id} failed:`, error);
    });

    return workflowExecution;
  }

  /**
   * Execute workflow steps with dependency management
   */
  private async executeWorkflow(
    executionId: string,
    template: WorkflowTemplate,
    context: ExecutionContext
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new WorkflowExecutionError('Execution not found', 'EXECUTION_NOT_FOUND');
    }

    try {
      // Update status to running
      execution.status = WorkflowStatus.RUNNING;
      await this.updateExecutionStatus(executionId, WorkflowStatus.RUNNING);

      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(template.steps);
      
      // Execute steps in dependency order
      const executedSteps = new Set<string>();
      const pendingSteps = new Set(template.steps.map(s => s.id));

      while (pendingSteps.size > 0) {
        // Find steps that can be executed (all dependencies satisfied)
        const readySteps = Array.from(pendingSteps).filter(stepId => {
          const step = template.steps.find(s => s.id === stepId);
          if (!step) return false;
          
          return step.dependencies.every(depId => executedSteps.has(depId));
        });

        if (readySteps.length === 0) {
          throw new WorkflowExecutionError(
            'No steps ready for execution - possible circular dependency',
            'DEPENDENCY_DEADLOCK'
          );
        }

        // Execute ready steps in parallel
        const stepPromises = readySteps.map(stepId => 
          this.executeStep(executionId, stepId, template, context)
        );

        const stepResults = await Promise.allSettled(stepPromises);

        // Process results
        for (let i = 0; i < stepResults.length; i++) {
          const stepId = readySteps[i];
          const result = stepResults[i];

          if (result.status === 'fulfilled') {
            executedSteps.add(stepId);
            pendingSteps.delete(stepId);
            
            // Update context with step output
            if (result.value.outputData) {
              Object.assign(context.data, result.value.outputData);
            }
          } else {
            // Handle step failure
            const step = template.steps.find(s => s.id === stepId);
            if (step?.optional) {
              // Skip optional step on failure
              console.warn(`Optional step ${stepId} failed, skipping:`, result.reason);
              executedSteps.add(stepId);
              pendingSteps.delete(stepId);
              
              // Mark step as skipped
              const stepResult = execution.stepResults.find(sr => sr.stepId === stepId);
              if (stepResult) {
                stepResult.status = 'skipped';
                stepResult.errorMessage = result.reason?.message || 'Step failed';
              }
            } else {
              // Required step failed - abort execution
              throw new WorkflowExecutionError(
                `Required step ${stepId} failed: ${result.reason?.message}`,
                'STEP_EXECUTION_FAILED',
                stepId,
                { originalError: result.reason }
              );
            }
          }
        }
      }

      // All steps completed successfully
      execution.status = WorkflowStatus.COMPLETED;
      execution.completedAt = new Date();
      
      // Generate output data
      execution.outputData = this.generateOutputData(template, context);

      // Update database
      await this.updateExecutionStatus(executionId, WorkflowStatus.COMPLETED, execution.outputData);

      // Update metrics
      if (this.config.enableMetrics) {
        const metrics = this.executionMetrics.get(executionId);
        if (metrics) {
          metrics.endTime = new Date();
          metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
          metrics.status = WorkflowStatus.COMPLETED;
        }
      }

      // Audit log
      if (this.config.auditEnabled) {
        await this.auditWorkflowCompletion(executionId, context);
      }

    } catch (error) {
      // Handle execution failure
      execution.status = WorkflowStatus.FAILED;
      execution.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();

      await this.updateExecutionStatus(
        executionId, 
        WorkflowStatus.FAILED, 
        undefined, 
        execution.errorMessage
      );

      // Update metrics
      if (this.config.enableMetrics) {
        const metrics = this.executionMetrics.get(executionId);
        if (metrics) {
          metrics.endTime = new Date();
          metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
          metrics.status = WorkflowStatus.FAILED;
          metrics.errorCount++;
        }
      }

      // Audit log
      if (this.config.auditEnabled) {
        await this.auditWorkflowFailure(executionId, context, error);
      }

      throw error;
    } finally {
      // Clean up active execution
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    executionId: string,
    stepId: string,
    template: WorkflowTemplate,
    context: ExecutionContext
  ): Promise<StepResult> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new WorkflowExecutionError('Execution not found', 'EXECUTION_NOT_FOUND');
    }

    const step = template.steps.find(s => s.id === stepId);
    if (!step) {
      throw new WorkflowExecutionError(`Step ${stepId} not found`, 'STEP_NOT_FOUND', stepId);
    }

    const stepResult = execution.stepResults.find(sr => sr.stepId === stepId);
    if (!stepResult) {
      throw new WorkflowExecutionError(`Step result ${stepId} not found`, 'STEP_RESULT_NOT_FOUND', stepId);
    }

    const startTime = new Date();
    stepResult.status = 'running';
    stepResult.startedAt = startTime;
    stepResult.inputData = { ...context.data };

    // Initialize step metrics
    let stepMetrics: StepMetrics | undefined;
    if (this.config.enableMetrics) {
      stepMetrics = {
        stepId,
        startTime,
        status: 'completed',
        retryCount: 0
      };
    }

    try {
      // Execute step based on type
      const outputData = await this.executeStepByType(step, context);
      
      // Update step result
      stepResult.status = 'completed';
      stepResult.completedAt = new Date();
      stepResult.outputData = outputData;
      stepResult.duration = stepResult.completedAt.getTime() - startTime.getTime();

      // Update metrics
      if (stepMetrics) {
        stepMetrics.endTime = stepResult.completedAt;
        stepMetrics.duration = stepResult.duration;
        
        const executionMetrics = this.executionMetrics.get(executionId);
        if (executionMetrics) {
          executionMetrics.stepMetrics.push(stepMetrics);
        }
      }

      return stepResult;

    } catch (error) {
      // Handle step failure with retry logic
      stepResult.retryCount++;
      
      const maxAttempts = step.retryPolicy?.maxAttempts || this.config.retryPolicy.maxAttempts;
      
      if (stepResult.retryCount < maxAttempts) {
        // Retry step
        const backoffMs = (step.retryPolicy?.backoffMs || this.config.retryPolicy.backoffMs) * 
                         Math.pow(step.retryPolicy?.backoffMultiplier || this.config.retryPolicy.backoffMultiplier, stepResult.retryCount - 1);
        
        console.warn(`Step ${stepId} failed, retrying in ${backoffMs}ms (attempt ${stepResult.retryCount}/${maxAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        // Update metrics
        if (stepMetrics) {
          stepMetrics.retryCount++;
        }
        
        return this.executeStep(executionId, stepId, template, context);
      } else {
        // Max retries exceeded
        stepResult.status = 'failed';
        stepResult.completedAt = new Date();
        stepResult.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stepResult.duration = stepResult.completedAt.getTime() - startTime.getTime();

        // Update metrics
        if (stepMetrics) {
          stepMetrics.endTime = stepResult.completedAt;
          stepMetrics.duration = stepResult.duration;
          stepMetrics.status = 'failed';
          
          const executionMetrics = this.executionMetrics.get(executionId);
          if (executionMetrics) {
            executionMetrics.stepMetrics.push(stepMetrics);
            executionMetrics.errorCount++;
          }
        }

        throw new WorkflowExecutionError(
          `Step ${stepId} failed after ${maxAttempts} attempts: ${stepResult.errorMessage}`,
          'STEP_MAX_RETRIES_EXCEEDED',
          stepId,
          { originalError: error, retryCount: stepResult.retryCount }
        );
      }
    }
  }

  /**
   * Execute step based on its type
   */
  private async executeStepByType(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    const timeout = step.timeout || this.config.defaultTimeout;
    
    return new Promise(async (resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new WorkflowExecutionError(
          `Step ${step.id} timed out after ${timeout}s`,
          'STEP_TIMEOUT',
          step.id
        ));
      }, timeout * 1000);

      try {
        let result: Record<string, any> = {};

        switch (step.type) {
          case 'data_extraction':
            result = await this.executeDataExtraction(step, context);
            break;
          
          case 'validation':
            result = await this.executeValidation(step, context);
            break;
          
          case 'form_generation':
            result = await this.executeFormGeneration(step, context);
            break;
          
          case 'api_call':
            result = await this.executeApiCall(step, context);
            break;
          
          case 'calculation':
            result = await this.executeCalculation(step, context);
            break;
          
          case 'document_merge':
            result = await this.executeDocumentMerge(step, context);
            break;
          
          case 'notification':
            result = await this.executeNotification(step, context);
            break;
          
          default:
            throw new WorkflowExecutionError(
              `Unknown step type: ${step.type}`,
              'UNKNOWN_STEP_TYPE',
              step.id
            );
        }

        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Execute data extraction step
   */
  private async executeDataExtraction(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    const config = step.configuration;
    const result: Record<string, any> = {};

    // Extract data based on extraction rules
    if (config.extractionRules) {
      for (const rule of config.extractionRules) {
        const sourceValue = context.data[rule.source];
        if (sourceValue !== undefined) {
          let extractedValue = sourceValue;
          
          // Apply pattern matching if specified
          if (rule.pattern) {
            const regex = new RegExp(rule.pattern);
            const match = String(sourceValue).match(regex);
            extractedValue = match ? match[1] || match[0] : null;
          }
          
          // Apply transformer if specified
          if (rule.transformer && extractedValue !== null) {
            extractedValue = this.applyTransformer(rule.transformer, extractedValue);
          }
          
          result[rule.field] = extractedValue;
        } else if (rule.required) {
          throw new WorkflowExecutionError(
            `Required source field '${rule.source}' not found`,
            'MISSING_SOURCE_FIELD',
            step.id
          );
        }
      }
    }

    // Copy source fields directly
    if (config.sourceFields) {
      for (const field of config.sourceFields) {
        if (context.data[field] !== undefined) {
          result[field] = context.data[field];
        }
      }
    }

    return result;
  }

  /**
   * Execute validation step
   */
  private async executeValidation(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    const config = step.configuration;
    const errors: string[] = [];

    // Check required fields
    if (config.requiredFields) {
      for (const field of config.requiredFields) {
        if (!(field in context.data) || context.data[field] === null || context.data[field] === undefined) {
          errors.push(`Required field '${field}' is missing`);
        }
      }
    }

    // Apply validation rules
    if (config.validationRules) {
      for (const rule of config.validationRules) {
        const value = context.data[rule.field];
        
        switch (rule.type) {
          case 'required':
            if (value === null || value === undefined || value === '') {
              errors.push(rule.message);
            }
            break;
          
          case 'pattern':
            if (value && !new RegExp(rule.value).test(String(value))) {
              errors.push(rule.message);
            }
            break;
          
          case 'range':
            if (typeof value === 'number' && rule.value) {
              const [min, max] = rule.value;
              if (value < min || value > max) {
                errors.push(rule.message);
              }
            }
            break;
        }
      }
    }

    if (errors.length > 0) {
      throw new WorkflowExecutionError(
        `Validation failed: ${errors.join(', ')}`,
        'VALIDATION_FAILED',
        step.id,
        { validationErrors: errors }
      );
    }

    return { validationPassed: true, validatedFields: Object.keys(context.data) };
  }

  /**
   * Execute form generation step
   */
  private async executeFormGeneration(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    const config = step.configuration;
    
    // This is a simplified implementation - in a real system, you would
    // integrate with form generation libraries or services
    const formData = {
      templatePath: config.templatePath,
      outputFormat: config.outputFormat || 'pdf',
      generatedAt: new Date().toISOString(),
      data: context.data
    };

    return { 
      formGenerated: true, 
      formData,
      outputPath: `generated-form-${Date.now()}.${config.outputFormat || 'pdf'}`
    };
  }

  /**
   * Execute API call step
   */
  private async executeApiCall(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    const config = step.configuration;
    
    if (!config.endpoint) {
      throw new WorkflowExecutionError('API endpoint not configured', 'MISSING_API_ENDPOINT', step.id);
    }

    // This is a simplified implementation - in a real system, you would
    // make actual HTTP requests
    const apiResult = {
      endpoint: config.endpoint,
      method: config.method || 'GET',
      headers: config.headers || {},
      requestData: context.data,
      responseReceived: true,
      timestamp: new Date().toISOString()
    };

    return { apiCallResult: apiResult };
  }

  /**
   * Execute calculation step
   */
  private async executeCalculation(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    const config = step.configuration;
    
    if (!config.formula && !config.inputFields) {
      throw new WorkflowExecutionError('Calculation configuration missing', 'MISSING_CALCULATION_CONFIG', step.id);
    }

    // Simple calculation implementation
    let result: any;
    
    if (config.formula) {
      // This is a simplified implementation - in a real system, you would
      // use a safe expression evaluator
      result = this.evaluateFormula(config.formula, context.data);
    } else if (config.inputFields) {
      // Sum input fields as default calculation
      result = config.inputFields.reduce((sum: number, field: string) => {
        const value = context.data[field];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
    }

    const outputField = config.outputField || 'calculationResult';
    return { [outputField]: result };
  }

  /**
   * Execute document merge step
   */
  private async executeDocumentMerge(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    // Simplified implementation
    return { 
      documentMerged: true, 
      mergedDocumentPath: `merged-document-${Date.now()}.pdf`,
      sourceData: context.data
    };
  }

  /**
   * Execute notification step
   */
  private async executeNotification(step: WorkflowStep, context: ExecutionContext): Promise<Record<string, any>> {
    // Simplified implementation
    return { 
      notificationSent: true, 
      timestamp: new Date().toISOString(),
      notificationData: context.data
    };
  }

  /**
   * Build dependency graph for steps
   */
  private buildDependencyGraph(steps: WorkflowStep[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const step of steps) {
      graph.set(step.id, step.dependencies || []);
    }
    
    return graph;
  }

  /**
   * Generate output data from execution context
   */
  private generateOutputData(template: WorkflowTemplate, context: ExecutionContext): Record<string, any> {
    const outputData: Record<string, any> = {
      templateId: template.id,
      templateName: template.name,
      executionData: context.data,
      generatedAt: new Date().toISOString()
    };

    // Apply output format if specified
    if (template.outputFormat && template.outputFormat.fields) {
      const formattedOutput: Record<string, any> = {};
      
      for (const field of template.outputFormat.fields) {
        if (context.data[field.name] !== undefined) {
          formattedOutput[field.name] = context.data[field.name];
        }
      }
      
      outputData.formattedOutput = formattedOutput;
    }

    return outputData;
  }

  /**
   * Apply data transformer
   */
  private applyTransformer(transformer: string, value: any): any {
    switch (transformer) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'number':
        return Number(value);
      default:
        return value;
    }
  }

  /**
   * Evaluate formula (simplified implementation)
   */
  private evaluateFormula(formula: string, data: Record<string, any>): number {
    // This is a very simplified implementation
    // In a real system, you would use a safe expression evaluator
    let expression = formula;
    
    // Replace field references with values
    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'number') {
        expression = expression.replace(new RegExp(`\\b${field}\\b`, 'g'), String(value));
      }
    }
    
    // Basic arithmetic evaluation (unsafe - for demo only)
    try {
      return eval(expression);
    } catch (error) {
      throw new WorkflowExecutionError(
        `Formula evaluation failed: ${error}`,
        'FORMULA_EVALUATION_FAILED'
      );
    }
  }

  /**
   * Update execution status in database
   */
  private async updateExecutionStatus(
    executionId: string, 
    status: WorkflowStatus, 
    outputData?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    await this.db.workflowExecution.update({
      where: { id: executionId },
      data: {
        status,
        outputData,
        errorMessage,
        ...(status === WorkflowStatus.COMPLETED && { completedAt: new Date() })
      }
    });
  }

  /**
   * Audit workflow completion
   */
  private async auditWorkflowCompletion(executionId: string, context: ExecutionContext): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        workspaceId: context.workspaceId,
        userId: context.userId,
        eventType: 'WORKFLOW_COMPLETE',
        resourceId: executionId,
        action: 'workflow_execution_completed',
        metadata: {
          templateId: context.metadata.templateId,
          correlationId: context.correlationId,
          executionDuration: Date.now() - new Date(context.metadata.startedAt).getTime()
        },
        correlationId: context.correlationId
      }
    });
  }

  /**
   * Audit workflow failure
   */
  private async auditWorkflowFailure(executionId: string, context: ExecutionContext, error: any): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        workspaceId: context.workspaceId,
        userId: context.userId,
        eventType: 'SYSTEM_ERROR',
        resourceId: executionId,
        action: 'workflow_execution_failed',
        metadata: {
          templateId: context.metadata.templateId,
          correlationId: context.correlationId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorCode: error instanceof WorkflowExecutionError ? error.code : 'UNKNOWN_ERROR'
        },
        correlationId: context.correlationId
      }
    });
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    // Check active executions first
    const activeExecution = this.activeExecutions.get(executionId);
    if (activeExecution) {
      return activeExecution;
    }

    // Query database
    const dbExecution = await this.db.workflowExecution.findUnique({
      where: { id: executionId }
    });

    if (!dbExecution) {
      return null;
    }

    return {
      id: dbExecution.id,
      templateId: dbExecution.templateId,
      workspaceId: dbExecution.workspaceId,
      status: dbExecution.status,
      currentStep: dbExecution.currentStep,
      inputData: dbExecution.inputData as Record<string, any>,
      outputData: dbExecution.outputData as Record<string, any> | undefined,
      stepResults: [], // Would need to be stored separately for full implementation
      errorMessage: dbExecution.errorMessage || undefined,
      retryCount: dbExecution.retryCount,
      startedAt: dbExecution.startedAt,
      completedAt: dbExecution.completedAt || undefined
    };
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = WorkflowStatus.CANCELLED;
    await this.updateExecutionStatus(executionId, WorkflowStatus.CANCELLED);
    
    this.activeExecutions.delete(executionId);
    return true;
  }

  /**
   * Get execution metrics
   */
  getExecutionMetrics(executionId: string): ExecutionMetrics | undefined {
    return this.executionMetrics.get(executionId);
  }

  /**
   * Get active executions count
   */
  getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }
}