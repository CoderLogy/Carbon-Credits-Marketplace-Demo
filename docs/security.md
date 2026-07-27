# Security Audit & Findings

> **Scope:** EclimAi Prototype — Node.js/Express backend, SQLite database, Next.js frontend, ERC-1155 Solidity contract.
> **Date:** July 2026 | **Status:** Prototype / PoC — NOT production-ready.
> 
> **Related:** For prototype scope boundaries and simulation disclaimers, see [Known Limitations](../known-limitations.md).

This document is a frank, full-stack security assessment of the current implementation covering confirmed issues found in the code, architectural weaknesses, and honest guidance on what the future design must address before any real-world deployment.

*Note: The issues documented here specifically apply to the streamlined prototype stack (Next.js, simulated smart contracts, and SQLite). The proposed enterprise production architecture (PostgreSQL, Hyperledger Fabric, TEEs) is designed precisely to resolve these vulnerabilities at scale.*

## CRITICAL (Must Fix Before Any Real Users)

### C-1: Wildcard CORS (index.ts:10)
```ts
app.use(cors()); // allows ANY origin
```
Every browser on the planet can make authenticated API calls to this backend. In production, CORS must be locked to the exact frontend domain.
- **Fix:** `cors({ origin: 'https://eclimai.io', credentials: true })`

### C-2: No Authentication on Any API Route
Every single endpoint (`/api/projects/:id/approve`, `/api/projects/:id/retire`, `/api/projects/:id/buy`, `/api/projects/:id/relist`, `/api/projects/:id/cancel`, `/api/projects/:id/transfer`, `/api/projects/:id/reject`, etc.) is completely unprotected. Any person who can reach port 3001 can approve, reject, mint, buy, transfer, or retire any token without any credentials. (Note: `/api/system/info` is intentionally public and only returns a timestamp).
- **Fix:** Implement JWT or session middleware. Verify wallet signatures (SIWE — Sign-In With Ethereum) for role-gated actions. Every state-changing endpoint must require a valid bearer token.

### C-3: Hardcoded Admin Secret (`routes.ts:14`)
```ts
if (secretCode === '2026') { // grant admin
```
The "secret" to claim Admin role is the literal year 2026 committed in plaintext source code. Anyone who reads this repo gets Admin access.
- **Fix:** Move to a proper env-var secret, rotate on use, and replace with proper wallet-signature authentication (`SIWE`). Do not commit secrets.

### C-4: Insufficient Authentication Mechanisms
The current prototype relies on basic session state that lacks cryptographic rigor.

- **Fix (Production):** Role and session authentication must be determined server-side via signed JWT coupled with EIP-712 wallet signatures. KYC status must be validated and stored securely server-side in PostgreSQL, utilizing modern crypto protocols to prevent session manipulation.

### C-5: No Input Validation on Any API Route
The `/api/calculate` route accepts `baselineKwh`, `actualKwh`, and `emissionFactor` directly from `req.body` with no type checks, range checks, or sanitisation.
- **Attack vector:** A malicious actor could send `baselineKwh: 999999999` or `emissionFactor: -1` to generate fraudulently inflated or negative carbon credits.
- **Fix:** Use `zod` or `joi` to validate all inputs. Clamp emission factors to known regulatory ranges (e.g., 0.001–2.0). Reject negative values outright.

---

## HIGH (Significant Risk)

### H-1: No Rate Limiting
No route has any rate limiting. The calculation endpoint can be called thousands of times per second to spam-create fraudulent projects.
- **Fix:** Add `express-rate-limit`. Apply strict limits to state-changing routes (e.g., max 10 POSTs/minute per IP for `/api/calculate`).

### H-2: SQLite as Production Database
SQLite is a single-file, single-writer database. It has no user permissions, no network access control, no built-in encryption, and no audit protection. The database file `eclimai_carbon.db` can be directly copied or edited with any SQLite browser tool.
- **Fix (Production):** Migrate to PostgreSQL with row-level security policies, encrypted at-rest storage, and WAL mode. Apply DB-level read/write permissions per service account.

