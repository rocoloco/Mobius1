# Mobius 1 Platform - Deployment Guide

Complete guide for deploying the Mobius 1 Platform with automated scripts, health checks, and rollback capabilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Deployment Methods](#deployment-methods)
- [Configuration](#configuration)
- [Health Checks](#health-checks)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Dependencies

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** >= 24.x
- **Docker Compose** >= 2.x

### Optional Dependencies

- **Git** (for version control)
- **PostgreSQL Client** (for database management)

### System Requirements

- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 20GB free space
- **OS**: Linux, macOS, or Windows with WSL2

## Quick Start

### 1. Validate Dependencies

```bash
npm run deploy:validate
```

This checks all required dependencies and configuration.

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `MINIO_ENDPOINT` - MinIO endpoint
- `QDRANT_URL` - Qdrant vector database URL
- `JWT_SECRET` - Secret for JWT tokens

### 3. Deploy

**Linux/macOS:**
```bash
npm run deploy
```

**Windows:**
```powershell
npm run deploy:windows
```

The deployment script will:
1. ✅ Validate prerequisites
2. ✅ Check environment configuration
3. ✅ Pull Docker images
4. ✅ Start infrastructure services
5. ✅ Wait for services to be healthy
6. ✅ Run database migrations
7. ✅ Build application
8. ✅ Start application
9. ✅ Perform health checks

### 4. Verify Deployment

Once deployed, access:
- **Application**: http://localhost:3000
- **API Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

Uses the deployment script with full validation and health checks.

```bash
npm run deploy
```

**Features:**
- Automatic dependency validation
- Infrastructure health checks
- Database migration
- Application health verification
- Automatic rollback on failure

### Method 2: Manual Deployment

For more control over the deployment process.

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Wait for services (check with docker-compose ps)
docker-compose ps

# 3. Run migrations
npm run db:generate
npm run db:push

# 4. Build application
npm run build

# 5. Start application
npm start
```

### Method 3: Development Mode

For local development without building.

```bash
# Start infrastructure
docker-compose up -d

# Run in development mode
npm run dev
```

## Configuration

### Environment Variables

Create `.env` file with the following variables:

```env
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://mobius:mobius_dev@localhost:5432/mobius1v3

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false

# Qdrant
QDRANT_URL=http://localhost:6333

# Security
JWT_SECRET=your-secret-key-change-in-production
ENCRYPTION_KEY=your-encryption-key-32-chars

# TLS (optional)
TLS_ENABLED=false
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key

# Compliance
SPAIN_RESIDENCY_MODE=true

# Logging
LOG_LEVEL=info
REDACT_PII=true

# OpenTelemetry (optional)
OTLP_ENDPOINT=http://localhost:4318
```

### Docker Compose Configuration

The `docker-compose.yml` file defines all infrastructure services:

- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **MinIO** (ports 9000, 9001)
- **Qdrant** (ports 6333, 6334)

All services include health checks and automatic restart policies.

## Health Checks

### Application Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": [
    {
      "service": "database",
      "status": "healthy",
      "responseTime": 15
    },
    {
      "service": "redis",
      "status": "healthy",
      "responseTime": 5
    },
    {
      "service": "minio",
      "status": "healthy",
      "responseTime": 20
    },
    {
      "service": "qdrant",
      "status": "healthy",
      "responseTime": 10
    }
  ],
  "uptime": 3600
}
```

### Infrastructure Health Checks

```bash
# Check all services
docker-compose ps

# Check specific service
docker-compose ps postgres

# View service logs
docker-compose logs -f postgres
```

### Manual Health Checks

**PostgreSQL:**
```bash
docker-compose exec postgres pg_isready -U mobius
```

**Redis:**
```bash
docker-compose exec redis redis-cli ping
```

**MinIO:**
```bash
curl http://localhost:9000/minio/health/live
```

**Qdrant:**
```bash
curl http://localhost:6333/health
```

## Rollback

### Automatic Rollback

The deployment script automatically rolls back on failure.

### Manual Rollback

```bash
npm run deploy:rollback
```

This will:
1. Stop the application
2. Stop infrastructure services
3. Backup current state
4. Clean up resources

### Rollback to Specific Version

```bash
# Stop current deployment
npm run deploy:rollback

# Checkout previous version
git checkout <previous-tag>

# Redeploy
npm run deploy
```

## Troubleshooting

### Deployment Fails at Validation

**Issue**: Missing dependencies

**Solution**:
```bash
# Check what's missing
npm run deploy:validate

# Install missing dependencies
# - Docker: https://docs.docker.com/get-docker/
# - Node.js: https://nodejs.org/
```

### Infrastructure Services Not Starting

**Issue**: Port conflicts

**Solution**:
```bash
# Check what's using the ports
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :9000  # MinIO
lsof -i :6333  # Qdrant

# Stop conflicting services or change ports in docker-compose.yml
```

### Database Migration Fails

**Issue**: Database schema conflicts

**Solution**:
```bash
# Reset database (WARNING: destroys data)
docker-compose down -v
docker-compose up -d postgres

# Run migrations again
npm run db:push
```

### Application Health Check Fails

**Issue**: Application not starting

**Solution**:
```bash
# Check application logs
tail -f logs/application.log

# Check if port 3000 is available
lsof -i :3000

# Verify environment variables
cat .env
```

### Docker Daemon Not Running

**Issue**: Docker is not started

**Solution**:
```bash
# Linux
sudo systemctl start docker

# macOS
open -a Docker

# Windows
# Start Docker Desktop
```

### Permission Denied on Scripts

**Issue**: Scripts not executable

**Solution**:
```bash
chmod +x scripts/*.sh
```

## Advanced Configuration

### Custom Deployment Timeout

Edit `scripts/deploy.sh`:
```bash
DEPLOYMENT_TIMEOUT=600  # 10 minutes
```

### Custom Health Check Retries

Edit `scripts/deploy.sh`:
```bash
HEALTH_CHECK_RETRIES=20
HEALTH_CHECK_INTERVAL=10
```

### Skip Validation

```bash
# Linux/macOS
./scripts/deploy.sh --skip-validation

# Windows
powershell -File scripts/deploy.ps1 -SkipValidation
```

### Skip Build

```bash
# Linux/macOS
./scripts/deploy.sh --skip-build

# Windows
powershell -File scripts/deploy.ps1 -SkipBuild
```

## Production Deployment

### Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET
- [ ] Enable TLS (set TLS_ENABLED=true)
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Review and update CORS settings
- [ ] Enable rate limiting
- [ ] Configure log rotation

### Performance Optimization

- [ ] Increase connection pool sizes
- [ ] Configure Redis maxmemory
- [ ] Set up database indexes
- [ ] Enable caching
- [ ] Configure CDN for static assets
- [ ] Set up load balancing

### Monitoring

- [ ] Set up OpenTelemetry collector
- [ ] Configure log aggregation
- [ ] Set up alerting rules
- [ ] Monitor resource usage
- [ ] Track SLI/SLO metrics

## Support

For deployment issues:
- Check logs: `docker-compose logs`
- Review health checks: `curl http://localhost:3000/health`
- Validate dependencies: `npm run deploy:validate`
- Consult troubleshooting section above

For additional help, contact the development team or open an issue.
