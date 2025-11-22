# Coolify Deployment Driver

The Coolify deployment driver provides seamless integration with Coolify v4+ for deploying the Mobius 1 platform. This driver implements the unified deployment interface specified in NFR-008, ensuring identical blueprint deployability across Coolify, Kubernetes, and Nomad.

## Features

- **Coolify v4+ API Integration**: Full support for the latest Coolify API
- **Local Container Orchestration**: Deploy and manage containers on local infrastructure
- **Health Monitoring**: Comprehensive health checks and status monitoring
- **Spain Residency Mode**: Enforce data residency within Spanish jurisdiction
- **Air-Gapped Support**: Deploy in completely offline environments
- **Traefik Integration**: Automatic reverse proxy and SSL configuration
- **Self-Healing**: Automatic service restart and recovery capabilities

## Quick Start

### 1. Configure Coolify

First, ensure you have a Coolify v4+ instance running and obtain your API credentials:

```bash
# Set environment variables
export COOLIFY_URL="https://your-coolify-instance.com"
export COOLIFY_API_TOKEN="your-api-token"
export COOLIFY_PROJECT_ID="your-project-id"
export COOLIFY_SERVER_ID="your-server-id"
```

### 2. Basic Deployment

```typescript
import { createDeploymentDriver } from '../src/control-plane/drivers/registry.js';
import type { CoolifyConfig } from '../src/control-plane/drivers/coolify.js';

const config: CoolifyConfig = {
  name: 'mobius-coolify',
  version: '4.0.0',
  environment: 'production',
  spainResidencyMode: true,
  airGappedMode: false,
  coolifyUrl: process.env.COOLIFY_URL!,
  apiToken: process.env.COOLIFY_API_TOKEN!,
  projectId: process.env.COOLIFY_PROJECT_ID!,
  serverId: process.env.COOLIFY_SERVER_ID!,
  enableTraefik: true,
  enableSSL: true,
};

// Create and initialize driver
const driver = await createDeploymentDriver('coolify', config);

// Deploy your infrastructure
const result = await driver.deploy(deploymentConfig);
```

### 3. Health Monitoring

```typescript
// Perform health check
const health = await driver.healthCheck();
console.log(`Driver healthy: ${health.healthy}`);

// Get deployment status
const status = await driver.getStatus();
console.log(`Overall status: ${status.overall}`);
status.services.forEach(service => {
  console.log(`${service.name}: ${service.status} (${service.health})`);
});
```

## Configuration

### CoolifyConfig Interface

```typescript
interface CoolifyConfig {
  // Base configuration
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  spainResidencyMode: boolean;
  airGappedMode: boolean;
  
  // Coolify-specific settings
  coolifyUrl: string;          // Coolify instance URL
  apiToken: string;            // API authentication token
  projectId: string;           // Target project ID
  serverId: string;            // Target server ID
  networkName?: string;        // Docker network name
  domain?: string;             // Base domain for services
  enableTraefik: boolean;      // Enable Traefik reverse proxy
  enableSSL: boolean;          // Enable SSL/TLS termination
}
```

### Component Mapping

The driver automatically maps Mobius components to Coolify services:

| Component Type | Docker Image | Default Ports | Health Check |
|----------------|--------------|---------------|--------------|
| `database` | `postgres` | 5432 | `pg_isready` |
| `redis` | `redis` | 6379 | `redis-cli ping` |
| `minio` | `minio/minio` | 9000, 9001 | HTTP health endpoint |
| `qdrant` | `qdrant/qdrant` | 6333 | HTTP health endpoint |
| `gateway` | `mobius/gateway` | 3000 | Custom health check |
| `runtime` | `mobius/runtime` | 8000 | Custom health check |

## Advanced Features

### Spain Residency Mode

When `spainResidencyMode` is enabled, the driver enforces data residency requirements:

```typescript
const config: CoolifyConfig = {
  // ... other config
  spainResidencyMode: true,
  // Ensures all processing occurs within Spanish jurisdiction
};
```

### Air-Gapped Deployment

For completely offline environments:

```typescript
const config: CoolifyConfig = {
  // ... other config
  airGappedMode: true,
  coolifyUrl: 'https://coolify.internal.local',
  enableTraefik: false, // Disable external routing
  enableSSL: false,     // Handle SSL internally
};
```