### H-3: Audit Log is Mutable
The `audit_log` table in SQLite is a standard writable table. Nothing prevents someone with DB access from deleting or editing audit entries. An auditor's rejection or approval history could be silently erased.
- **Fix:** On each state transition, compute a Merkle tree root of the log entry and store it on-chain (or on IPFS). Future version: use an append-only ledger backed by Hyperledger Fabric.

### H-4: `exec()` with Path from Config (`routes.ts:162`)
```ts
exec(`${forgeCmd} test`, { cwd: contractsDir }, ...)
```
`forgeCmd` is derived from file-system paths, but if `contractsDir` or `forgeCmd` were ever user-controllable (e.g., via config injection), this would be a direct OS command injection vulnerability. Currently safe because the values are hardcoded, but must never be made user-configurable.
- **Fix:** Never allow user input to influence `exec()` arguments. Consider removing this endpoint entirely in production and running tests only in CI/CD.

### H-5: Fake/Simulated Smart Contract Interaction
The Admin "Mint & List" button does not call any real on-chain transaction. It updates the SQLite `status` column to `'issued'`. The `EclimAiCarbonCredit.sol` contract exists but is not integrated into the backend mint flow.
- **Risk:** The prototype creates the impression of on-chain guarantees that do not exist. Any demo to investors must clearly communicate this gap.
- **Fix (Next milestone):** Integrate `ethers.js` or `viem` into the backend. On `/projects/:id/approve`, trigger a real `contract.mintCredit()` transaction using an admin wallet loaded from a `.env` private key (never committed to git).

### H-6: CSV Import Tamper-Simulation is Client-Side Only
The "random hash failure" during CSV import is simulated by randomly appending `(Tampered)` to a building name in the frontend. The backend has no independent root generation or validation - it accepts whatever name the frontend sends.
- **Risk:** There is no real data integrity check. A real production system must construct the Merkle tree of the raw CSV rows server-side and store the root immutably on first write. On any subsequent read, recompute and compare. If they differ, reject.
- **Fix:** Move Merkle root generation to the backend `/api/calculate` route. Accept an optional `integrity_hash` field from the CSV, recompute server-side, compare, and reject if mismatch.

---

## MEDIUM (Should Address Soon)

### M-1: No HTTPS / TLS
All communication between frontend and backend is over plain HTTP (`http://localhost:3001`). Credentials, token data, and audit logs are sent in plaintext.
- **Fix (Production):** Terminate TLS at a reverse proxy (Nginx/Caddy). Never expose the raw Node server to the internet on HTTP.

