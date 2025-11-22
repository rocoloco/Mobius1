/**
 * AI Copilot Natural Language Processing
 * Implements FR-001 requirement for natural language infrastructure operations
 * Provides intent interpretation, deployment guidance, and troubleshooting assistance
 */

import { EventEmitter } from 'events';
import { controlPlaneOrchestrator } from './orchestrator.js';
import { deploymentManager } from './deployment.js';
import type {
  DeploymentConfig,
  DeploymentResult,
  ValidationResult,
  SystemStatus,
  ComponentStatus,
  FailureType,
} from './types.js';

/**
 * User context for copilot interactions
 */
export interface UserContext {
  workspaceId: string;
  userId: string;
  roles: string[];
  experience: 'beginner' | 'intermediate' | 'expert';
  preferredLanguage: 'en' | 'es';
}

/**
 * Copilot response interface
 */
export interface CopilotResponse {
  intent: string;
  confidence: number;
  response: string;
  actions?: CopilotAction[];
  followUp?: string[];
  requiresConfirmation?: boolean;
}

/**
 * Copilot action interface
 */
export interface CopilotAction {
  type: 'deploy' | 'validate' | 'troubleshoot' | 'configure' | 'monitor';
  description: string;
  parameters: Record<string, any>;
  estimatedTime?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Deployment step interface
 */
export interface DeploymentStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string;
  estimatedTime?: string;
  dependencies?: string[];
}

/**
 * System error interface for troubleshooting
 */
export interface SystemError {
  type: string;
  component: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

/**
 * Guidance response interface
 */
export interface GuidanceResponse {
  step: string;
  instructions: string;
  commands?: string[];
  warnings?: string[];
  nextSteps?: string[];
  estimatedTime?: string;
}

/**
 * Troubleshooting guide interface
 */
export interface TroubleshootingGuide {
  diagnosis: string;
  confidence: number;
  steps: TroubleshootingStep[];
  preventionTips?: string[];
  escalationPath?: string;
}

/**
 * Troubleshooting step interface
 */
export interface TroubleshootingStep {
  step: number;
  description: string;
  command?: string;
  expectedResult?: string;
  troubleshootingTips?: string[];
}

/**
 * Intent patterns for natural language processing
 */
const INTENT_PATTERNS = {
  deploy: [
    /deploy/i,
    /start.*deployment/i,
    /launch/i,
    /create.*infrastructure/i,
    /setup.*system/i,
    /install/i,
    /spin up/i,
    /bring up/i,
  ],
  status: [
    /status/i,
    /health/i,
    /check.*system/i,
    /monitor/i,
    /how.*doing/i,
    /running/i,
    /operational/i,
    /current.*status/i,
  ],
  troubleshoot: [
    /problem/i,
    /issue/i,
    /error/i,
    /fail/i,
    /broken/i,
    /not working/i,
    /troubleshoot/i,
    /debug/i,
    /fix/i,
    /resolve/i,
    /something.*wrong/i,
  ],
  configure: [
    /configure/i,
    /config/i,
    /settings/i,
    /options/i,
    /change.*settings/i,
    /modify/i,
    /update.*config/i,
    /how.*configure/i,
    /how.*setup/i,
    /how.*enable/i,
    /spain.*residency/i,
    /air.*gapped/i,
    /budget.*config/i,
  ],
  cost: [
    /cost/i,
    /budget/i,
    /expense/i,
    /money/i,
    /price/i,
    /billing/i,
    /usage/i,
    /spend/i,
    /how much/i,
    /expensive/i,
  ],
  guidance: [
    /how.*do/i,
    /how.*can/i,
    /guide/i,
    /help.*with/i,
    /tutorial/i,
    /walkthrough/i,
    /step.*by.*step/i,
    /best.*practice/i,
    /recommend/i,
    /guidance/i,
    /help.*me/i,
  ],
};

/**
 * AI Copilot Events
 */
export interface CopilotEvents {
  'intent-processed': (intent: string, confidence: number) => void;
  'action-suggested': (action: CopilotAction) => void;
  'guidance-provided': (step: string, response: GuidanceResponse) => void;
  'troubleshooting-started': (error: SystemError) => void;
  'user-interaction': (userId: string, input: string, response: CopilotResponse) => void;
}

/**
 * AI Copilot Service
 * Provides natural language interface for infrastructure operations
 */
export class AICopilot extends EventEmitter {
  private knowledgeBase: Map<string, any> = new Map();
  private conversationHistory: Map<string, any[]> = new Map();

