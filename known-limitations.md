# EclimAi Prototype — Known Limitations

> For security vulnerabilities, attack vectors, and the full production risk register,
> see [Security Audit](docs/security.md).

As requested in the project deliverables, the following items outline the known limitations of the current prototype and its deviations from a full production-ready system.

*Note: These limitations are intentional boundaries of the current streamlined prototype. The enterprise roadmap described in [Future Architecture](docs/architecture-future.md) directly addresses these constraints (e.g., migrating from simulated SQLite state to true on-chain and decentralized consortium settlement).*

## 1. Simulated Blockchain Elements
- **Local Testnet:** The current environment uses a local simulated environment or a testnet (Polygon Amoy). The smart contract interactions on the frontend are simulated in the demo flow to allow evaluators to experience the full end-to-end workflow without needing to set up a Web3 wallet (MetaMask) or acquire testnet tokens.
- **Smart Contract Connect:** While the Solidity contracts in `contracts/src/` are fully featured ERC-1155 tokens, the frontend does not make live `ethers.js` or `wagmi` calls in this prototype version.
- **Retirement Mechanism:** The full credit lifecycle (purchase → hold → relist / transfer / retire) is implemented in the backend DB and UI. On-chain contract invocation remains simulated — `EclimAiCarbonCredit.sol` exists and is tested but `mint()`, `buy()`, and `retire()` are not yet called from the backend. See [security.md → H-5](docs/security.md#h-5-fakesimulated-smart-contract-interaction).

## 2. Simplified Security & KYC
- **KYC Simulation:** The "Complete KYC Verification" gate is a simulated one-click process. KYC state now persists across page reloads but auto-resets on server restart via a boot-time timestamp check (`GET /api/system/info`). See [security.md M-6](docs/security.md#m-6-kyc-is-entirely-simulated) for the production risk regarding session validation. In production, this would integrate with a real identity provider (e.g., SumSub or Stripe Identity) and secure JWT/EIP-712 sessions.
- **Data Hashing:** The prototype uses a simplified hash for tamper evidence demonstration. A production system would use a cryptographic hash (e.g., SHA-256) committed on-chain as the `evidenceHash`.

## 3. Calculation Engine
- **Emission Factors:** We use a static lookup table with two options (SEAI 2025 and DEFRA 2025) to demonstrate regional variation. A production system would integrate with a live emission factor API.
- **Real-time Data:** The system assumes manual or CSV upload of energy data. Production would connect directly to smart meters or building management systems (BMS) via API.

## 4. Role & State Persistence
- **Mock Authentication:** Role switching is currently done via a UI dropdown for ease of demonstration. In production, this would be gated by wallet authentication and strict Role-Based Access Control (RBAC).
- **Double Counting Checks:** The system includes an attestation checkbox for double counting, but it does not currently cross-reference external registries (e.g., Verra or Gold Standard) to verify the claim. The buyer lifecycle enforces state constraints server-side: a listed credit cannot be retired; a retired credit cannot be listed or transferred. These constraints are SQLite-enforced only — not on-chain.

## 5. Data Privacy & Zero-Knowledge Proofs
- **Current State:** The frontend and backend process raw energy consumption data (Baseline kWh and Actual kWh) in plain text.
- **Future Mitigation:** ZK-SNARKs. Corporations generate a local proof demonstrating energy reduction satisfies the carbon equation, submitting only the proof — not raw kWh. See [Future Architecture](docs/architecture-future.md#phase-3-zero-knowledge-privacy).

## 6. Off-Chain vs On-Chain Storage
- **Current State:** The tCO₂e result, emission factors, beneficiary name, and retirement purpose are stored off-chain in SQLite only. Token metadata on-chain does not yet include beneficiary/purpose fields. See [Architecture → DB Schema](docs/architecture.md#database-schema).
- **Future Mitigation:** Store the SHA-256 hash of the full audit log in the ERC-1155 token's on-chain metadata URI (pinned to IPFS), creating a tamper-evident link.

## 7. Network & Scalability
- **Current State:** Smart contract targets Polygon Amoy (EVM-compatible, low gas cost).
- **Limitation:** Batch minting and high-frequency IoT data ingestion would become cost-prohibitive on a public chain at scale.
- **Future Mitigation:** Layer-2 rollup or AppChain for MRV processing; settle only aggregated batches to mainnet.

## 8. Credit Lifecycle State Machine
- **Current State:** Credits follow a full lifecycle: `issued → sold → [listed | retired | transferred]`. Buyers hold credits in a portfolio and independently choose to re-list, transfer, or retire. All transitions are enforced in SQLite only — not on-chain.
- **Implication:** A database compromise could theoretically revert a retired credit. See [security.md → H-5](docs/security.md#h-5-fakesimulated-smart-contract-interaction).
- **Future Mitigation:** Wire lifecycle transitions to on-chain contract calls. The ERC-1155 `retire()` function already enforces irreversibility on-chain — it just needs to be called from the backend.

---

## 9. Systemic Vision Limitations
- **Regulatory Risk:** Stringent KYC and AML compliance mandates, acquiring ISO security certifications, and navigating strict financial regulatory oversight for tokenized asset trading.
- **Registry Integration Hurdle:** Scaling the platform requires massive upfront adoption of the data pipeline by Project Developers before network effects sufficiently incentivize legacy registries (Verra/Gold Standard) to integrate their APIs directly with our smart contracts.
- **Hardware Oracle Risk:** The prototype assumes the integrity of the raw energy data at the point of entry. If IoT sensors or smart meters are physically tampered with before data reaches the processing layer, the resulting credits are compromised. Future integrations require secure, edge-signed hardware proofs (e.g., ARM TrustZone TEEs) to guarantee source data fidelity.
- **Registry Alignment Risk:** Any divergence between a credit's status on the platform and its status on the external registry (Verra, Gold Standard) creates a compliance breach. If a credit appears active on the platform but has been retired or revoked externally, any subsequent trade would constitute a fraudulent transaction. The production architecture requires a real-time registry reconciliation layer to detect and suspend affected credits immediately.
- **Assumptions:** This prototype assumes registries such as Verra or Gold Standard will grant API-level integration once transaction volume justifies it, that buildings already have utility-meter-level consumption data available at IPMVP Option C granularity, and that at least one accredited VVB is willing to partner ahead of a full registry relationship.

---
📖 [README](README.md) · 🏗️ [Architecture](docs/architecture.md) · 🔐 [Security Audit](docs/security.md) · 🚀 [Future Architecture](docs/architecture-future.md)
