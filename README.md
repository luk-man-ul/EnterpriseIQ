# EnterpriseIQ

EnterpriseIQ is a secure, scalable, and high-performance enterprise knowledge base, semantic search, and Retrieval-Augmented Generation (RAG) platform. Designed for modern enterprises, it ingests unstructured data from diverse sources, processes it securely, and enables users to query their organization's collective intelligence using state-of-the-art LLMs, while strictly adhering to enterprise-grade security and access control boundaries.

---

## 📂 Project Structure

This repository is structured as a modular workspace utilizing native npm workspaces to isolate backend and frontend services.

```text
EnterpriseIQ/
├── .github/                           # GitHub configurations
│   └── workflows/                     # CI/CD pipelines scaffolding
├── .vscode/                           # Shared developer workspace configs
│   ├── settings.json                  # Workspace editor code style controls
│   └── extensions.json                # Pre-selected plugin recommendations
├── docker/                            # Deployment build configurations
│   ├── Dockerfile.backend             # Multi-stage alpine production build for NestJS
│   ├── Dockerfile.frontend            # Multi-stage alpine production build for Next.js
│   └── docker-compose.yml             # Coordinate database, API, and client services
├── docs/                              # Frozen baseline architecture documents
│   ├── Product_Requirements_Specification.md
│   ├── System_Architecture.md
│   ├── Database_Design.md
│   ├── RAG_Architecture.md
│   ├── API_Design.md
│   ├── Folder_Structure.md
│   └── Security_Model.md
├── backend/                           # NestJS Modular Monolith Application
│   ├── prisma/
│   │   └── schema.prisma              # Prisma Client & Datasource definitions
│   └── src/
│       ├── main.ts                    # Entry bootstrapper
│       ├── app.module.ts              # Root AppModule registration
│       ├── common/                    # Common guards, interceptors, and pipes
│       ├── config/                    # Environment variables schemas
│       ├── infrastructure/            # Outward adapter wrappers
│       ├── shared/                    # Core utility helpers
│       └── modules/                   # Monolithic business modules (auth, users, documents, etc.)
│           └── health/                # Dedicated Health check module
└── frontend/                          # Next.js App Router Application
    └── src/
        └── app/                       # Routing layouts, home view, and global styling
```

---

## 🏛️ Core Documentation

To understand the architecture and implementation details of EnterpriseIQ, please refer to the following documents in the `docs/` directory:

1. **[Product Requirements Specification (PRS)](docs/Product_Requirements_Specification.md)**
2. **[System Architecture](docs/System_Architecture.md)**
3. **[Database Design](docs/Database_Design.md)**
4. **[RAG Architecture & Pipeline](docs/RAG_Architecture.md)**
5. **[API Design & Specification](docs/API_Design.md)**
6. **[Folder Structure](docs/Folder_Structure.md)**
7. **[Security Model & Tenancy](docs/Security_Model.md)**
8. **[Development Roadmap](docs/Development_Roadmap.md)**

---

## 🛠️ Prerequisites

Ensure you have the following system requirements installed locally:
- **Node.js**: `v20.x` (LTS version recommended)
- **npm**: `v10.x` or later
- **Docker**: `v20.x` or later (with Compose plugin)

---

## ⚙️ Installation

The repository uses native **npm workspaces** to handle dependencies across backend and frontend packages. Install all workspace dependencies from the root directory:

```bash
# Execute from the repository root
npm install
```

---

## 🚀 Local Development

### 1. Starting the Backend (NestJS)

1. Navigate to the `backend` workspace directory:
   ```bash
   cd backend
   ```
2. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```
3. Boot the application in watch mode:
   ```bash
   npm run start:dev
   ```
4. Verify the server is running by hitting the health check endpoint:
   `GET http://localhost:3000/health` -> should return:
   ```json
   {
     "status": "ok",
     "service": "EnterpriseIQ Backend"
   }
   ```

### 2. Starting the Frontend (Next.js)

1. Navigate to the `frontend` workspace directory:
   ```bash
   cd frontend
   ```
2. Set up your client environment variables:
   ```bash
   cp .env.example .env
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the web interface in your browser:
   `http://localhost:3000` (displays "EnterpriseIQ - Development Environment Ready")

---

## 🐳 Docker Deployment

The application services can be spun up inside isolated container runtimes. Docker files are optimized using lightweight `node:20-alpine` stages.

### Build and start all services:
```bash
# Execute from the root repository directory
docker compose -f docker/docker-compose.yml up --build
```

### Shut down all services:
```bash
docker compose -f docker/docker-compose.yml down
```

### Check configuration and validity of compose definitions:
```bash
docker compose -f docker/docker-compose.yml config
```

### Exposed Service Ports:
- **Next.js Web Frontend**: `http://localhost:3000`
- **NestJS REST API**: `http://localhost:3001` (internal backend server routes on port 3000)
- **PostgreSQL Database**: Port `5432` is handled entirely inside the Docker internal network (`enterpriseiq_network`) and is not exposed to the public host for security boundaries.