  constructor() {
    super();
    this.initializeKnowledgeBase();
  }

  /**
   * Process user intent and provide appropriate response
   * Main entry point for natural language processing
   */
  async processIntent(userInput: string, context: UserContext): Promise<CopilotResponse> {
    const intent = this.classifyIntent(userInput);
    const confidence = this.calculateConfidence(userInput, intent);

    this.emit('intent-processed', intent, confidence);

    let response: CopilotResponse;

    switch (intent) {
      case 'deploy':
        response = await this.handleDeploymentIntent(userInput, context);
        break;
      case 'status':
        response = await this.handleStatusIntent(userInput, context);
        break;
      case 'troubleshoot':
        response = await this.handleTroubleshootIntent(userInput, context);
        break;
      case 'configure':
        response = await this.handleConfigurationIntent(userInput, context);
        break;
      case 'cost':
        response = await this.handleCostIntent(userInput, context);
        break;
      case 'guidance':
        response = await this.handleGuidanceIntent(userInput, context);
        break;
      default:
        response = this.handleUnknownIntent(userInput, context);
    }

    // Store conversation history
    this.storeConversation(context.userId, userInput, response);
    this.emit('user-interaction', context.userId, userInput, response);

    return response;
  }

  /**
   * Provide deployment guidance for specific steps
   * Implements deployment guidance system from FR-001
   */
  async guideDeployment(step: DeploymentStep, context?: UserContext): Promise<GuidanceResponse> {
    const guidance = this.getDeploymentGuidance(step);
    
    if (context) {
      this.emit('guidance-provided', step.step, guidance);
    }

    return guidance;
  }

  /**
   * Provide troubleshooting assistance for system errors
   * Implements troubleshooting system from FR-001
   */
  async provideTroubleshooting(error: SystemError, context?: UserContext): Promise<TroubleshootingGuide> {
    this.emit('troubleshooting-started', error);

    const guide = this.generateTroubleshootingGuide(error);
    return guide;
  }

  /**
   * Get configuration assistance for specific components
   */
  async getConfigurationAssistance(
    component: string,
    operation: string,
    context: UserContext
  ): Promise<CopilotResponse> {
    const configGuide = this.getConfigurationGuide(component, operation);
    
    return {
      intent: 'configure',
      confidence: 0.9,
      response: configGuide.instructions,
      actions: configGuide.actions,
      followUp: configGuide.nextSteps,
    };
  }

  /**
   * Classify user intent based on input text
   */
  private classifyIntent(input: string): string {
    const normalizedInput = input.toLowerCase().trim();
    const intentScores: Record<string, number> = {};
    
    // Score each intent based on pattern matches
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      intentScores[intent] = 0;
      for (const pattern of patterns) {
        if (pattern.test(normalizedInput)) {
          intentScores[intent] += 1;
        }
      }
    }

    // Find the intent with the highest score
    let bestIntent = 'unknown';
    let bestScore = 0;
    
