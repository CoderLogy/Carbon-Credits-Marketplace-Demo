# Master PRD — EclimAi Blockchain Carbon Credit Prototype

## 1. Executive Summary
**Purpose:** Create a fully working, browser-based prototype demonstrating a blockchain-based carbon credit tokenization marketplace for EclimAi.
**Scope:** Covers the core EclimAi Blockchain Intern Technical Assessment requirements, while architecturally positioning the platform to scale into a Data Pipeline SaaS and "Discount-for-Credits" asset generation business model.
**Target Network:** Polygon Amoy testnet.
**Deadline:** July 26, 2026

## 2. Roles and Permissions

| Role | Real-World Equivalent | Responsibility | Access |
|------|------------------------|----------------|--------|
| **Project Developer** | Property Owner / ESG Manager | Submits energy data, initiates mint requests | Read/Write own projects |
| **Auditor** | VVB (Validation Body) | Verifies calculations and evidence Merkle root | Read all submitted projects, Approve/Reject |
| **Admin** | EclimAi Bridge (API triggered) | Detects Registry freeze, mints tokens, manages marketplace | Mint/Issue tokens, Cancel marketplace listings |
| **Buyer** | Corporate Offset Buyer | Purchases, holds, re-lists, transfers, or retires credits | Read marketplace, Buy/List/Transfer/Retire |

## 3. Functional Requirements

### 3.1 Data Input (FR-DI)
- **FR-DI-001:** System must allow manual entry and CSV upload of building energy consumption data.
- **FR-DI-002:** Required fields include baseline kWh, actual kWh, and region.

### 3.2 Carbon Calculation (FR-CC)
- **FR-CC-001:** System must calculate avoided emissions using: `(Baseline - Actual) * EmissionFactor / 1000`.
- **FR-CC-002:** Must use official, European-compliant emission factors (e.g., SEAI 2025: 0.2241 kg CO2/kWh, DEFRA 2025: 0.1280 kg CO2/kWh).
- **FR-CC-003:** Calculation results must display a disclaimer stating they are estimates pending verification.

### 3.3 Approval Workflow (FR-AW)
- **FR-AW-001:** Projects transition through: `Draft → Pending Review → Approved → Issued → Sold → [Listed (buyer-relisted) | Retired | Transferred]`. *Note: `Listed` originates either from Admin mint (`issued`) or Buyer re-listing (`listed`, with `owner_id=buyer`). These are distinct DB states.*
- **FR-AW-002:** Only Auditor (VVB) can approve calculations to permit issuance by Admin (EclimAi Bridge).

### 3.4 Tokenization (FR-TK)
- **FR-TK-001:** Tokenize approved credits as ERC-1155 on Polygon testnet.
- **FR-TK-002:** Prevent duplicate issuance via `sourceHash`.

### 3.5 Marketplace (FR-MP)
- **FR-MP-001:** Admins list minted credits at issuance. Buyers who own credits (`sold` status) may also re-list them at their own price.
- **FR-MP-002:** Buyers can execute atomic swaps via smart contract to purchase credits.
- **FR-MP-003:** Admin can cancel any active marketplace listing, including buyer-listed credits. Cancelled buyer listings revert credit to buyer portfolio (`sold`). Admin cannot update pricing on buyer-owned credits. All cancellations are recorded in audit history with actor attribution.

### 3.6 Retirement (FR-RT)
- **FR-RT-001:** Owners can permanently retire credits, specifying a beneficiary and purpose.
- **FR-RT-002:** Retired credits cannot be listed or transferred.
- **FR-RT-003:** A credit that is actively listed cannot be retired. Buyer must cancel listing first.

---
📖 [README](README.md) · 🏗️ [Architecture](docs/architecture.md)

## 4. Technical Architecture

- **Frontend:** Next.js (React), ethers.js/viem, Tailwind CSS.
- **Backend:** Node.js/Express APIs, SQLite database for prototype (PostgreSQL planned for Phase 1 production hardening).
- **Smart Contracts:** Solidity, deployed on Polygon Amoy testnet, OpenZeppelin ERC-1155.

## 5. Definition of Done
### Prototype DoD (Current)
- Browser-based demonstration is fully functional across all 4 roles.
- End-to-end lifecycle (Import → Calculate → Approve → Mint → Sell → Retire) operates flawlessly via SQLite state simulation.
- Smart contracts are written and verified passing 7 Foundry unit tests.

### Production DoD (Phase 1 Roadmap)
- Live MetaMask / wallet integration works.
- Smart contracts are verified on Polygon Amoy explorer.
- Ethers.js integration handles live mint/buy/retire transactions.
