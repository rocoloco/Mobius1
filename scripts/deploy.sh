#!/bin/bash

###############################################################################
# Mobius 1 Platform - Deployment Script
# Automates deployment with validation, health checks, and rollback capability
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TIMEOUT=300  # 5 minutes
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=5

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    local missing_deps=()
    
    if ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    if ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
    fi
    
    if ! command_exists node; then
        missing_deps+=("node")
    fi
    
    if ! command_exists npm; then
        missing_deps+=("npm")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install missing dependencies and try again"
        exit 1
    fi
    
    log_success "All prerequisites validated"
}

# Check environment configuration
validate_environment() {
    log_info "Validating environment configuration..."
    
    if [ ! -f ".env" ]; then
        log_error ".env file not found"
        log_info "Creating .env from .env.example..."
        
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_warning "Please configure .env file with your settings"
            exit 1
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi
    
    # Run comprehensive configuration validation
    log_info "Running configuration validator..."
    if ! npm run config:validate; then
        log_error "Configuration validation failed"
        log_info "Please fix configuration errors and try again"
        exit 1
    fi
    
    log_success "Environment configuration validated"
}

# Validate secrets and rotation status
validate_secrets() {
    log_info "Validating secrets and rotation status..."
    
    # Check if secrets need rotation
    npm run secrets:rotate check
    
    log_success "Secrets validation completed"
}

# Check Docker daemon
check_docker() {
    log_info "Checking Docker daemon..."
    
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        log_info "Please start Docker and try again"
        exit 1
    fi
    
    log_success "Docker daemon is running"
}

# Pull latest images
pull_images() {
    log_info "Pulling latest Docker images..."
    
    docker-compose pull
    
    log_success "Docker images pulled successfully"
}

# Start infrastructure services
start_infrastructure() {
    log_info "Starting infrastructure services..."
    
    docker-compose up -d postgres redis minio qdrant
    
    log_success "Infrastructure services started"
}

# Wait for service to be healthy
wait_for_service() {
    local service=$1
    local max_retries=$2
    local interval=$3
    
    log_info "Waiting for $service to be healthy..."
    
    for i in $(seq 1 $max_retries); do
        if docker-compose ps $service | grep -q "healthy"; then
            log_success "$service is healthy"
            return 0
        fi
        
        log_info "Attempt $i/$max_retries: $service not ready yet, waiting ${interval}s..."
        sleep $interval
    done
    
    log_error "$service failed to become healthy"
    return 1
}

# Wait for all infrastructure services
wait_for_infrastructure() {
    log_info "Waiting for infrastructure services to be healthy..."
    
    wait_for_service "postgres" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL || exit 1
    wait_for_service "redis" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL || exit 1
    wait_for_service "minio" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL || exit 1
    wait_for_service "qdrant" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL || exit 1
    
    log_success "All infrastructure services are healthy"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    npm run db:generate
    npm run db:push
    
    log_success "Database migrations completed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    npm run build
    
    log_success "Application built successfully"
}

# Start application
start_application() {
    log_info "Starting Mobius 1 Platform..."
    
    # Start in background
    npm start &
    APP_PID=$!
    
    log_info "Application started with PID: $APP_PID"
    
    # Save PID for later
    echo $APP_PID > .app.pid
}

# Health check application
health_check_application() {
    log_info "Performing application health checks..."
    
    local max_retries=20
    local interval=3
    
    for i in $(seq 1 $max_retries); do
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Application is healthy"
            return 0
        fi
        
        log_info "Attempt $i/$max_retries: Application not ready yet, waiting ${interval}s..."
        sleep $interval
    done
    
    log_error "Application health check failed"
    return 1
}

# Rollback deployment
rollback() {
    log_warning "Rolling back deployment..."
    
    # Stop application
    if [ -f ".app.pid" ]; then
        APP_PID=$(cat .app.pid)
        if kill -0 $APP_PID 2>/dev/null; then
            kill $APP_PID
            log_info "Application stopped"
        fi
        rm .app.pid
    fi
    
    # Stop infrastructure
    docker-compose down
    
    log_warning "Rollback completed"
    exit 1
}

# Cleanup on exit
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Deployment failed"
        rollback
    fi
}

trap cleanup EXIT

# Main deployment flow
main() {
    log_info "========================================="
    log_info "Mobius 1 Platform Deployment"
    log_info "========================================="
    echo ""
    
    # Validation phase
    validate_prerequisites
    validate_environment
    validate_secrets
    check_docker
    
    echo ""
    log_info "========================================="
    log_info "Starting Deployment"
    log_info "========================================="
    echo ""
    
    # Infrastructure phase
    pull_images
    start_infrastructure
    wait_for_infrastructure
    
    # Database phase
    run_migrations
    
    # Application phase
    build_application
    start_application
    health_check_application
    
    echo ""
    log_success "========================================="
    log_success "Deployment Completed Successfully!"
    log_success "========================================="
    echo ""
    log_info "Application is running at: http://localhost:3000"
    log_info "API Documentation: http://localhost:3000/docs"
    log_info "Health Check: http://localhost:3000/health"
    echo ""
    log_info "To stop the application:"
    log_info "  npm run docker:down"
    log_info "  kill \$(cat .app.pid)"
    echo ""
}

# Run main function
main "$@"