### M-2: No Helmet / Security Headers
The backend does not use `helmet.js`. This means the API responses are missing critical security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`).
- **Fix:** `app.use(helmet())` — one line fix, massive security improvement.

### M-3: Error Messages Leak Internal Info
```ts
} catch (e) {
  console.error("Failed to fetch backend data", e);
}
```
Full stack traces are logged to console and, in some cases, returned directly in API responses. This exposes internal file paths and library versions to potential attackers.
- **Fix:** Centralise error handling middleware. Log detailed errors server-side only. Return generic `{ error: 'Internal Server Error' }` to the client.

### M-4: No Pagination on `/api/projects`
The `GET /api/projects` route returns all rows with a four-table JOIN, with no limit or pagination. With thousands of projects this will become a slow, memory-hungry query.
- **Fix:** Add `LIMIT` and `OFFSET` parameters. Add database indexes on `projects.status`, `buildings.owner_id`, and `audit_log.project_id`.

### M-5: `inputs_json` Stores Full Request Body
```ts
JSON.stringify(req.body) // stored in calculations table
```
The entire raw request body (including any unexpected fields sent by an attacker) is stored verbatim in the DB. This is an information-leakage risk and a storage bloat vector.
- **Fix:** Only store a known-good subset of fields: `{ buildingId, periodStart, periodEnd, baselineKwh, actualKwh, emissionFactor }`.

### M-6: KYC is Entirely Simulated
The KYC flow on the Market Buyer page accepts any company name and grants instant `kycCompleted = true`. There is no identity verification, document check, or third-party KYC provider.
- **Risk:** This is fine for a demo but must never reach production without integrating a real KYC provider (e.g., Jumio, Onfido, or Veriff). Selling carbon credits without proper KYC could violate AML/CFT regulations in the EU and US.

---

## LOW / Future Design Considerations

### L-1: No Wallet Signature Verification
The `/api/auth/claim-admin` endpoint accepts `walletAddress` from `req.body` and trusts it without any cryptographic proof that the caller actually controls that wallet. Wallet ownership must be proven via ECDSA signature (`eth_sign` / EIP-712).

### L-2: Emission Factor Hardcoded in Frontend
Emission factors (SEAI 2025 Ireland: `0.2241`, DEFRA 2025 UK: `0.1280`) are hardcoded in the UI dropdown. These change annually. In production, factors should be sourced from an authoritative Chainlink Data Feed or a regularly updated regulatory API, not hardcoded values.

### L-3: Secure Session Expiry
Session states currently lack rigorous time-bound expiration. Implement strict JWT expiration timestamps and refresh token rotation policies to ensure persistent sessions are automatically invalidated over time or upon security events.

### L-4: Seed Data Uses Predictable IDs
```ts
{ id: 'proj-1' }, { id: 'proj-2' }  // etc.
```
Predictable sequential IDs make it trivial to enumerate and target specific projects via the API. Use UUIDs for all records (already done for user-created records — fix the seed data too).

### L-5: No Logging / Observability
There is no structured logging (Winston, Pino), no request logging (Morgan), and no error alerting. In production, every API call and every state transition must produce a structured log entry for compliance and debugging.

### L-6: Single-Key Smart Contract Admin Role
The deployer wallet is automatically granted `DEFAULT_ADMIN_ROLE` and `MINTER_ROLE` via OpenZeppelin AccessControl. A single compromised private key controls the entire token economy.
- **Fix (Production):** Implement a Safe (Gnosis) Multi-Signature Wallet for the Admin role, requiring m-of-n signatures from verified regulators to mint or pause.

---

## Compliance & Regulatory Notes

| Area | Current State | Production Requirement |
|------|--------------|----------------------|
| KYC/AML | Simulated (any name accepted) | Real KYC provider (Jumio/Onfido) + sanctions screening |
| Data Residency | Local SQLite file | Must meet GDPR data residency requirements if serving EU users |
| Audit Trail Immutability | Mutable SQLite table | Append-only log, Merkle root-anchored on IPFS or chain |
| Smart Contract Audit | Foundry unit tests only | Mandatory third-party audit before mainnet deployment |
| Emission Factor Sourcing | Hardcoded | Must reference ISO 14064 / GHG Protocol certified sources |
| Double-Counting Prevention | Frontend checkbox attestation | Cross-registry API checks (Gold Standard, Verra) + on-chain uniqueness check |

---

## Summary Risk Matrix

| Issue | Severity | Effort to Fix | Priority |
|-------|----------|--------------|----------|
| Wildcard CORS | Critical | Low | P0 |
| No API auth | Critical | High | P0 |
| Hardcoded admin secret | Critical | Low | P0 |
| Weak session authentication | Critical | High | P0 |
| No input validation | High | Medium | P1 |
| No rate limiting | High | Low | P1 |
| SQLite in production | High | High | P1 |
| Mutable audit log | High | Medium | P1 |
| No on-chain minting | High | High | P1 |
| Credit lifecycle state in mutable SQLite | High | High | P1 |
| No HTTPS | Medium | Low | P2 |
| No Helmet headers | Medium | Low | P2 |
| No pagination | Medium | Low | P2 |
| Simulated KYC | Medium | High | P2 |
| Predictable seed IDs | Low | Low | P3 |
| No logging | Low | Low | P3 |
| Single-Key Admin Role | Low | High | P3 |

---
📖 [README](../README.md) · 🏗️ [Architecture](./architecture.md) · ⚠️ [Known Limitations](../known-limitations.md) · 🚀 [Future Architecture](./architecture-future.md)
