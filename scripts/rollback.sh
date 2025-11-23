#!/bin/bash

###############################################################################
# Mobius 1 Platform - Rollback Script
# Safely rolls back deployment to previous state
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Stop application
stop_application() {
    log_info "Stopping application..."
    
    if [ -f ".app.pid" ]; then
        APP_PID=$(cat .app.pid)
        
        if kill -0 $APP_PID 2>/dev/null; then
            kill $APP_PID
            log_success "Application stopped (PID: $APP_PID)"
        else
            log_warning "Application process not found"
        fi
        
        rm .app.pid
    else
        log_warning "No .app.pid file found"
    fi
}

# Stop infrastructure
stop_infrastructure() {
    log_info "Stopping infrastructure services..."
    
    docker-compose down
    
    log_success "Infrastructure services stopped"
}

# Backup current state
backup_state() {
    log_info "Backing up current state..."
    
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup environment
    if [ -f ".env" ]; then
        cp .env "$backup_dir/.env"
    fi
    
    # Backup database (if needed)
    # docker-compose exec -T postgres pg_dump -U mobius mobius1v3 > "$backup_dir/database.sql"
    
    log_success "State backed up to $backup_dir"
}

# Clean up resources
cleanup_resources() {
    log_info "Cleaning up resources..."
    
    # Remove build artifacts
    if [ -d "dist" ]; then
        rm -rf dist
        log_info "Removed dist directory"
    fi
    
    # Clean Docker volumes (optional - commented out for safety)
    # docker-compose down -v
    
    log_success "Resources cleaned up"
}

# Main rollback flow
main() {
    log_warning "========================================="
    log_warning "Mobius 1 Platform Rollback"
    log_warning "========================================="
    echo ""
    
    read -p "Are you sure you want to rollback? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Rollback cancelled"
        exit 0
    fi
    
    echo ""
    
    backup_state
    stop_application
    stop_infrastructure
    cleanup_resources
    
    echo ""
    log_success "========================================="
    log_success "Rollback Completed"
    log_success "========================================="
    echo ""
    log_info "To redeploy, run: ./scripts/deploy.sh"
    echo ""
}

main "$@"
