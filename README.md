# EclimAi Prototype

> Transforming corporate energy efficiency into verified, on-chain carbon credits. Powered by automated MRV calculations, role-based workflows, and tamper-evident architecture.
> 
> *Built with the help of [Google Antigravity](https://deepmind.google/technologies/gemini/).*

[![](https://img.shields.io/badge/Web3-Carbon%20Credits-22c55e?style=social)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Polygon Amoy](https://img.shields.io/badge/Network-Polygon%20Amoy-8247E5)](https://amoy.polygonscan.com/)
[![React](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity&logoColor=white)](https://docs.soliditylang.org)
[![Foundry](https://img.shields.io/badge/Testing-Foundry-red)](#)

## The EclimAi Business Model

The voluntary carbon market faces challenges with double-counting, fragmented methodologies, and unauthorized tokenization. EclimAi addresses these issues by providing foundational infrastructure that connects Project Developers, Validation Bodies (VVBs), and legacy Registries. 

Our commercial strategy focuses on two areas:
1. **Data Pipeline SaaS:** A secure Web2 processing engine that automates MRV calculations and cryptographic hashing. We charge building owners a recurring license fee while providing VVBs with audit-ready data.
2. **"Discount-for-Credits" Asset Generation:** Offering upfront smart HVAC hardware subsidies in exchange for contractual rights to the generated carbon savings, allowing EclimAi to tokenize and sell these credits directly to institutional buyers.

## System Architecture

### Current Implementation: End-to-End Traceability

```
┌─────────────────────────────────────────────────────────┐
│  AUTOMATED MRV (Measurement, Reporting, Verification)   │
│  ├─ Energy consumption data ingestion                   │
│  ├─ Baseline vs Actual tracking                         │
│  ├─ Defra/SEAI emission factor integration              │
│  ├─ Real-time Avoided Emissions (tCO₂e) calculation     │
│  ├─ Cryptographic Merkle tree root data tampering prevention     │
├─────────────────────────────────────────────────────────┤
│  ROLE-BASED GOVERNANCE                                  │
│  ├─ Project Developer: Submits data                     │
│  ├─ Auditor: Reviews and verifies calculations          │
│  ├─ Admin: EclimAi bridge (mints tokens post-registry freeze) │
│  └─ Market Buyer: Purchases → holds in portfolio → re-lists / transfers / retires │
├─────────────────────────────────────────────────────────┤
│  ON-CHAIN INTEGRATION (Polygon)                         │
│  ├─ ERC-1155 Token standard for scalable batches        │
│  ├─ Built-in marketplace for listing/purchasing         │
│  ├─ Permanent retirement certificates                   │
│  ├─ Anti-Double Counting mechanisms                     │
│  └─ Full asset lifecycle enforcement (hold → relist → retire/transfer) │
└─────────────────────────────────────────────────────────┘
```

### Production Tech Stack (at scale)

| Layer | Tool / Protocol | Role |
|-------|----------------|------|
| IoT Edge | BACnet/Modbus + MQTT + ARM TrustZone TEE | Hardware-signed readings from BMS systems |
| Ingestion | Apache Kafka / AWS IoT Core | High-throughput stream processing |
| Time-Series DB | TimescaleDB | Millions of timestamped kWh readings |
| Core DB | PostgreSQL (RDS) | Users, KYC, project state — ACID-compliant |
| Orderbook Cache | Redis | Off-chain CLOB matching engine (zero gas) |
| Private Ledger | Hyperledger Fabric | Permissioned VVB audit chain |
| AI Sanitization | Isolation Forest / LSTM | Detect broken sensors and injected data |
| Oracle | Chainlink / dClimate | Tamper-proof weather data (HDD/CDD) |
| ZK Layer | Circom / Groth16 ZK-SNARKs | Prove IPMVP math without exposing raw kWh |
| Decentralized Storage | IPFS / Arweave (Pinata) | Immutable evidence package anchoring |
| Blockchain | Polygon PoS (ERC-1155) | Public, auditable token issuance |
| Settlement | EIP-712 + Atomic Swap | Gasless corporate buyer UX |
| KYC | Jumio / Onfido + Polygon ID | On-chain ZK-proof identity attestation (replaces undeployed SBT standards) |
| Key Management | AWS KMS (HSM-backed) / Fireblocks MPC | Admin minting key — never extractable |
| Infra | Kubernetes (EKS) + Terraform | Container orchestration and IaC |
| Observability | Prometheus + Grafana + Cloudflare WAF | Metrics, logging, DDoS protection |

> **Ecosystem Context:** While EclimAi is a standalone prototype, a full production deployment could integrate with open-source tools like [Hedera Guardian](https://github.com/hashgraph/guardian) (for generic dMRV policy-as-code) and [Thallo](https://www.thallo.io) (for Verra-compliant registry bridging) to accelerate development. In such a stack, EclimAi would operate as the vertical application layer, providing IPMVP-specific energy calculations, IoT hardware integrations, an AI sanitization pipeline, and a native marketplace on top.

## Documentation

| Doc | Purpose |
|-----|---------|
| [Architecture](docs/architecture.md) | Stack, API reference, DB schema, data-flow diagram |
| [Future Architecture](docs/architecture-future.md) | ZKP, Hyperledger Fabric, Chainlink roadmap |
| [Known Limitations](known-limitations.md) | Prototype scope, simulation disclaimers |
| [Security Audit](docs/security.md) | Vulnerability findings, risk register, compliance notes |
| [PRD](PRD.md) | Functional requirements and user stories |
| [Citations](docs/citations.md) | Market size figures and research references |

## Getting Started

### System Requirements & Global Dependencies

Before starting, ensure you have the latest tools installed:

**1. Node.js & npm (v20+)**
Download from [Node.js official site](https://nodejs.org/) or update npm to the latest version:
```bash
npm install -g npm@latest
```

**2. Foundry (Smart Contract Toolkit)**
Foundry is required to compile and test the Solidity contracts.

*For Mac / Linux:*
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

*For Windows:*
Download and run the Foundry installer via Git BASH or Powershell:
```powershell
curl.exe -L "https://foundry.paradigm.xyz" -o foundryup.cmd
.\foundryup.cmd
```

---

### Quick Start (One Command)
To run the entire application (both frontend and backend) simultaneously, install root dependencies and run the root `dev` script:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the prototype. *Note: Running `npm run dev` automatically wipes the backend SQLite database and seeds it with fresh demonstration data.*

### Manual Setup (Separate Terminals)

If you prefer to run the components independently:

**1. Backend Server**
```bash
cd backend
npm install
npm run dev
```

**2. Smart Contracts**
```bash
cd contracts
forge install
forge test
```
*Note: The test suite includes 7 comprehensive unit tests verifying token transfers, access control, and double-retirement prevention.*

**3. Frontend App**
```bash
cd frontend
npm install
npm run dev
```