### Traefik Integration

Automatic reverse proxy configuration:

```typescript
const config: CoolifyConfig = {
  // ... other config
  enableTraefik: true,
  enableSSL: true,
  domain: 'your-domain.com',
};

// Services will be automatically available at:
// - api-gateway.your-domain.com
// - minio-storage.your-domain.com
// etc.
```

## Service Operations

### Restart Services

```typescript
// Restart a specific service
await driver.restart('api-gateway');
```

### Get Service Logs

```typescript
// Get recent logs
const logs = await driver.getLogs('api-gateway', 100);
console.log(logs);
```

### Scaling (Future)

```typescript
// Scale service replicas (not yet implemented)
try {
  await driver.scale('api-gateway', 3);
} catch (error) {
  console.log('Scaling not yet available');
}
```

## Error Handling

The driver provides comprehensive error handling and remediation guidance:

```typescript
const result = await driver.deploy(config);

if (!result.success) {
  result.errors.forEach(error => {
    console.error(`${error.component}: ${error.error}`);
    if (error.remediation) {
      console.log(`Remediation: ${error.remediation}`);
    }
  });
}
```

## Performance Requirements

The Coolify driver is optimized to meet Mobius 1 performance requirements:

- **15-minute deployment**: Complete infrastructure deployment in ≤15 minutes
- **Health checks**: 30-second interval monitoring
- **Self-healing**: Automatic recovery within 2 minutes
- **99.9% uptime**: Target availability with MTTR ≤10 minutes

## Troubleshooting

### Common Issues

1. **Connection Failed**
   ```
   Error: Failed to connect to Coolify API
   ```
   - Verify `coolifyUrl` is accessible
   - Check `apiToken` is valid and has required permissions
   - Ensure network connectivity to Coolify instance

2. **Project Not Found**
   ```
   Error: Failed to access Coolify project
   ```
   - Verify `projectId` exists in your Coolify instance
   - Check API token has access to the specified project
   - Ensure `serverId` is valid for the project

3. **Service Deployment Failed**
   ```
   Error: Failed to deploy service
   ```
   - Check Docker image availability
   - Verify resource limits are within server capacity
   - Review service dependencies and startup order

### Debug Mode

Enable debug logging for detailed troubleshooting:

```typescript
// Set environment variable
process.env.DEBUG = 'coolify:*';

// Or enable in code
const driver = new CoolifyDriver({
  // ... config
  debug: true,
});
```

## API Reference

### CoolifyDriver Methods

- `getName()`: Returns driver name ('coolify')
- `getVersion()`: Returns driver version
- `initialize()`: Initialize driver and test connectivity
- `deploy(config)`: Deploy infrastructure
- `getStatus()`: Get current deployment status
- `healthCheck()`: Perform health check
- `restart(serviceName)`: Restart specific service
- `getLogs(serviceName, lines?)`: Get service logs
- `cleanup()`: Remove all deployed services

### CoolifyAPIClient Methods

- `testConnection()`: Test API connectivity
- `getProject(projectId)`: Get project information
- `deployService(projectId, serviceConfig)`: Deploy service
- `getServiceStatus(projectId, serviceName)`: Get service status
- `startService(projectId, serviceName)`: Start service
- `stopService(projectId, serviceName)`: Stop service
- `restartService(projectId, serviceName)`: Restart service
- `getServiceLogs(projectId, serviceName, lines?)`: Get service logs
- `deleteService(projectId, serviceName)`: Delete service

## Examples

See the [examples/coolify-deployment.ts](../examples/coolify-deployment.ts) file for comprehensive usage examples including:

- Basic deployment
- Spain residency mode
- Air-gapped deployment
- Service scaling and management
- Health monitoring
- Error handling

## Contributing

When contributing to the Coolify driver:

1. Ensure all tests pass: `npm test tests/control-plane/coolify-driver.test.ts`
2. Follow the unified driver interface in `drivers/types.ts`
3. Maintain compatibility with Coolify v4+ API
4. Update documentation for new features
5. Add appropriate error handling and remediation guidance

## License

This driver is part of the Mobius 1 platform and follows the same licensing terms.