/**
 * Deployment Validation and Dependency Checking
 * Implements deployment validation logic for FR-001 (Private Deployment)
 */

import { appConfig } from '../config/index.js';
import { DatabaseClient } from '../database/client.js';
import { driverRegistry, getRecommendedDriver } from './drivers/registry.js';
import type { DeploymentDriver, DeploymentOptions } from './drivers/types.js';
import type {
  DeploymentConfig,
  DeploymentResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ComponentConfig,
  ComponentDeploymentResult,
  DeploymentError,
} from './types.js';

/**
 * Deployment Validator
 * Validates deployment configuration and dependencies
 */
export class DeploymentValidator {
  /**
   * Validate deployment configuration
   */
  async validateDeployment(config: DeploymentConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate basic configuration
    this.validateBasicConfig(config, errors);

    // Validate component dependencies
    this.validateDependencies(config, errors, warnings);

    // Validate resource requirements
    this.validateResources(config, errors, warnings);

    // Validate Spain residency mode requirements
    if (config.spainResidencyMode) {
      this.validateSpainResidencyMode(config, errors, warnings);
    }

    // Validate air-gapped mode requirements
    if (config.airGappedMode) {
      this.validateAirGappedMode(config, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate basic configuration parameters
   */
  private validateBasicConfig(config: DeploymentConfig, errors: ValidationError[]): void {
    if (!config.workspaceId) {
      errors.push({
        component: 'deployment',
        field: 'workspaceId',
        message: 'Workspace ID is required',
        severity: 'error',
      });
    }

    if (!['development', 'production', 'test'].includes(config.environment)) {
      errors.push({
        component: 'deployment',
        field: 'environment',
        message: 'Environment must be development, production, or test',
        severity: 'error',
      });
    }

    if (!config.components || config.components.length === 0) {
      errors.push({
        component: 'deployment',
        field: 'components',
        message: 'At least one component must be configured',
        severity: 'error',
      });
    }
  }

  /**
   * Validate component dependencies
   */
  private validateDependencies(
    config: DeploymentConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const componentNames = new Set(config.components.map(c => c.name));
    const dependencyGraph = new Map<string, string[]>();

    // Build dependency graph
    for (const component of config.components) {
      dependencyGraph.set(component.name, component.dependencies || []);

      // Check if dependencies exist
      for (const dep of component.dependencies || []) {
        if (!componentNames.has(dep)) {
          errors.push({
            component: component.name,
            field: 'dependencies',
            message: `Dependency '${dep}' not found in component list`,
            severity: 'error',
          });
        }
      }
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(dependencyGraph);
    if (circularDeps.length > 0) {
      errors.push({
        component: 'deployment',
        field: 'dependencies',
        message: `Circular dependencies detected: ${circularDeps.join(' -> ')}`,
        severity: 'error',
      });
    }

    // Validate required components for different modes
    this.validateRequiredComponents(config, errors, warnings);
  }

  /**
   * Detect circular dependencies in component graph
   */
  private detectCircularDependencies(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const nodes = Array.from(graph.keys());
    for (const node of nodes) {
      if (!visited.has(node)) {
        const cycle = this.dfsCircularCheck(node, graph, visited, recursionStack, path);
        if (cycle.length > 0) {
          return cycle;
        }
      }
    }

    return [];
  }

  /**
   * DFS helper for circular dependency detection
   */
  private dfsCircularCheck(
    node: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = this.dfsCircularCheck(neighbor, graph, visited, recursionStack, path);
        if (cycle.length > 0) {
          return cycle;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found cycle - return path from neighbor to current node
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart).concat([neighbor]);
      }
    }

    recursionStack.delete(node);
    path.pop();
    return [];
  }

  /**
   * Validate required components for different deployment modes
   */
  private validateRequiredComponents(
    config: DeploymentConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const componentTypes = new Set(config.components.map(c => c.type));

    // Required components for all deployments
    const requiredComponents = ['database', 'redis'];
    
    for (const required of requiredComponents) {
      if (!componentTypes.has(required as any)) {
        errors.push({
          component: 'deployment',
          field: 'components',
          message: `Required component '${required}' is missing`,
          severity: 'error',
        });
      }
    }

    // Recommended components
    const recommendedComponents = ['minio', 'qdrant'];
    
    for (const recommended of recommendedComponents) {
      if (!componentTypes.has(recommended as any)) {
        warnings.push({
          component: 'deployment',
          field: 'components',
          message: `Recommended component '${recommended}' is missing`,
          recommendation: `Consider adding ${recommended} for full functionality`,
        });
      }
    }
  }

  /**
   * Validate resource requirements
   */
  private validateResources(
    config: DeploymentConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!config.resources) {
      errors.push({
        component: 'deployment',
        field: 'resources',
        message: 'Resource configuration is required',
        severity: 'error',
      });
      return;
    }

    // Validate CPU resources
    if (!config.resources.cpu?.limit || !config.resources.cpu?.request) {
      errors.push({
        component: 'deployment',
        field: 'resources.cpu',
        message: 'CPU limit and request must be specified',
        severity: 'error',
      });
    }

    // Validate memory resources
    if (!config.resources.memory?.limit || !config.resources.memory?.request) {
      errors.push({
        component: 'deployment',
        field: 'resources.memory',
        message: 'Memory limit and request must be specified',
        severity: 'error',
      });
    }

    // Validate storage
    if (!config.resources.storage?.size) {
      errors.push({
        component: 'deployment',
        field: 'resources.storage',
        message: 'Storage size must be specified',
        severity: 'error',
      });
    }
  }

  /**
   * Validate Spain residency mode requirements
   */
  private validateSpainResidencyMode(
    config: DeploymentConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // In Spain residency mode, ensure no external dependencies
    const externalComponents = config.components.filter(c => 
      c.config?.external === true || c.config?.region !== 'ES'
    );

    if (externalComponents.length > 0) {
      errors.push({
        component: 'deployment',
        field: 'spainResidencyMode',
        message: `Spain residency mode requires all components to be in Spain. External components: ${externalComponents.map(c => c.name).join(', ')}`,
        severity: 'error',
      });
    }

    warnings.push({
      component: 'deployment',
      field: 'spainResidencyMode',
      message: 'Spain residency mode is enabled - ensure compliance with data residency requirements',
      recommendation: 'Verify all data processing occurs within Spanish jurisdiction',
    });
  }

  /**
   * Validate air-gapped mode requirements
   */
  private validateAirGappedMode(
    config: DeploymentConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // In air-gapped mode, no external network access should be configured
    const networkComponents = config.components.filter(c => 
      c.config?.externalAccess === true || c.config?.internetAccess === true
    );

    if (networkComponents.length > 0) {
      errors.push({
        component: 'deployment',
        field: 'airGappedMode',
        message: `Air-gapped mode requires no external network access. Components with external access: ${networkComponents.map(c => c.name).join(', ')}`,
        severity: 'error',
      });
    }

    warnings.push({
      component: 'deployment',
      field: 'airGappedMode',
      message: 'Air-gapped mode is enabled - ensure all dependencies are pre-installed',
      recommendation: 'Verify offline operation capabilities and update mechanisms',
    });
  }
}

/**
 * Deployment Manager
 * Manages deployment lifecycle and execution with multi-driver support
 */
export class DeploymentManager {
  private validator = new DeploymentValidator();

