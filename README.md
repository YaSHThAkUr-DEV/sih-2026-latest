# 🏛️ NIRMAN DMS — Secure Legal, Institutional & Inter-Agency Document Management System

> **Smart India Hackathon (SIH) Flagship Architecture**  
> An enterprise-grade, cryptographically verifiable, multi-organization Document Management System (DMS) built for Indian Judicial, Law Enforcement, Secretariats, and Public Administration bodies.

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4_(Turbopack)-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2F18-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red?style=flat&logo=redis)](https://redis.io/)
[![MinIO](https://img.shields.io/badge/MinIO-S3_Compatible-c72c48?style=flat&logo=minio)](https://min.io/)
[![Vault KMS](https://img.shields.io/badge/HashiCorp_Vault-Transit_KMS-black?style=flat&logo=vault)](https://www.vaultproject.io/)
[![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger_Fabric-2.5_Enterprise-2f3136?style=flat&logo=hyperledger)](https://www.hyperledger.org/use/fabric)
[![Tesseract OCR](https://img.shields.io/badge/OCR-Tesseract.js_7.0-green?style=flat)](https://tesseract.projectnaptha.com/)

---

## 📌 Table of Contents
1. [System Highlights & Key Features](#-system-highlights--key-features)
2. [High-Level Architecture](#-high-level-architecture)
3. [Prerequisites](#-prerequisites)
4. [Containerized Infrastructure (Docker)](#-containerized-infrastructure-docker)
5. [Frontend & Custom UI Theme Architecture](#-frontend--custom-ui-theme-architecture)
6. [Step-by-Step Installation & Setup](#-step-by-step-installation--setup)
7. [Database Migrations & Seeding](#-database-migrations--seeding)
8. [Pre-Seeded Demo Accounts & Credentials](#-pre-seeded-demo-accounts--credentials)
9. [Verification & Health Checks](#-verification--health-checks)
10. [Hyperledger Fabric Blockchain Setup (Optional)](#-hyperledger-fabric-blockchain-setup-optional)
11. [Public Verification & Section 65B Certificates](#-public-verification--section-65b-certificates)
12. [Cloudflare Remote Tunnel](#-cloudflare-remote-tunnel)
13. [Directory Structure](#-directory-structure)
14. [Available Scripts Reference](#-available-scripts-reference)
15. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🌟 System Highlights & Key Features

* **⚖️ Section 65B Statutory Judicial Certification**:
  Generates automated, court-admissible *Certificates of Electronic Evidence* under Section 65B(4) of the Indian Evidence Act, sealed with SHA-256 HMAC digital signatures and dynamic QR verification codes.
* **🛡️ WORM (Write Once Read Many) Immutability**:
  Strict tamper-proofing ensuring evidentiary document hashes cannot be overwritten, modified, or silently scrubbed once ingested.
* **🌐 Multi-Organization Collaboration Highway & Federation**:
  Cross-agency document requisition, dynamic forensic watermarking, dual-custody transfers between Central Gov, State Directorates, Judiciary, Police, and Forensic Labs.
* **🔒 Maker-Checker Dual-Custody Approval Workflows**:
  Quarantines sensitive dockets (Security Clearance T4/T5) requiring multi-officer sign-off before publication.
* **🔗 Immutable Audit Ledger & Blockchain Anchoring**:
  Anchors Merkle roots and audit trail blocks onto **Hyperledger Fabric 2.5** (with fallback simulated cryptographic hash chains).
* **🔍 Deep OCR & GIN Full-Text Search**:
  Local Tesseract 7.0 engine extracting text from scanned Hindi/English notices, dockets, and PDFs with PostgreSQL GIN indexed vectors.
* **🎨 3D WebGL Shader UI & Glassmorphic Design System**:
  Modern dark/light glassmorphic interface powered by Three.js interactive shaders, customized loaders, and fluid responsive dashboards.

---

## 🏛️ High-Level Architecture

```text
               +-------------------------------------------------------------+
               |                    Next.js 16 + React 19                   |
               |     (Tailwind v4 • 3D Shader WebGL • Glassmorphism UI)      |
               +-------------------------------------------------------------+
                                       |
                     +-----------------+-----------------+
                     |                                   |
         REST / Next.js Server Actions           JWT / RBAC Security
                     |                                   |
    +----------------+----------------+         +--------+--------+
    |                                 |         | Clearance T1-T5 |
    v                                 v         +-----------------+
[PostgreSQL 16/18]             [Redis 7 Cache & Queue]
  - Core Metadata DB             - 5-Tier Job Queues
  - Dynamic Taxonomies           - AutoRunner Event Loop
  - GIN Search Vectors           - Rate Limiting / Cache
    |                                 |
    +----------------+----------------+
                     |
         +-----------+-----------+
         |                       |
         v                       v
[MinIO S3 Storage]       [HashiCorp Vault KMS]
  - Document Buckets       - AES-256-GCM Envelope Wrap
  - Version Revisions      - Master Transit Key Engine
         |
         +----------------------------------+
         |                                  |
         v                                  v
[Hyperledger Fabric 2.5]         [Tesseract OCR 7.0]
  - Orderer (Raft Consensus)       - Text & Docket Parsing
  - Peer Nodes & CouchDB State     - PDF & Scanned Image Extraction
  - Audit Merkle Anchors           - eng.traineddata Local Processing
```

---

## 📋 Prerequisites

Before running NIRMAN DMS, ensure the following software is installed on your workstation:

| Prerequisite | Minimum Version | Recommended | Notes |
|---|---|---|---|
| **Node.js** | `>= 20.x` (LTS) | `v20.18.x` or `v22.x` | Runtime for Next.js & TypeScript scripts |
| **npm** | `>= 10.x` | `10.8.x+` | Package manager |
| **Docker & Docker Compose** | `>= 24.x` | Latest Docker Desktop / Engine | Runs Postgres, Redis, MinIO, Vault & Fabric |
| **Git** | `>= 2.30` | Latest | Version control |
| **OS** | Windows 10/11 (WSL2 / PowerShell), Linux (Ubuntu 22.04+), or macOS |

---

## 🐳 Containerized Infrastructure (Docker)

To run the full backend stack locally (PostgreSQL, Redis, MinIO, and Vault), you can use Docker Compose.

### Quick Local Services `docker-compose.yml`
Save the following configuration as `docker-compose.yml` in your project root or start the containers directly:

```yaml
version: '3.8'

services:
  # 1. PostgreSQL Core Database
  postgres:
    image: postgres:16-alpine
    container_name: dms-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: dms_db
    ports:
      - "5432:5432"
    volumes:
      - dms_pgdata:/var/lib/postgresql/data

  # 2. Redis Cache & Job Queues
  redis:
    image: redis:7-alpine
    container_name: dms-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - dms_redisdata:/data

  # 3. MinIO S3-Compatible Object Storage
  minio:
    image: minio/minio:latest
    container_name: dms-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - dms_miniodata:/data

  # 4. HashiCorp Vault Transit KMS
  vault:
    image: hashicorp/vault:1.15
    container_name: dms-vault
    restart: unless-stopped
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: dms-vault-dev-token
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
    cap_add:
      - IPC_LOCK
    ports:
      - "8200:8200"

volumes:
  dms_pgdata:
  dms_redisdata:
  dms_miniodata:
```

### Start the Containers:
```bash
docker compose up -d
```

---

## 🎨 Frontend & Custom UI Theme Architecture

NIRMAN DMS features a custom-engineered UI theme designed for high-clarity government operations:

### 1. 3D WebGL Shader Canvas
* Driven by `@shadergradient/react`, `@react-three/fiber`, `three`, and `camera-controls`.
* Renders an interactive, liquid WebGL mesh background on the authentication portal (`components/auth/ShaderGradientBackground.tsx`).
* Configured with a smooth `waterPlane` algorithm and high-density lighting.

### 2. Tailwind CSS v4 Glassmorphic Styling
* Built on Tailwind CSS v4 (`@tailwindcss/postcss`).
* Features backdrop-blur glass panels, high-contrast dark/light mode tokens, and institutional color palettes (Judicial Purple, Central Blue, Enforcement Red, Forest Green).

### 3. Animated Geometric SquareLoader
* Custom hardware-accelerated loader (`components/ui/SquareLoader.tsx`) with animated CSS keyframe offsets for status transitions during OCR scanning, hash calculation, and cryptographic signing.

### 4. Hardware Camera QR Scanner & QR Stamping
* Uses `jsqr` for live browser camera scanning (`components/verify/MobileQrScanner.tsx`).
* Uses `qrcode` for generating instantaneous tamper-evident validation badges.

---

## 🚀 Step-by-Step Installation & Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/YaSHThAkUr-DEV/sih-2026-latest.git dms-project
cd dms-project
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the provided `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```

Review your `.env` configuration:
```env
# Application Runtime
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dms_db

# JWT & KEK Envelope Secret (minimum 32 characters)
JWT_SECRET=dms_super_secure_jwt_secret_key_2026_institutional_gov_32chars!

# MinIO / AWS S3 Storage
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=dms-documents
MINIO_REGION=us-east-1

# Redis
REDIS_URL=redis://127.0.0.1:6379

# HashiCorp Vault KMS
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=dms-vault-dev-token

# Blockchain Audit Trail Mode ('simulated' or 'fabric')
BLOCKCHAIN_MODE=simulated
BLOCKCHAIN_NETWORK_NAME=dms-records-network
BLOCKCHAIN_CHANNEL_NAME=recordschannel
BLOCKCHAIN_CHAINCODE_NAME=dms_audit_cc
```

---

## 🗄️ Database Migrations & Seeding

Run the migration and seeding scripts in sequence using `tsx`:

```bash
# 1. Initialize PostgreSQL database and core schema
npx tsx scripts/init-db.ts

# 2. Seed default roles, permissions, clearance tiers, and primary accounts
npx tsx scripts/seed.ts

# 3. Apply Multi-Organization Collaboration & Federation Schema
npx tsx scripts/migrate-collaboration.ts

# 4. Seed Dynamic Taxonomies, Multi-Agency Fleet & Cross-Org Requisitions
npx tsx scripts/seed-collaboration.ts

# 5. Seed Statutory Retention Schedules & Legal Holds
npx tsx scripts/seed-retention-policies.ts
```

---

## 🔑 Pre-Seeded Demo Accounts & Credentials

The seed pipeline generates complete pre-configured roles across government tiers with granular security clearances:

| Role Code | Role Name | Email / Login | Password | Clearance Level | Primary Responsibilities |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | Principal Systems Administrator | `admin@dms.gov.in` | `Admin@DMS2026!` | **T5 (Top Secret)** | Full system governance, org setup, KMS & fleet management |
| `DEPT_HEAD` | Section Head / Designated Approver | `depthead@dms.gov.in` | `Head@DMS2026!` | **T4 (Sensitive)** | Maker-Checker review, dual-custody approval/rejection |
| `INVESTIGATING_OFFICER` | Senior Dealing Officer | `officer@dms.gov.in` | `Officer@DMS2026!` | **T3 (Confidential)** | Document ingestion, drafting, metadata tagging, change requests |
| `AUDITOR` | Chief Vigilance & Compliance Auditor | `auditor@dms.gov.in` | `Auditor@DMS2026!` | **T5 (Top Secret)** | Read-only access to audit trails, user profiles & Merkle ledger |

> [!TIP]
> You can also explore multi-organization switching and federation features under `/federation-admin` and `/inter-org-admin`.

---

## 🔍 Verification & Health Checks

Run the automated diagnostic suite to verify that all 9 subsystems are healthy and connected:

```bash
npx tsx scripts/verify-all-connections.ts
```

**Output Checklist Verified:**
* [x] PostgreSQL 16/18 Core Tables & Schemas
* [x] MinIO S3 Object Storage Bucket (`dms-documents`)
* [x] HashiCorp Vault KMS Transit Key Engine
* [x] Redis 7 In-Memory Cache, Rate Limiter & Job Queues
* [x] PostgreSQL GIN Full-Text OCR Search Vector Index
* [x] Maker-Checker Dual-Custody Approval Engine
* [x] Auditor 360 Immutable Hash Ledger (0% Tampered Hashes)
* [x] Statutory Retention Moratoriums & Legal Holds
* [x] Evidentiary Notification & Security Alert Engine

---

## 🏃 Running the Application

### Start the Next.js Development Server
```bash
npm run dev
```
Open your browser at **[http://localhost:3000](http://localhost:3000)**.

### Production Build & Launch
```bash
npm run build
npm run start
```

---

## 🔗 Hyperledger Fabric Blockchain Setup (Optional)

If you wish to test with an enterprise Hyperledger Fabric 2.5 blockchain network rather than the zero-dependency simulated ledger:

1. **Set Blockchain Mode in `.env`**:
   ```env
   BLOCKCHAIN_MODE=fabric
   ```
2. **Start the Fabric Network Containers**:
   ```bash
   npm run fabric:up
   ```
   *(Or on Windows PowerShell: `.\scripts\fabric-up.ps1`)*
3. **Sync Audit Hashes to the Ledger**:
   ```bash
   npm run fabric:sync
   ```
4. **Stop the Fabric Network**:
   ```bash
   npm run fabric:down
   ```

---

## 📜 Public Verification & Section 65B Certificates

### Public Document Verification Portal
Anyone with a document hash or QR code can verify its authenticity without logging into the system:
* Navigate to **`http://localhost:3000/verify`**
* Scan the document QR code using your webcam or enter the SHA-256 fingerprint.
* The system evaluates cryptographic integrity, WORM status, and blockchain ledger provenance.

### Section 65B(4) Certificate Generation
* Within any document dossier on the dashboard, click **"Generate 65B Certificate"**.
* The server compiles a judicial Word/PDF certificate containing:
  * Device & Custody Details
  * Cryptographic SHA-256 Checksums
  * Timestamped Ledger Audit Chain
  * Digital Signature of the Designated Certifying Officer

---

## 🌐 Cloudflare Remote Tunnel

To present or test the live application across remote devices without port-forwarding:

```bash
npm run tunnel
```
This executes `cloudflared tunnel` and outputs a temporary secure HTTPS public URL (e.g., `https://random-subdomain.trycloudflare.com`).

---

## 📂 Directory Structure

```text
├── app/                          # Next.js App Router
│   ├── api/                      # REST API Endpoints (Auth, Documents, OCR, Approvals, Collaboration)
│   ├── dashboard/                # Main Unified Officer & Admin Dashboard
│   ├── federation-admin/         # Multi-Agency Federation Console
│   ├── inter-org-admin/          # Cross-Organization Requisition Highway
│   ├── login/                    # Login Portal with 3D WebGL Shader
│   ├── verify/                   # Public QR & Hash Verification Portal
│   ├── globals.css               # Design System & Glassmorphism Tokens
│   └── layout.tsx                # Root HTML & Metadata Shell
├── components/                   # React UI Components
│   ├── auth/                     # ShaderGradientBackground (Three.js WebGL)
│   ├── dashboard/                # 20+ Dashboard Modules (Auditor, Ingestion, OCR, etc.)
│   ├── ui/                       # SquareLoader, Modals, Badges, Tabs
│   └── verify/                   # MobileQrScanner (Webcam QR parser)
├── docker/                       # Docker & Blockchain configs
│   └── fabric/                   # Hyperledger Fabric 2.5 Docker Compose & Crypto Configs
├── lib/                          # Core Enterprise Backend Libraries
│   ├── auth/                     # JWT, RBAC & Clearance Matrix
│   ├── blockchain/               # Hyperledger Fabric Client & Simulated Ledger
│   ├── cache/                    # Redis 7 Client & Rate Limiter
│   ├── crypto/                   # HashiCorp Vault KMS Envelope Encryption & SHA-256
│   ├── db.ts                     # PostgreSQL Connection Pool & Query Wrapper
│   ├── jobs/                     # 5-Tier Job Queues & AutoRunner
│   ├── notifications/            # Evidentiary Security Alert Service
│   ├── ocr/                      # Tesseract OCR 7.0 Pipeline & GIN Parser
│   ├── security/                 # WORM Tamper-Proofing & Retention Guard
│   └── storage/                  # MinIO S3 Object Storage Service
├── scripts/                      # 50+ CLI Diagnostic, Migration & Seeding Scripts
│   ├── init-db.ts                # Database Creation & Schema Loader
│   ├── seed.ts                   # Core User & Role Seeder
│   ├── migrate-collaboration.ts  # Multi-Agency Federation Schema
│   ├── seed-collaboration.ts     # Dynamic Taxonomies & Demo Fleet Seeder
│   ├── seed-retention-policies.ts# Retention Schedules Seeder
│   └── verify-all-connections.ts # End-to-End System Integrity Diagnostic Suite
├── public/                       # Static Assets & Icons
├── .env.example                  # Environment Configuration Template
├── Dockerfile                    # Multi-stage Production Container Build
├── package.json                  # Dependencies & NPM Scripts
└── tsconfig.json                 # TypeScript Configuration
```

---

## 🛠️ Available Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` with Turbopack |
| `npm run build` | Compiles optimized production bundle |
| `npm run start` | Runs the compiled production server |
| `npm run lint` | Runs ESLint analysis across the repository |
| `npm run tunnel` | Opens a secure live public Cloudflare Tunnel |
| `npm run fabric:up` | Boots Hyperledger Fabric 2.5 containers (Peer, Orderer, CouchDB, CA) |
| `npm run fabric:down` | Gracefully shuts down Fabric containers and volumes |
| `npm run fabric:logs` | Streams live logs from Hyperledger Fabric nodes |
| `npm run fabric:sync` | Synchronizes local audit hashes with the blockchain chaincode |
| `npx tsx scripts/verify-all-connections.ts` | Runs the full 9-layer system connection & integrity test |
| `npx tsx scripts/clean-full-system.ts` | Resets all test documents, dockets, and audit caches |
| `npx tsx scripts/enforce-worm-immutability.ts` | Validates and enforces WORM rules across all database records |

---

## ❓ Troubleshooting & FAQ

### 1. `error: column reference "document_id" is ambiguous`
* **Fix**: Ensure you have executed the latest migration scripts (`npx tsx scripts/migrate-collaboration.ts`). All audit queries have been disambiguated with explicit table alias qualifiers (`d.id`).

### 2. `PostgreSQL ECONNREFUSED 127.0.0.1:5432`
* **Fix**: Ensure your Docker PostgreSQL container is running:
  ```bash
  docker compose up -d postgres
  ```

### 3. `MinIO / S3 Connection Warning`
* **Fix**: Ensure MinIO is active at port 9000 and the bucket `dms-documents` exists. The system will automatically create the bucket if credentials in `.env` match `minioadmin` / `minioadmin`.

### 4. `ShaderGradient / WebGL Warning in Browser Console`
* **Note**: A non-blocking deprecation notice from Three.js r183+ may appear in development mode. This is suppressed in production and does not impact performance or UI stability.

### 5. `OCR traineddata loading error`
* **Fix**: The repository includes `eng.traineddata` in the project root. Tesseract.js will automatically utilize local worker cache.

---

## 📄 License & Intellectual Property

Developed for the **Smart India Hackathon (SIH)**.  
Built for sovereign government, judicial, and high-security public sector document management applications.
