# Windows Setup Guide - Mobius 1 Platform

## Prerequisites

You're running on Windows and need to install a few tools before you can run the Mobius 1 platform.

## Step 1: Install Node.js

1. Download Node.js 20 LTS from: https://nodejs.org/
2. Run the installer (choose "Automatically install necessary tools" option)
3. Restart your terminal/PowerShell
4. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

## Step 2: Enable PowerShell Script Execution

PowerShell blocks script execution by default. To enable it:

```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

This allows you to run local scripts while still requiring downloaded scripts to be signed.

## Step 3: Install OpenSSL (for certificate generation)

Choose one option:

### Option A: Install Git for Windows (Recommended)
Git for Windows includes OpenSSL:
1. Download from: https://git-scm.com/download/win
2. Install with default options
3. OpenSSL will be available at: `C:\Program Files\Git\usr\bin\openssl.exe`

### Option B: Install OpenSSL directly
1. Download from: https://slproweb.com/products/Win32OpenSSL.html
2. Choose "Win64 OpenSSL v3.x.x" (not the "Light" version)
3. Install to default location
4. Add to PATH if not done automatically

### Option C: Use Chocolatey
If you have Chocolatey package manager:
```powershell
choco install openssl
```

Verify OpenSSL installation:
```powershell
openssl version
```

## Step 4: Install Project Dependencies

```powershell
# Navigate to project directory
cd "C:\Users\jfros\Mobius 1\Mobius1"

# Install dependencies
npm install
```

## Step 5: Verify Security Implementation

```powershell
# Run verification script
.\scripts\verify-security.ps1
```

This checks that all security files are in place.

## Step 6: Generate Security Keys

```powershell
# Generate compliance signing keys
.\scripts\generate-keys.ps1

# Generate TLS certificates (for development)
.\scripts\generate-certs.ps1
```

## Step 7: Configure Environment

```powershell
# Copy example environment file
Copy-Item .env.example .env

# Edit .env with your preferred editor
notepad .env
```

**Important**: Change these values in `.env`:
- `JWT_SECRET` - Set to a random 32+ character string
- `ENCRYPTION_KEY` - Set to exactly 32 random characters

Generate secure values:
```powershell
# Generate JWT_SECRET (64 chars)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Generate ENCRYPTION_KEY (32 chars)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

## Step 8: Set Up Database

```powershell
# Start Docker services (PostgreSQL, Redis, MinIO, Qdrant)
npm run docker:up

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

## Step 9: Run Tests

```powershell
# Run all tests
npm test

# Run only security tests
npm test tests/security/

# Run with coverage
npm run test:coverage
```

## Step 10: Run Security Audit

```powershell
npm run security:check
```

This validates your security configuration.

## Step 11: Start Development Server

```powershell
npm run dev
```

The server will start at `http://localhost:3000` (or `https://localhost:3000` if TLS is enabled).

## Common Issues

### "npm is not recognized"

**Problem**: Node.js not installed or not in PATH

**Solution**:
1. Install Node.js from https://nodejs.org/
2. Restart PowerShell
3. Verify with `node --version`

### "openssl is not recognized"

**Problem**: OpenSSL not installed or not in PATH

**Solution**:
1. Install Git for Windows (easiest option)
2. Or install OpenSSL directly
3. Restart PowerShell
4. Verify with `openssl version`

### "running scripts is disabled"

**Problem**: PowerShell execution policy blocks scripts

**Solution**:
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Docker is not running"

**Problem**: Docker Desktop not started

**Solution**:
1. Install Docker Desktop from https://www.docker.com/products/docker-desktop/
2. Start Docker Desktop
3. Wait for it to fully start (whale icon in system tray)
4. Run `npm run docker:up`

### "Port 3000 already in use"

**Problem**: Another application is using port 3000

**Solution**:
```powershell
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env
# PORT=3001
```

## Alternative: Use WSL2 (Windows Subsystem for Linux)

If you prefer a Linux environment on Windows:

1. Install WSL2:
   ```powershell
   wsl --install
   ```

2. Install Ubuntu from Microsoft Store

3. Inside WSL2, follow the Linux setup instructions:
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install OpenSSL (usually pre-installed)
   sudo apt-get install openssl

   # Clone/navigate to project
   cd /mnt/c/Users/jfros/Mobius\ 1/Mobius1

   # Follow normal Linux setup
   npm install
   bash scripts/generate-keys.sh
   bash scripts/generate-certs.sh
   ```

## Next Steps

Once setup is complete:

1. Review [Security Documentation](./security/README.md)
2. Read [Quick Reference](./security/quick-reference.md)
3. Check [API Documentation](../README.md)
4. Start building!

## Getting Help

- Check the [main README](../README.md)
- Review [troubleshooting section](#common-issues)
- Check project issues on GitHub
- Review error logs in `logs/` directory
