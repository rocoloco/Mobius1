# Mobius 1 Platform - Quick Start Deployment

## 🚀 Deploy in 3 Steps

### 1️⃣ Validate
```bash
npm run deploy:validate
```

### 2️⃣ Configure
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3️⃣ Deploy
```bash
npm run deploy
```

## ✅ What Gets Deployed

- ✅ PostgreSQL Database
- ✅ Redis Cache
- ✅ MinIO Object Storage
- ✅ Qdrant Vector Database
- ✅ Mobius 1 Application

## 🔗 Access Points

After deployment:
- **Application**: http://localhost:3000
- **API Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **MinIO Console**: http://localhost:9001

## 🛠️ Common Commands

```bash
# Validate dependencies
npm run deploy:validate

# Deploy (Linux/macOS)
npm run deploy

# Deploy (Windows)
npm run deploy:windows

# Rollback
npm run deploy:rollback

# Check health
curl http://localhost:3000/health

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## ⚙️ Required Environment Variables

```env
DATABASE_URL=postgresql://mobius:mobius_dev@localhost:5432/mobius1v3
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost
QDRANT_URL=http://localhost:6333
JWT_SECRET=your-secret-key-change-in-production
```

## 🆘 Troubleshooting

**Deployment fails?**
```bash
# Check what's wrong
npm run deploy:validate

# View detailed logs
docker-compose logs

# Rollback and try again
npm run deploy:rollback
npm run deploy
```

**Port conflicts?**
```bash
# Check what's using ports
lsof -i :3000  # Application
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

**Docker not running?**
```bash
# Start Docker
sudo systemctl start docker  # Linux
open -a Docker              # macOS
# Start Docker Desktop       # Windows
```

## 📚 Full Documentation

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment guide.

## 🎯 Deployment Time

- **Validation**: < 10 seconds
- **Infrastructure**: 30-60 seconds
- **Application**: 20-40 seconds
- **Total**: 2-5 minutes ⚡

## ✨ Features

- ✅ Automated validation
- ✅ Health check monitoring
- ✅ Automatic rollback on failure
- ✅ Cross-platform support
- ✅ Comprehensive logging
- ✅ Production-ready

---

**Need help?** Check [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) or run `npm run deploy:validate`