    for (const [intent, score] of Object.entries(intentScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    // Handle special cases for better accuracy
    if (normalizedInput.includes('deploy') && normalizedInput.includes('air-gapped')) {
      return 'deploy';
    }
    if (normalizedInput.includes('setup') && normalizedInput.includes('deployment')) {
      return 'deploy';
    }
    if (normalizedInput.includes('guide') && normalizedInput.includes('troubleshoot')) {
      return 'guidance';
    }
    if (normalizedInput.includes('help') && normalizedInput.includes('manage') && normalizedInput.includes('cost')) {
      return 'guidance';
    }

    return bestScore > 0 ? bestIntent : 'unknown';
  }

  /**
   * Calculate confidence score for intent classification
   */
  private calculateConfidence(input: string, intent: string): number {
    if (intent === 'unknown') return 0.1;

    const patterns = INTENT_PATTERNS[intent as keyof typeof INTENT_PATTERNS] || [];
    const matches = patterns.filter(pattern => pattern.test(input.toLowerCase()));
    
    // Base confidence on number of pattern matches and input specificity
    const baseConfidence = Math.min(0.6 + (matches.length * 0.2), 0.95);
    const specificityBonus = Math.min(input.split(' ').length * 0.02, 0.2);
    
    return Math.min(baseConfidence + specificityBonus, 0.95);
  }

  /**
   * Handle deployment-related intents
   */
  private async handleDeploymentIntent(input: string, context: UserContext): Promise<CopilotResponse> {
    const isSpainMode = input.includes('spain') || input.includes('residency');
    const isAirGapped = input.includes('air-gapped') || input.includes('offline');
    const isQuickDeploy = input.includes('quick') || input.includes('fast') || input.includes('15 min');

    const actions: CopilotAction[] = [
      {
        type: 'validate',
        description: 'Validate deployment prerequisites',
        parameters: { workspaceId: context.workspaceId },
        estimatedTime: '30 seconds',
        riskLevel: 'low',
      },
      {
        type: 'deploy',
        description: `Deploy Mobius 1 infrastructure${isSpainMode ? ' (Spain residency mode)' : ''}${isAirGapped ? ' (air-gapped mode)' : ''}`,
        parameters: {
          workspaceId: context.workspaceId,
          spainResidencyMode: isSpainMode,
          airGappedMode: isAirGapped,
          environment: 'production',
        },
        estimatedTime: isQuickDeploy ? '≤15 minutes' : '15-20 minutes',
        riskLevel: 'medium',
      },
    ];

    let response = `I'll help you deploy your Mobius 1 infrastructure. `;
    
    if (isSpainMode) {
      response += `I see you want Spain residency mode enabled - this ensures all data processing stays within Spanish jurisdiction. `;
    }
    
    if (isAirGapped) {
      response += `Air-gapped mode will be configured for complete offline operation. `;
    }

    response += `The deployment should complete within 15 minutes as per FR-001 requirements.`;

    return {
      intent: 'deploy',
      confidence: 0.9,
      response,
      actions,
      followUp: [
        'Would you like me to validate your configuration first?',
        'Do you need help configuring any specific components?',
        'Should I explain the deployment steps?',
      ],
      requiresConfirmation: true,
    };
  }

  /**
   * Handle status and monitoring intents
   */
  private async handleStatusIntent(input: string, context: UserContext): Promise<CopilotResponse> {
    try {
      const systemStatus = controlPlaneOrchestrator.getCurrentStatus();
      const healthStatus = await controlPlaneOrchestrator.getHealthStatus();

      let response = `System Status: **${systemStatus.overall.toUpperCase()}**\n\n`;
      
      response += `**Components:**\n`;
      for (const component of systemStatus.components) {
        const statusIcon = component.status === 'healthy' ? '✅' : 
                          component.status === 'degraded' ? '⚠️' : '❌';
        response += `${statusIcon} ${component.name}: ${component.status}`;
        if (component.responseTime) {
          response += ` (${component.responseTime}ms)`;
        }
        response += '\n';
      }

      response += `\n**Uptime:** ${Math.floor(systemStatus.uptime / 3600)}h ${Math.floor((systemStatus.uptime % 3600) / 60)}m`;
      response += `\n**Last Health Check:** ${systemStatus.lastHealthCheck.toLocaleString()}`;

      if (systemStatus.recoveryInProgress) {
        response += `\n⚠️ **Recovery in progress**`;
      }

      const actions: CopilotAction[] = [];
      
      if (systemStatus.overall !== 'healthy') {
        actions.push({
          type: 'troubleshoot',
          description: 'Diagnose and fix system issues',
          parameters: { workspaceId: context.workspaceId },
          estimatedTime: '2-5 minutes',
          riskLevel: 'low',
        });
      }

      actions.push({
        type: 'monitor',
        description: 'View detailed monitoring dashboard',
        parameters: { workspaceId: context.workspaceId },
        estimatedTime: 'Immediate',
        riskLevel: 'low',
      });

      return {
        intent: 'status',
        confidence: 0.95,
        response,
        actions,
        followUp: systemStatus.overall !== 'healthy' ? 
          ['Would you like me to troubleshoot the issues?', 'Should I attempt automatic recovery?'] :
          ['Need help with any specific component?', 'Want to see cost usage?'],
      };

    } catch (error) {
      return {
        intent: 'status',
        confidence: 0.8,
        response: `I encountered an error checking system status: ${error instanceof Error ? error.message : 'Unknown error'}. Let me help you troubleshoot this.`,
        actions: [{
          type: 'troubleshoot',
          description: 'Diagnose system connectivity issues',
          parameters: { workspaceId: context.workspaceId },
          estimatedTime: '1-2 minutes',
          riskLevel: 'low',
        }],
      };
    }
  }

  /**
   * Handle troubleshooting intents
   */
  private async handleTroubleshootIntent(input: string, context: UserContext): Promise<CopilotResponse> {
    // Extract error information from input
    const errorKeywords = this.extractErrorKeywords(input);
    const systemError: SystemError = {
      type: errorKeywords.type || 'general',
      component: errorKeywords.component || 'system',
      message: input,
      timestamp: new Date(),
      severity: errorKeywords.severity || 'medium',
      context: { workspaceId: context.workspaceId },
    };

    const guide = await this.provideTroubleshooting(systemError, context);

    let response = `**Diagnosis:** ${guide.diagnosis}\n`;
    response += `**Confidence:** ${Math.round(guide.confidence * 100)}%\n\n`;
    response += `**Troubleshooting Steps:**\n`;
    
    for (const step of guide.steps.slice(0, 3)) { // Show first 3 steps
      response += `${step.step}. ${step.description}\n`;
      if (step.command) {
        response += `   Command: \`${step.command}\`\n`;
      }
    }

    const actions: CopilotAction[] = [{
      type: 'troubleshoot',
      description: 'Execute automated troubleshooting',
      parameters: { 
        workspaceId: context.workspaceId,
        errorType: systemError.type,
        component: systemError.component,
      },
      estimatedTime: '2-10 minutes',
      riskLevel: guide.confidence > 0.8 ? 'low' : 'medium',
    }];

    return {
      intent: 'troubleshoot',
      confidence: guide.confidence,
      response,
      actions,
      followUp: [
        'Should I execute the automated troubleshooting?',
        'Would you like to see all troubleshooting steps?',
        'Need help with a specific component?',
      ],
    };
  }

  /**
   * Handle configuration intents
   */
  private async handleConfigurationIntent(input: string, context: UserContext): Promise<CopilotResponse> {
    const component = this.extractComponentFromInput(input);
    const operation = this.extractOperationFromInput(input);

    return await this.getConfigurationAssistance(component, operation, context);
  }

  /**
   * Handle cost-related intents
   */
  private async handleCostIntent(input: string, context: UserContext): Promise<CopilotResponse> {
    try {
      const usageStats = controlPlaneOrchestrator.getUsageStats(context.workspaceId);
      const budgetConfig = controlPlaneOrchestrator.getBudgetConfig(context.workspaceId);

      let response = `**Cost Overview for Workspace**\n\n`;
      response += `💰 **Total Cost:** $${(usageStats.totalCost / 100).toFixed(2)}\n`;
      response += `📊 **Usage Records:** ${usageStats.totalRecords}\n`;
      
      if (usageStats.lastUpdate) {
        response += `🕒 **Last Updated:** ${usageStats.lastUpdate.toLocaleString()}\n`;
      }

      if (budgetConfig) {
        const budgetUsed = (usageStats.totalCost / budgetConfig.monthlyLimit) * 100;
        response += `\n**Budget Status:**\n`;
        response += `📈 **Monthly Limit:** $${(budgetConfig.monthlyLimit / 100).toFixed(2)}\n`;
        response += `📊 **Used:** ${budgetUsed.toFixed(1)}%\n`;
        
        if (budgetUsed > 80) {
          response += `⚠️ **Warning:** Approaching budget limit\n`;
        }
      }

      const actions: CopilotAction[] = [{
        type: 'monitor',
        description: 'Generate detailed cost report',
        parameters: { 
          workspaceId: context.workspaceId,
          period: 'current_month',
        },
        estimatedTime: '30 seconds',
        riskLevel: 'low',
      }];

      return {
        intent: 'cost',
        confidence: 0.9,
        response,
        actions,
        followUp: [
          'Would you like a detailed cost breakdown?',
          'Should I set up budget alerts?',
          'Need cost optimization recommendations?',
        ],
      };

    } catch (error) {
      return {
        intent: 'cost',
        confidence: 0.7,
        response: `I couldn't retrieve cost information: ${error instanceof Error ? error.message : 'Unknown error'}. This might be because cost tracking is disabled or there's a connectivity issue.`,
        actions: [{
          type: 'configure',
          description: 'Enable cost tracking',
          parameters: { workspaceId: context.workspaceId },
          estimatedTime: '1 minute',
          riskLevel: 'low',
        }],
      };
    }
  }

  /**
   * Handle guidance and help intents
   */
  private async handleGuidanceIntent(input: string, context: UserContext): Promise<CopilotResponse> {
    const topic = this.extractTopicFromInput(input);
    const guidance = this.getTopicGuidance(topic, context);

    return {
      intent: 'guidance',
      confidence: 0.8,
      response: guidance.response,
      actions: guidance.actions,
      followUp: guidance.followUp,
    };
  }

  /**
   * Handle unknown intents
   */
  private handleUnknownIntent(input: string, context: UserContext): CopilotResponse {
    const suggestions = this.generateSuggestions(input);

    return {
      intent: 'unknown',
      confidence: 0.1,
      response: `I'm not sure I understand what you're asking. Here are some things I can help you with:\n\n${suggestions.join('\n')}`,
      followUp: [
        'Would you like help with deployment?',
        'Need system status information?',
        'Looking for troubleshooting assistance?',
      ],
    };
  }

  /**
   * Get deployment guidance for specific steps
   */
  private getDeploymentGuidance(step: DeploymentStep): GuidanceResponse {
    const guidanceMap: Record<string, GuidanceResponse> = {
      'validate-prerequisites': {
        step: 'validate-prerequisites',
        instructions: 'Validating deployment prerequisites and dependencies',
        commands: ['docker --version', 'docker-compose --version'],
        warnings: ['Ensure Docker is running and accessible'],
        nextSteps: ['Configure deployment parameters', 'Review component dependencies'],
        estimatedTime: '30 seconds',
      },
      'configure-components': {
        step: 'configure-components',
        instructions: 'Configuring system components and dependencies',
        commands: ['docker-compose config', 'docker network ls'],
        warnings: ['Review configuration for Spain residency mode if enabled'],
        nextSteps: ['Deploy database components', 'Initialize storage systems'],
        estimatedTime: '2-3 minutes',
      },
      'deploy-database': {
        step: 'deploy-database',
        instructions: 'Deploying PostgreSQL database with proper configuration',
        commands: ['docker-compose up -d postgres', 'docker-compose logs postgres'],
        warnings: ['Database initialization may take 1-2 minutes'],
        nextSteps: ['Deploy Redis cache', 'Configure MinIO storage'],
        estimatedTime: '3-5 minutes',
      },
      'deploy-storage': {
        step: 'deploy-storage',
        instructions: 'Deploying MinIO object storage and Qdrant vector database',
        commands: ['docker-compose up -d minio qdrant', 'docker-compose ps'],
        warnings: ['Ensure sufficient disk space for storage components'],
        nextSteps: ['Deploy gateway services', 'Configure policy engine'],
        estimatedTime: '2-4 minutes',
      },
      'deploy-services': {
        step: 'deploy-services',
        instructions: 'Deploying core services (Gateway, Policy Engine, Runtime)',
        commands: ['docker-compose up -d gateway policy-engine runtime'],
        warnings: ['Services may take 2-3 minutes to fully initialize'],
        nextSteps: ['Verify deployment', 'Run health checks'],
        estimatedTime: '5-8 minutes',
      },
      'verify-deployment': {
        step: 'verify-deployment',
        instructions: 'Verifying deployment success and running health checks',
        commands: ['curl http://localhost:8080/health', 'docker-compose ps'],
        warnings: ['All services should show "healthy" status'],
        nextSteps: ['Configure workspace settings', 'Set up user access'],
        estimatedTime: '1-2 minutes',
      },
    };

    return guidanceMap[step.step] || {
      step: step.step,
      instructions: `Executing deployment step: ${step.description}`,
      estimatedTime: step.estimatedTime || '2-5 minutes',
      nextSteps: ['Continue with next deployment step'],
    };
  }

  /**
   * Generate troubleshooting guide for system errors
   */
  private generateTroubleshootingGuide(error: SystemError): TroubleshootingGuide {
    const troubleshootingMap: Record<string, TroubleshootingGuide> = {
      'database_connection': {
        diagnosis: 'Database connection failure detected',
        confidence: 0.9,
        steps: [
          {
            step: 1,
            description: 'Check if PostgreSQL container is running',
            command: 'docker-compose ps postgres',
            expectedResult: 'Container should show "Up" status',
          },
          {
            step: 2,
            description: 'Verify database connectivity',
            command: 'docker-compose exec postgres pg_isready',
            expectedResult: 'Should return "accepting connections"',
          },
          {
            step: 3,
            description: 'Check database logs for errors',
            command: 'docker-compose logs postgres --tail=50',
            expectedResult: 'Look for connection or authentication errors',
          },
        ],
        preventionTips: [
          'Ensure PostgreSQL has sufficient memory allocation',
          'Monitor connection pool usage',
          'Set up database health monitoring',
        ],
        escalationPath: 'Contact database administrator if issues persist',
      },
      'redis_connection': {
        diagnosis: 'Redis cache connection failure',
        confidence: 0.85,
        steps: [
          {
            step: 1,
            description: 'Check Redis container status',
            command: 'docker-compose ps redis',
            expectedResult: 'Container should be running',
          },
          {
            step: 2,
            description: 'Test Redis connectivity',
            command: 'docker-compose exec redis redis-cli ping',
            expectedResult: 'Should return "PONG"',
          },
          {
            step: 3,
            description: 'Check Redis memory usage',
            command: 'docker-compose exec redis redis-cli info memory',
            expectedResult: 'Verify memory usage is within limits',
          },
        ],
        preventionTips: [
          'Monitor Redis memory usage',
          'Configure appropriate maxmemory settings',
          'Set up Redis persistence if needed',
        ],
      },
      'high_response_time': {
        diagnosis: 'System experiencing high response times',
        confidence: 0.8,
        steps: [
          {
            step: 1,
            description: 'Check system resource usage',
            command: 'docker stats --no-stream',
            expectedResult: 'CPU and memory usage should be reasonable',
          },
          {
            step: 2,
            description: 'Analyze service logs for bottlenecks',
            command: 'docker-compose logs --tail=100',
            expectedResult: 'Look for slow query or processing warnings',
          },
          {
            step: 3,
            description: 'Check network connectivity',
            command: 'ping -c 4 localhost',
            expectedResult: 'Network latency should be low',
          },
        ],
        preventionTips: [
          'Implement caching strategies',
          'Monitor and optimize database queries',
          'Scale resources based on usage patterns',
        ],
      },
    };

    const guide = troubleshootingMap[error.type] || {
      diagnosis: `General system issue detected: ${error.message}`,
      confidence: 0.6,
      steps: [
        {
          step: 1,
          description: 'Check overall system health',
          command: 'docker-compose ps',
          expectedResult: 'All services should be running',
        },
        {
          step: 2,
          description: 'Review system logs',
          command: 'docker-compose logs --tail=50',
          expectedResult: 'Look for error messages or warnings',
        },
        {
          step: 3,
          description: 'Restart affected services',
          command: `docker-compose restart ${error.component}`,
          expectedResult: 'Service should restart successfully',
        },
      ],
      preventionTips: [
        'Implement comprehensive monitoring',
        'Set up automated health checks',
        'Maintain regular system updates',
      ],
    };

    return guide;
  }

  /**
   * Get configuration guidance for components
   */
  private getConfigurationGuide(component: string, operation: string): any {
    const configMap: Record<string, any> = {
      'spain-residency': {
        instructions: 'Configuring Spain residency mode ensures all data processing occurs within Spanish jurisdiction.',
        actions: [{
          type: 'configure',
          description: 'Enable Spain residency mode',
          parameters: { spainResidencyMode: true },
          riskLevel: 'low',
        }],
        nextSteps: [
          'Verify geographic restrictions are enforced',
          'Test data residency compliance',
          'Configure audit logging for compliance',
        ],
      },
      'air-gapped': {
        instructions: 'Air-gapped mode configures the system for complete offline operation.',
        actions: [{
          type: 'configure',
          description: 'Enable air-gapped deployment mode',
          parameters: { airGappedMode: true },
          riskLevel: 'medium',
        }],
        nextSteps: [
          'Verify network isolation',
          'Test offline model loading',
          'Configure secure update mechanisms',
        ],
      },
      'budget': {
        instructions: 'Budget configuration helps control AI usage costs and provides alerts.',
        actions: [{
          type: 'configure',
          description: 'Set up budget limits and alerts',
          parameters: { budgetConfig: true },
          riskLevel: 'low',
        }],
        nextSteps: [
          'Set monthly spending limits',
          'Configure alert thresholds',
          'Enable cost tracking',
        ],
      },
    };

    return configMap[component] || {
      instructions: `Configuration guidance for ${component} is not available. Please refer to the documentation.`,
      actions: [],
      nextSteps: ['Check component documentation', 'Contact support if needed'],
    };
  }

  /**
   * Extract error keywords from user input
   */
  private extractErrorKeywords(input: string): any {
    const keywords = {
      type: 'general',
      component: 'system',
      severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    };

    const lowerInput = input.toLowerCase();

    // Detect error types
    if (lowerInput.includes('database') || lowerInput.includes('postgres')) {
      keywords.type = 'database_connection';
      keywords.component = 'database';
    } else if (lowerInput.includes('redis') || lowerInput.includes('cache')) {
      keywords.type = 'redis_connection';
      keywords.component = 'redis';
    } else if (lowerInput.includes('slow') || lowerInput.includes('timeout')) {
      keywords.type = 'high_response_time';
    }

    // Detect severity
    if (lowerInput.includes('critical') || lowerInput.includes('down') || lowerInput.includes('failed')) {
      keywords.severity = 'critical';
    } else if (lowerInput.includes('urgent') || lowerInput.includes('broken')) {
      keywords.severity = 'high';
    }

    return keywords;
  }

  /**
   * Extract component name from user input
   */
  private extractComponentFromInput(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('spain') || lowerInput.includes('residency')) return 'spain-residency';
    if (lowerInput.includes('air-gapped') || lowerInput.includes('offline')) return 'air-gapped';
    if (lowerInput.includes('budget') || lowerInput.includes('cost')) return 'budget';
    if (lowerInput.includes('database') || lowerInput.includes('postgres')) return 'database';
    if (lowerInput.includes('redis') || lowerInput.includes('cache')) return 'redis';
    
    return 'general';
  }