  /**
   * Deploy infrastructure using specified driver
   * Implements NFR-008 requirement for identical blueprint deployability
   */
  async deployWithDriver(config: DeploymentConfig, options: DeploymentOptions): Promise<DeploymentResult> {
    const startTime = new Date();
    const deploymentId = `${options.driverType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Step 1: Validate configuration
      const validation = await this.validator.validateDeployment(config);
      if (!validation.valid) {
        const validationErrors = validation.errors.map(err => ({
          component: err.component,
          error: `Validation failed: ${err.message}`,
          remediation: 'Fix configuration and retry deployment',
          recoverable: true,
        }));
        
        return {
          success: false,
          deploymentId,
          startTime,
          endTime: new Date(),
          duration: Date.now() - startTime.getTime(),
          components: [],
          errors: validationErrors,
        };
      }

      // Step 2: Create and initialize driver
      const driver = await driverRegistry.createDriver(options.driverType, options.driverConfig);

      // Step 3: Deploy using driver
      const result = await driver.deploy(config);
      
      // Update deployment ID to include driver info
      result.deploymentId = deploymentId;

      // Check 15-minute deployment requirement
      const fifteenMinutes = 15 * 60 * 1000;
      if (result.duration > fifteenMinutes) {
        result.errors.push({
          component: 'deployment',
          error: `Deployment exceeded 15-minute requirement (took ${Math.round(result.duration / 1000)}s)`,
          remediation: 'Optimize deployment process or increase resource allocation',
          recoverable: true,
        });
      }

      return result;

    } catch (error) {
      const endTime = new Date();
      
      return {
        success: false,
        deploymentId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        components: [],
        errors: [{
          component: 'deployment-manager',
          error: error instanceof Error ? error.message : 'Unknown deployment error',
          remediation: 'Check driver configuration and connectivity',
          recoverable: true,
        }],
      };
    }
  }

  /**
   * Deploy infrastructure based on configuration (legacy method)
   * Implements 15-minute deployment requirement from FR-001
   */
  async deployInfrastructure(config: DeploymentConfig): Promise<DeploymentResult> {
    const startTime = new Date();
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errors: DeploymentError[] = [];
    const componentResults: ComponentDeploymentResult[] = [];

    try {
      // Step 1: Validate configuration
      const validation = await this.validator.validateDeployment(config);
      if (!validation.valid) {
        const validationErrors = validation.errors.map(err => ({
          component: err.component,
          error: `Validation failed: ${err.message}`,
          remediation: 'Fix configuration and retry deployment',
          recoverable: true,
        }));
        
        return {
          success: false,
          deploymentId,
          startTime,
          endTime: new Date(),
          duration: Date.now() - startTime.getTime(),
          components: [],
          errors: validationErrors,
        };
      }

      // Step 2: Sort components by dependencies (topological sort)
      const sortedComponents = this.topologicalSort(config.components);

      // Step 3: Deploy components in dependency order
      for (const component of sortedComponents) {
        const componentResult = await this.deployComponent(component, config);
        componentResults.push(componentResult);

        if (componentResult.status === 'failed') {
          errors.push({
            component: component.name,
            error: componentResult.error || 'Unknown deployment error',
            remediation: this.getRemediationForComponent(component.type),
            recoverable: this.isRecoverableFailure(component.type),
          });

          // Stop deployment on critical component failure
          if (this.isCriticalComponent(component.type)) {
            break;
          }
        }
      }

      // Step 4: Verify deployment success
      const success = errors.length === 0 && componentResults.every(r => r.status === 'success');
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Check 15-minute deployment requirement
      const fifteenMinutes = 15 * 60 * 1000;
      if (duration > fifteenMinutes) {
        errors.push({
          component: 'deployment',
          error: `Deployment exceeded 15-minute requirement (took ${Math.round(duration / 1000)}s)`,
          remediation: 'Optimize deployment process or increase resource allocation',
          recoverable: true,
        });
      }

      return {
        success,
        deploymentId,
        startTime,
        endTime,
        duration,
        components: componentResults,
        errors,
      };

    } catch (error) {
      const endTime = new Date();
      
      return {
        success: false,
        deploymentId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        components: componentResults,
        errors: [{
          component: 'deployment',
          error: error instanceof Error ? error.message : 'Unknown deployment error',
          remediation: 'Check logs and retry deployment',
          recoverable: true,
        }],
      };
    }
  }

  /**
   * Deploy individual component
   */
  private async deployComponent(
    component: ComponentConfig,
    config: DeploymentConfig
  ): Promise<ComponentDeploymentResult> {
    const startTime = new Date();

    try {
      // Simulate component deployment based on type
      await this.executeComponentDeployment(component, config);

      const endTime = new Date();
      return {
        name: component.name,
        status: 'success',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      };

    } catch (error) {
      const endTime = new Date();
      return {
        name: component.name,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: error instanceof Error ? error.message : 'Unknown component error',
      };
    }
  }

  /**
   * Execute component-specific deployment logic
   */
  private async executeComponentDeployment(
    component: ComponentConfig,
    config: DeploymentConfig
  ): Promise<void> {
    // Simulate deployment time based on component type
    const deploymentTime = this.getComponentDeploymentTime(component.type);
    await new Promise(resolve => setTimeout(resolve, deploymentTime));

    // Perform component-specific validation
    switch (component.type) {
      case 'database':
        await this.validateDatabaseDeployment();
        break;
      case 'redis':
        await this.validateRedisDeployment();
        break;
      case 'minio':
        await this.validateMinIODeployment();
        break;
      case 'qdrant':
        await this.validateQdrantDeployment();
        break;
      default:
        // Generic validation for other components
        break;
    }
  }

  /**
   * Get estimated deployment time for component type
   */
  private getComponentDeploymentTime(type: string): number {
    const times = {
      database: 30000, // 30 seconds
      redis: 10000,    // 10 seconds
      minio: 20000,    // 20 seconds
      qdrant: 25000,   // 25 seconds
      gateway: 15000,  // 15 seconds
      runtime: 45000,  // 45 seconds
    };
    
    return times[type as keyof typeof times] || 10000;
  }

  /**
   * Validate database deployment
   */
  private async validateDatabaseDeployment(): Promise<void> {
    try {
      const isConnected = await DatabaseClient.testConnection();
      if (!isConnected) {
        throw new Error('Database connection validation failed');
      }
    } catch (error) {
      throw new Error(`Database deployment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Redis deployment
   */
  private async validateRedisDeployment(): Promise<void> {
    // Redis validation would go here
    // For now, simulate validation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Validate MinIO deployment
   */
  private async validateMinIODeployment(): Promise<void> {
    // MinIO validation would go here
    // For now, simulate validation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Validate Qdrant deployment
   */
  private async validateQdrantDeployment(): Promise<void> {
    // Qdrant validation would go here
    // For now, simulate validation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Topological sort of components based on dependencies
   */
  private topologicalSort(components: ComponentConfig[]): ComponentConfig[] {
    const graph = new Map<string, ComponentConfig>();
    const inDegree = new Map<string, number>();
    
    // Initialize graph and in-degree count
    for (const component of components) {
      graph.set(component.name, component);
      inDegree.set(component.name, 0);
    }

    // Calculate in-degrees
    for (const component of components) {
      for (const dep of component.dependencies || []) {
        if (inDegree.has(dep)) {
          inDegree.set(component.name, (inDegree.get(component.name) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm for topological sorting
    const queue: string[] = [];
    const result: ComponentConfig[] = [];

    // Find all nodes with no incoming edges
    const inDegreeEntries = Array.from(inDegree.entries());
    for (const [name, degree] of inDegreeEntries) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const component = graph.get(current)!;
      result.push(component);

      // For each dependent of current component
      for (const other of components) {
        if (other.dependencies?.includes(current)) {
          const newDegree = (inDegree.get(other.name) || 0) - 1;
          inDegree.set(other.name, newDegree);
          
          if (newDegree === 0) {
            queue.push(other.name);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get remediation advice for component type
   */
  private getRemediationForComponent(type: string): string {
    const remediations = {
      database: 'Check database connection string and ensure PostgreSQL is running',
      redis: 'Verify Redis configuration and network connectivity',
      minio: 'Check MinIO credentials and storage configuration',
      qdrant: 'Verify Qdrant service is accessible and properly configured',
      gateway: 'Check gateway configuration and dependencies',
      runtime: 'Verify runtime environment and model availability',
    };
    
    return remediations[type as keyof typeof remediations] || 'Check component configuration and logs';
  }

  /**
   * Check if component failure is recoverable
   */
  private isRecoverableFailure(type: string): boolean {
    // Most component failures are recoverable through retry or reconfiguration
    return true;
  }

  /**
   * Check if component is critical for deployment
   */
  private isCriticalComponent(type: string): boolean {
    const criticalComponents = ['database', 'redis'];
    return criticalComponents.includes(type);
  }
}

/**
 * Global deployment manager instance
 */
export const deploymentManager = new DeploymentManager();