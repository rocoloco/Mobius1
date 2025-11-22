/**
 * Coolify Deployment Example
 * 
 * Demonstrates how to use the Coolify driver for deploying Mobius 1 platform
 * Implements NFR-008 requirement for identical blueprint deployability
 */

import { DeploymentManager } from '../src/control-plane/deployment.js';
import { createDeploymentDriver, getRecommendedDriver } from '../src/control-plane/drivers/registry.js';
import type { DeploymentConfig } from '../src/control-plane/types.js';
import type { CoolifyConfig } from '../src/control-plane/drivers/coolify.js';
import type { DeploymentOptions } from '../src/control-plane/drivers/types.js';

/**
 * Example Coolify deployment configuration
 */
async function deployCoolifyExample() {
  console.log('🚀 Starting Coolify deployment example...');

  // Step 1: Define deployment configuration
  const deploymentConfig: DeploymentConfig = {
    workspaceId: 'workspace-gestoria-madrid',
    environment: 'production',
    spainResidencyMode: true, // Enforce Spain-only data residency
    airGappedMode: false,
    components: [
      // Database component
      {
        name: 'postgres-main',
        type: 'database',
        enabled: true,
        config: {
          tag: '15-alpine',
          environment: {
            POSTGRES_DB: 'mobius',
            POSTGRES_USER: 'mobius',
            POSTGRES_PASSWORD: 'secure-password-here',
          },
          volumes: [
            {
              source: 'postgres-data',
              target: '/var/lib/postgresql/data',
              type: 'volume',
            },
          ],
          resources: {
            cpu: { limit: '1', request: '500m' },
            memory: { limit: '2Gi', request: '1Gi' },
          },
        },
        dependencies: [],
      },
      
      // Redis component
      {
        name: 'redis-cache',
        type: 'redis',
        enabled: true,
        config: {
          tag: '7-alpine',
          environment: {
            REDIS_PASSWORD: 'redis-password-here',
          },
          resources: {
            cpu: { limit: '500m', request: '250m' },
            memory: { limit: '1Gi', request: '512Mi' },
          },
        },
        dependencies: [],
      },
      
      // MinIO object storage
      {
        name: 'minio-storage',
        type: 'minio',
        enabled: true,
        config: {
          tag: 'latest',
          environment: {
            MINIO_ROOT_USER: 'minioadmin',
            MINIO_ROOT_PASSWORD: 'minio-password-here',
          },
          volumes: [
            {
              source: 'minio-data',
              target: '/data',
              type: 'volume',
            },
          ],
          resources: {
            cpu: { limit: '1', request: '500m' },
            memory: { limit: '2Gi', request: '1Gi' },
          },
        },
        dependencies: [],
      },
      
      // Qdrant vector database
      {
        name: 'qdrant-vectors',
        type: 'qdrant',
        enabled: true,
        config: {
          tag: 'latest',
          volumes: [
            {
              source: 'qdrant-data',
              target: '/qdrant/storage',
              type: 'volume',
            },
          ],
          resources: {
            cpu: { limit: '1', request: '500m' },
            memory: { limit: '2Gi', request: '1Gi' },
          },
        },
        dependencies: [],
      },
      
      // API Gateway
      {
        name: 'api-gateway',
        type: 'gateway',
        enabled: true,
        config: {
          tag: 'latest',
          environment: {
            DATABASE_URL: 'postgresql://mobius:secure-password-here@postgres-main:5432/mobius',
            REDIS_URL: 'redis://redis-cache:6379',
            MINIO_ENDPOINT: 'minio-storage:9000',
            QDRANT_URL: 'http://qdrant-vectors:6333',
            SPAIN_RESIDENCY_MODE: 'true',
          },
          resources: {
            cpu: { limit: '2', request: '1' },
            memory: { limit: '4Gi', request: '2Gi' },
          },
        },
        dependencies: ['postgres-main', 'redis-cache', 'minio-storage', 'qdrant-vectors'],
      },
      
      // AI Runtime
      {
        name: 'ai-runtime',
        type: 'runtime',
        enabled: true,
        config: {
          tag: 'latest',
          environment: {
            MODEL_PATH: '/models',
            RUNTIME_TYPE: 'vllm',
            SPAIN_RESIDENCY_MODE: 'true',
          },
          volumes: [
            {
              source: 'ai-models',
              target: '/models',
              type: 'volume',
            },
          ],
          resources: {
            cpu: { limit: '4', request: '2' },
            memory: { limit: '8Gi', request: '4Gi' },
          },
        },
        dependencies: ['postgres-main', 'redis-cache'],
      },
    ],
    resources: {
      cpu: { limit: '10', request: '5' },
      memory: { limit: '20Gi', request: '10Gi' },
      storage: { size: '100Gi', class: 'ssd' },
    },
  };

  // Step 2: Configure Coolify driver
  const coolifyConfig: CoolifyConfig = {
    name: 'mobius-coolify',
    version: '4.0.0',
    environment: 'production',
    spainResidencyMode: true,
    airGappedMode: false,
    coolifyUrl: process.env.COOLIFY_URL || 'https://coolify.gestoria-madrid.es',
    apiToken: process.env.COOLIFY_API_TOKEN || 'your-api-token-here',
    projectId: process.env.COOLIFY_PROJECT_ID || 'mobius-platform',
    serverId: process.env.COOLIFY_SERVER_ID || 'server-madrid-1',
    networkName: 'mobius-network',
    domain: 'gestoria-madrid.es',
    enableTraefik: true,
    enableSSL: true,
  };

  // Step 3: Get driver recommendation
  const recommendedDriver = getRecommendedDriver('production', {
    spainResidencyMode: true,
    complexity: 'moderate',
    scalability: 'medium',
  });
  
  console.log(`📋 Recommended driver: ${recommendedDriver}`);

  try {
    // Step 4: Create and initialize driver
    console.log('🔧 Initializing Coolify driver...');
    const driver = await createDeploymentDriver('coolify', coolifyConfig);
    
    // Step 5: Perform health check
    console.log('🏥 Performing health check...');
    const healthCheck = await driver.healthCheck();
    if (!healthCheck.healthy) {
      throw new Error(`Driver health check failed: ${healthCheck.error}`);
    }
    console.log(`✅ Health check passed (${healthCheck.responseTime}ms)`);

    // Step 6: Deploy using deployment manager
    console.log('🚀 Starting deployment...');
    const deploymentManager = new DeploymentManager();
    
    const deploymentOptions: DeploymentOptions = {
      driverType: 'coolify',
      driverConfig: coolifyConfig,
      timeout: 900000, // 15 minutes
      retries: 3,
    };

    const result = await deploymentManager.deployWithDriver(deploymentConfig, deploymentOptions);

    // Step 7: Report results
    if (result.success) {
      console.log('🎉 Deployment successful!');
      console.log(`📊 Deployment ID: ${result.deploymentId}`);
      console.log(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
      console.log(`📦 Components deployed: ${result.components.length}`);
      
      // List deployed components
      result.components.forEach(component => {
        const status = component.status === 'success' ? '✅' : '❌';
        console.log(`  ${status} ${component.name} (${Math.round(component.duration / 1000)}s)`);
      });

      // Step 8: Monitor deployment status
      console.log('\n🔍 Checking deployment status...');
      const status = await driver.getStatus();
      console.log(`📈 Overall status: ${status.overall}`);
      console.log(`🔧 Services: ${status.services.length}`);
      
      status.services.forEach(service => {
        const healthIcon = service.health === 'healthy' ? '💚' : service.health === 'unhealthy' ? '❤️' : '💛';
        console.log(`  ${healthIcon} ${service.name}: ${service.status} (${service.health})`);
      });

    } else {
      console.error('❌ Deployment failed!');
      console.error(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
      console.error(`🚨 Errors: ${result.errors.length}`);
      
      result.errors.forEach(error => {
        console.error(`  • ${error.component}: ${error.error}`);
        if (error.remediation) {
          console.error(`    💡 Remediation: ${error.remediation}`);
        }
      });
    }

    return result;

  } catch (error) {
    console.error('💥 Deployment failed with exception:', error);
    throw error;
  }
}

/**
 * Example of scaling services with Coolify
 */
async function scalingExample() {
  console.log('\n🔄 Scaling example...');

  const coolifyConfig: CoolifyConfig = {
    name: 'mobius-coolify',
    version: '4.0.0',
    environment: 'production',
    spainResidencyMode: true,
    airGappedMode: false,
    coolifyUrl: process.env.COOLIFY_URL || 'https://coolify.gestoria-madrid.es',
    apiToken: process.env.COOLIFY_API_TOKEN || 'your-api-token-here',
    projectId: process.env.COOLIFY_PROJECT_ID || 'mobius-platform',
    serverId: process.env.COOLIFY_SERVER_ID || 'server-madrid-1',
    enableTraefik: true,
    enableSSL: true,
  };

  try {
    const driver = await createDeploymentDriver('coolify', coolifyConfig);

    // Scale API gateway to handle more load
    console.log('📈 Scaling API gateway...');
    try {
      await driver.scale('api-gateway', 3);
      console.log('✅ API gateway scaled to 3 replicas');
    } catch (error) {
      console.log('ℹ️  Scaling not yet implemented for Coolify driver');
    }

    // Restart a service
    console.log('🔄 Restarting Redis cache...');
    await driver.restart('redis-cache');
    console.log('✅ Redis cache restarted');

    // Get service logs
    console.log('📋 Getting API gateway logs...');
    const logs = await driver.getLogs('api-gateway', 50);
    console.log('📄 Recent logs:');
    console.log(logs.split('\n').slice(-5).join('\n'));

  } catch (error) {
    console.error('❌ Scaling example failed:', error);
  }
}

/**
 * Example of air-gapped deployment
 */
async function airGappedExample() {
  console.log('\n🔒 Air-gapped deployment example...');

  const airGappedConfig: CoolifyConfig = {
    name: 'mobius-airgapped',
    version: '4.0.0',
    environment: 'production',
    spainResidencyMode: true,
    airGappedMode: true, // Enable air-gapped mode
    coolifyUrl: 'https://coolify.internal.local', // Internal Coolify instance
    apiToken: process.env.COOLIFY_INTERNAL_TOKEN || 'internal-token',
    projectId: 'mobius-secure',
    serverId: 'secure-server-1',
    networkName: 'secure-network',
    enableTraefik: false, // Disable external routing
    enableSSL: false, // Internal SSL handled separately
  };

  const deploymentConfig: DeploymentConfig = {
    workspaceId: 'secure-workspace',
    environment: 'production',
    spainResidencyMode: true,
    airGappedMode: true,
    components: [
      {
        name: 'secure-database',
        type: 'database',
        enabled: true,
        config: {
          tag: '15-alpine',
          environment: {
            POSTGRES_DB: 'mobius_secure',
            POSTGRES_USER: 'mobius',
            POSTGRES_PASSWORD: 'ultra-secure-password',
          },
        },
        dependencies: [],
      },
      {
        name: 'secure-gateway',
        type: 'gateway',
        enabled: true,
        config: {
          tag: 'latest',
          environment: {
            AIR_GAPPED_MODE: 'true',
            EXTERNAL_ACCESS: 'false',
          },
        },
        dependencies: ['secure-database'],
      },
    ],
    resources: {
      cpu: { limit: '4', request: '2' },
      memory: { limit: '8Gi', request: '4Gi' },
      storage: { size: '50Gi' },
    },
  };

  try {
    const driver = await createDeploymentDriver('coolify', airGappedConfig);
    const deploymentManager = new DeploymentManager();
    
    const result = await deploymentManager.deployWithDriver(deploymentConfig, {
      driverType: 'coolify',
      driverConfig: airGappedConfig,
    });

    if (result.success) {
      console.log('🔒 Air-gapped deployment successful!');
      console.log('🛡️  All services running in secure, isolated environment');
    } else {
      console.error('❌ Air-gapped deployment failed');
    }

  } catch (error) {
    console.error('💥 Air-gapped deployment error:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Run main deployment example
    await deployCoolifyExample();
    
    // Run scaling example
    await scalingExample();
    
    // Run air-gapped example
    await airGappedExample();
    
    console.log('\n🎯 All examples completed successfully!');
    
  } catch (error) {
    console.error('💥 Example execution failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  deployCoolifyExample,
  scalingExample,
  airGappedExample,
};