  /**
   * Extract operation from user input
   */
  private extractOperationFromInput(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('enable') || lowerInput.includes('turn on')) return 'enable';
    if (lowerInput.includes('disable') || lowerInput.includes('turn off')) return 'disable';
    if (lowerInput.includes('configure') || lowerInput.includes('setup')) return 'configure';
    if (lowerInput.includes('update') || lowerInput.includes('change')) return 'update';
    
    return 'configure';
  }

  /**
   * Extract topic from guidance input
   */
  private extractTopicFromInput(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('deploy')) return 'deployment';
    if (lowerInput.includes('troubleshoot')) return 'troubleshooting';
    if (lowerInput.includes('configure')) return 'configuration';
    if (lowerInput.includes('cost') || lowerInput.includes('budget')) return 'cost-management';
    
    return 'general';
  }

  /**
   * Get topic-specific guidance
   */
  private getTopicGuidance(topic: string, context: UserContext): any {
    const guidanceMap: Record<string, any> = {
      'deployment': {
        response: `**Deployment Guide**\n\nMobius 1 deployment follows these key steps:\n1. **Prerequisites** - Validate Docker and dependencies\n2. **Configuration** - Set up component parameters\n3. **Component Deployment** - Deploy in dependency order\n4. **Verification** - Run health checks\n\nThe entire process should complete within 15 minutes.`,
        actions: [{
          type: 'deploy',
          description: 'Start guided deployment',
          parameters: { workspaceId: context.workspaceId },
          riskLevel: 'medium',
        }],
        followUp: ['Ready to start deployment?', 'Need help with configuration?'],
      },
      'troubleshooting': {
        response: `**Troubleshooting Guide**\n\nCommon issues and solutions:\n• **Database Connection** - Check PostgreSQL container status\n• **High Response Time** - Monitor resource usage\n• **Service Failures** - Review logs and restart services\n\nI can help diagnose specific issues automatically.`,
        actions: [{
          type: 'troubleshoot',
          description: 'Run system diagnostics',
          parameters: { workspaceId: context.workspaceId },
          riskLevel: 'low',
        }],
        followUp: ['What specific issue are you experiencing?', 'Should I run diagnostics?'],
      },
      'cost-management': {
        response: `**Cost Management Guide**\n\nControl your AI infrastructure costs:\n• **Budget Limits** - Set monthly spending caps\n• **Usage Tracking** - Monitor token and compute usage\n• **Alerts** - Get notified at 80% budget threshold\n• **Optimization** - Receive cost-saving recommendations`,
        actions: [{
          type: 'configure',
          description: 'Set up cost controls',
          parameters: { workspaceId: context.workspaceId },
          riskLevel: 'low',
        }],
        followUp: ['Want to set up budget alerts?', 'Need current usage information?'],
      },
    };

    return guidanceMap[topic] || {
      response: 'I can help you with deployment, troubleshooting, configuration, and cost management. What would you like to know more about?',
      actions: [],
      followUp: ['What specific topic interests you?'],
    };
  }

  /**
   * Generate suggestions for unknown intents
   */
  private generateSuggestions(input: string): string[] {
    return [
      '🚀 **Deploy infrastructure** - "Deploy Mobius 1 with Spain residency mode"',
      '📊 **Check system status** - "What\'s the current system status?"',
      '🔧 **Troubleshoot issues** - "Help me fix database connection problems"',
      '⚙️ **Configure components** - "How do I enable air-gapped mode?"',
      '💰 **Manage costs** - "Show me current usage and costs"',
      '📚 **Get guidance** - "How do I deploy the system step by step?"',
    ];
  }

  /**
   * Store conversation history for context
   */
  private storeConversation(userId: string, input: string, response: CopilotResponse): void {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }

    const history = this.conversationHistory.get(userId)!;
    history.push({
      timestamp: new Date(),
      input,
      response: response.response,
      intent: response.intent,
      confidence: response.confidence,
    });

    // Keep only last 10 interactions
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Initialize knowledge base with common patterns and responses
   */
  private initializeKnowledgeBase(): void {
    this.knowledgeBase.set('deployment_time_limit', 900); // 15 minutes in seconds
    this.knowledgeBase.set('health_check_interval', 30); // 30 seconds
    this.knowledgeBase.set('supported_languages', ['en', 'es']);
    this.knowledgeBase.set('spain_residency_compliance', true);
    this.knowledgeBase.set('air_gapped_support', true);
  }

  /**
   * Get conversation history for user
   */
  getConversationHistory(userId: string): any[] {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Clear conversation history for user
   */
  clearConversationHistory(userId: string): void {
    this.conversationHistory.delete(userId);
  }
}

/**
 * Global AI Copilot instance
 */
export const aiCopilot = new AICopilot();

// Type augmentation for EventEmitter
interface AICopilotInterface {
  on<K extends keyof CopilotEvents>(event: K, listener: CopilotEvents[K]): this;
  emit<K extends keyof CopilotEvents>(event: K, ...args: Parameters<CopilotEvents[K]>): boolean;
}