
# Mobius 1 Platform

Sovereign AI infrastructure platform for Spanish gestorías and expat relocation agencies. Provides compliant AI environments with Spain-only data residency, GDPR/EU AI Act compliance, and vendor independence.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL (via Docker)

### Development Setup

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Start infrastructure services**
   ```bash
   npm run docker:up
   ```

3. **Set up database**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

### Health Checks

- **Comprehensive health**: `GET /health` - Full system health status
- **Readiness check**: `GET /ready` - Simple readiness probe
- **Application info**: `GET /info` - Version and configuration info

### Infrastructure Services

The Docker Compose setup includes:

- **PostgreSQL** (port 5432) - Primary database
- **Redis** (port 6379) - Caching and session storage
- **MinIO** (ports 9000/9001) - Object storage for documents
- **Qdrant** (ports 6333/6334) - Vector database for AI operations

### Configuration

Copy `.env.example` to `.env` and adjust settings as needed. Key configuration options:

- `SPAIN_RESIDENCY_MODE=true` - Enforce Spain-only data processing
- `LOG_REDACT_PII=true` - Enable PII redaction in logs
- `NODE_ENV=development` - Environment mode

### Database Management

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio

### Docker Management

- `npm run docker:up` - Start all services
- `npm run docker:down` - Stop all services

## Architecture

The platform follows a layered architecture:

- **Control Plane** - Orchestration and management
- **Policy Gateway** - Compliance and governance
- **Processing Layer** - Document processing and AI workflows
- **Data Plane** - PostgreSQL, MinIO, Redis, Qdrant

## Compliance Features

- **Spain Residency Mode** - Ensures data never leaves Spanish jurisdiction
- **PII Redaction** - Automatic redaction of sensitive information in logs
- **Audit Trail** - Comprehensive logging for AESIA compliance
- **GDPR Compliance** - Built-in data protection and privacy controls

## Development

### Code Standards

- TypeScript with strict mode
- ESLint + Prettier for code formatting
- Vitest for testing
- Conventional commits for Git history

### Testing

```bash
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage
```

### Linting and Formatting

```bash
npm run lint            # Check code style
npm run format          # Format code
```

## Kiro Integration

This repository is optimized for **Kiro** development:
- Specs-first workflow in `.kiro/specs`
- Steering docs in `.kiro/steering`
- Hooks (quality gates) in `.kiro/hooks`

## License

Private - Mobius 1 Platform

