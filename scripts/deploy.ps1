# Mobius 1 Platform - Deployment Script (PowerShell)
# Automates deployment with validation, health checks, and rollback capability

param(
    [switch]$SkipValidation = $false,
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

# Configuration
$DEPLOYMENT_TIMEOUT = 300  # 5 minutes
$HEALTH_CHECK_RETRIES = 10
$HEALTH_CHECK_INTERVAL = 5

# Logging functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if command exists
function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Validate prerequisites
function Test-Prerequisites {
    Write-Info "Validating prerequisites..."
    
    $missingDeps = @()
    
    if (-not (Test-CommandExists "docker")) {
        $missingDeps += "docker"
    }
    
    if (-not (Test-CommandExists "docker-compose")) {
        $missingDeps += "docker-compose"
    }
    
    if (-not (Test-CommandExists "node")) {
        $missingDeps += "node"
    }
    
    if (-not (Test-CommandExists "npm")) {
        $missingDeps += "npm"
    }
    
    if ($missingDeps.Count -gt 0) {
        Write-ErrorMsg "Missing required dependencies: $($missingDeps -join ', ')"
        Write-ErrorMsg "Please install missing dependencies and try again"
        exit 1
    }
    
    Write-Success "All prerequisites validated"
}

# Check environment configuration
function Test-Environment {
    Write-Info "Validating environment configuration..."
    
    if (-not (Test-Path ".env")) {
        Write-ErrorMsg ".env file not found"
        
        if (Test-Path ".env.example") {
            Write-Info "Creating .env from .env.example..."
            Copy-Item ".env.example" ".env"
            Write-Warning "Please configure .env file with your settings"
            exit 1
        } else {
            Write-ErrorMsg ".env.example not found"
            exit 1
        }
    }
    
    # Load environment variables
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
    
    # Run comprehensive configuration validation
    Write-Info "Running configuration validator..."
    try {
        npm run config:validate
        if ($LASTEXITCODE -ne 0) {
            throw "Configuration validation failed"
        }
    } catch {
        Write-ErrorMsg "Configuration validation failed"
        Write-Info "Please fix configuration errors and try again"
        exit 1
    }
    
    Write-Success "Environment configuration validated"
}

# Validate secrets and rotation status
function Test-Secrets {
    Write-Info "Validating secrets and rotation status..."
    
    # Check if secrets need rotation
    npm run secrets:rotate check
    
    Write-Success "Secrets validation completed"
}

# Check Docker daemon
function Test-Docker {
    Write-Info "Checking Docker daemon..."
    
    try {
        docker info | Out-Null
        Write-Success "Docker daemon is running"
    } catch {
        Write-ErrorMsg "Docker daemon is not running"
        Write-Info "Please start Docker and try again"
        exit 1
    }
}

# Pull latest images
function Get-DockerImages {
    Write-Info "Pulling latest Docker images..."
    docker-compose pull
    Write-Success "Docker images pulled successfully"
}

# Start infrastructure services
function Start-Infrastructure {
    Write-Info "Starting infrastructure services..."
    docker-compose up -d postgres redis minio qdrant
    Write-Success "Infrastructure services started"
}

# Wait for service to be healthy
function Wait-ForService {
    param(
        [string]$Service,
        [int]$MaxRetries,
        [int]$Interval
    )
    
    Write-Info "Waiting for $Service to be healthy..."
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        $status = docker-compose ps $Service | Select-String "healthy"
        
        if ($status) {
            Write-Success "$Service is healthy"
            return $true
        }
        
        Write-Info "Attempt $i/$MaxRetries: $Service not ready yet, waiting ${Interval}s..."
        Start-Sleep -Seconds $Interval
    }
    
    Write-ErrorMsg "$Service failed to become healthy"
    return $false
}

# Wait for all infrastructure services
function Wait-ForInfrastructure {
    Write-Info "Waiting for infrastructure services to be healthy..."
    
    if (-not (Wait-ForService "postgres" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL)) { exit 1 }
    if (-not (Wait-ForService "redis" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL)) { exit 1 }
    if (-not (Wait-ForService "minio" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL)) { exit 1 }
    if (-not (Wait-ForService "qdrant" $HEALTH_CHECK_RETRIES $HEALTH_CHECK_INTERVAL)) { exit 1 }
    
    Write-Success "All infrastructure services are healthy"
}

# Run database migrations
function Invoke-Migrations {
    Write-Info "Running database migrations..."
    npm run db:generate
    npm run db:push
    Write-Success "Database migrations completed"
}

# Build application
function Build-Application {
    Write-Info "Building application..."
    npm run build
    Write-Success "Application built successfully"
}

# Start application
function Start-Application {
    Write-Info "Starting Mobius 1 Platform..."
    
    $process = Start-Process -FilePath "npm" -ArgumentList "start" -PassThru -NoNewWindow
    $process.Id | Out-File ".app.pid"
    
    Write-Info "Application started with PID: $($process.Id)"
}

# Health check application
function Test-ApplicationHealth {
    Write-Info "Performing application health checks..."
    
    $maxRetries = 20
    $interval = 3
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Success "Application is healthy"
                return $true
            }
        } catch {
            Write-Info "Attempt $i/$maxRetries: Application not ready yet, waiting ${interval}s..."
            Start-Sleep -Seconds $interval
        }
    }
    
    Write-ErrorMsg "Application health check failed"
    return $false
}

# Rollback deployment
function Invoke-Rollback {
    Write-Warning "Rolling back deployment..."
    
    # Stop application
    if (Test-Path ".app.pid") {
        $pid = Get-Content ".app.pid"
        try {
            Stop-Process -Id $pid -Force
            Write-Info "Application stopped"
        } catch {
            Write-Warning "Could not stop application process"
        }
        Remove-Item ".app.pid"
    }
    
    # Stop infrastructure
    docker-compose down
    
    Write-Warning "Rollback completed"
    exit 1
}

# Main deployment flow
function Start-Deployment {
    Write-Info "========================================="
    Write-Info "Mobius 1 Platform Deployment"
    Write-Info "========================================="
    Write-Host ""
    
    try {
        # Validation phase
        if (-not $SkipValidation) {
            Test-Prerequisites
            Test-Environment
            Test-Secrets
            Test-Docker
        }
        
        Write-Host ""
        Write-Info "========================================="
        Write-Info "Starting Deployment"
        Write-Info "========================================="
        Write-Host ""
        
        # Infrastructure phase
        Get-DockerImages
        Start-Infrastructure
        Wait-ForInfrastructure
        
        # Database phase
        Invoke-Migrations
        
        # Application phase
        if (-not $SkipBuild) {
            Build-Application
        }
        Start-Application
        
        if (-not (Test-ApplicationHealth)) {
            throw "Application health check failed"
        }
        
        Write-Host ""
        Write-Success "========================================="
        Write-Success "Deployment Completed Successfully!"
        Write-Success "========================================="
        Write-Host ""
        Write-Info "Application is running at: http://localhost:3000"
        Write-Info "API Documentation: http://localhost:3000/docs"
        Write-Info "Health Check: http://localhost:3000/health"
        Write-Host ""
        Write-Info "To stop the application:"
        Write-Info "  npm run docker:down"
        Write-Info "  Stop-Process -Id (Get-Content .app.pid)"
        Write-Host ""
        
    } catch {
        Write-ErrorMsg "Deployment failed: $_"
        Invoke-Rollback
    }
}

# Run main function
Start-Deployment
