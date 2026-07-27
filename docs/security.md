# Security Audit & Findings

> **Scope:** Prototype — Node.js/Express backend, SQLite database, Next.js frontend, ERC-1155 Solidity contract.
> **Date:** July 2026 | **Status:** Prototype / PoC — NOT production-ready.
>
> **Related:** For prototype scope boundaries and simulation disclaimers, see [Known Limitations](../known-limitations.md).

This document is a full-stack security assessment of the current implementation covering confirmed issues in the code, architectural weaknesses, and guidance on what must be addressed before any real-world deployment.

Vulnerabilities are ranked using the **[OWASP Risk Rating Methodology](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology)**. Each finding includes a **Likelihood** score (1–3: Low/Medium/High) and an **Impact** score (1–3: Low/Medium/High), producing an overall **Risk** rating of **Critical / High / Medium / Low**.

*Note: The issues below apply to the streamlined prototype stack (Next.js, simulated smart contracts, SQLite). The proposed enterprise production architecture (PostgreSQL, Hyperledger Fabric, TEEs) is designed to resolve these at scale.*

---

## Critical Risk

> Risk = High Likelihood × High Impact

### C-1: Wildcard CORS (`index.ts:10`)
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — trivial to exploit from any browser |
| Impact | High (3) — any origin can make authenticated API calls |
| **Risk** | **Critical** — OWASP A05: Security Misconfiguration |

```ts
app.use(cors()); // allows ANY origin
```
- **Fix:** `cors({ origin: 'https://eclimai.io', credentials: true })`

---

### C-2: No Authentication on Any API Route
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — any network-reachable request is sufficient |
| Impact | High (3) — full privilege escalation: approve, mint, retire, transfer any token |
| **Risk** | **Critical** — OWASP A01: Broken Access Control |

Every state-changing endpoint (`/approve`, `/retire`, `/buy`, `/relist`, `/cancel`, `/transfer`, `/reject`) is completely unprotected. Anyone reaching port 3001 can perform any action without credentials.
- **Fix:** Implement JWT middleware. Verify wallet signatures using [SIWE (EIP-4361)](https://eips.ethereum.org/EIPS/eip-4361) for role-gated actions.

---

### C-3: Hardcoded Admin Secret (`routes.ts:14`)
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — secret is in public source code |
| Impact | High (3) — any reader of this repo can claim Admin and mint tokens |
| **Risk** | **Critical** — OWASP A02: Cryptographic Failures |

```ts
if (secretCode === '2026') { // grant admin
```
- **Fix:** Remove the secret. Replace with wallet-signature authentication (SIWE). Never commit secrets to version control.

---

### C-4: Insufficient Session Authentication
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — session state is client-controlled |
| Impact | High (3) — session can be spoofed to impersonate any role |
| **Risk** | **Critical** — OWASP A07: Identification and Authentication Failures |

The role state lives entirely in the browser. There is no server-side session validation.
- **Fix:** Role and session must be validated server-side via signed JWT coupled with EIP-712 wallet signatures. KYC status stored securely in PostgreSQL, never trusted from the client.

---

### C-5: No Input Validation on API Routes
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — any HTTP client can send crafted payloads |
| Impact | High (3) — arbitrary carbon credit amounts can be generated (e.g., `baselineKwh: 999999999`) |
| **Risk** | **Critical** — OWASP A03: Injection |

The `/api/calculate` route accepts `baselineKwh`, `actualKwh`, and `emissionFactor` from `req.body` with no type checks, range checks, or sanitisation.
- **Attack vector:** A malicious actor could send `baselineKwh: 999999999` or `emissionFactor: -1` to generate fraudulently inflated or negative carbon credits without any resistance from the server.
- **Fix:** Use `zod` or `joi` for schema validation. Clamp emission factors to known regulatory ranges (e.g., 0.001–2.0). Reject negative values outright.

---

## High Risk

> Risk = High Likelihood × Medium Impact, or Medium Likelihood × High Impact

### H-1: No Rate Limiting
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — no throttling at any layer |
| Impact | Medium (2) — spam-creates fraudulent projects, exhausts DB |
| **Risk** | **High** — OWASP A05: Security Misconfiguration |

- **Fix:** Add `express-rate-limit`. Strict limits on state-changing routes (e.g., max 10 POSTs/min per IP on `/api/calculate`).

---

### H-2: SQLite as Production Database
| OWASP Factor | Score |
|---|---|
| Likelihood | Medium (2) — requires file system access |
| Impact | High (3) — entire database readable/writable with any SQLite browser tool; no access controls |
| **Risk** | **High** — OWASP A04: Insecure Design |

- **Fix:** Migrate to PostgreSQL with row-level security, encrypted at-rest storage, WAL mode, and per-service-account DB permissions.

---

### H-3: Mutable Audit Log
| OWASP Factor | Score |
|---|---|
| Likelihood | Medium (2) — requires DB access |
| Impact | High (3) — audit history can be silently deleted or edited; violates regulatory immutability requirements |
| **Risk** | **High** — OWASP A04: Insecure Design |

- **Fix:** On each state transition, compute a Merkle root of the log entry and store it on-chain or IPFS. Future: append-only ledger backed by Hyperledger Fabric.

---

### H-4: `exec()` with Path from Config (`routes.ts:162`)
| OWASP Factor | Score |
|---|---|
| Likelihood | Low (1) — currently safe because paths are hardcoded |
| Impact | High (3) — if ever made user-configurable, direct OS command injection |
| **Risk** | **High** — OWASP A03: Injection |

```ts
exec(`${forgeCmd} test`, { cwd: contractsDir }, ...)
```
- **Fix:** Never allow user input to influence `exec()` arguments. Remove this endpoint entirely in production; run contract tests only in CI/CD.

---

### H-5: No Real On-Chain Minting
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — by design in the prototype |
| Impact | High (3) — creates impression of on-chain guarantees that do not exist |
| **Risk** | **High** — OWASP A04: Insecure Design |

The "Mint & List" action only updates the SQLite `status` column to `'issued'`. The `EclimAiCarbonCredit.sol` contract exists and is tested with Foundry but is not wired into the backend mint flow.
- **Risk:** The prototype creates the impression of on-chain guarantees that do not exist. Any demo to investors or evaluators must clearly communicate this gap — the token issuance is fully simulated.
- **Fix:** Integrate `ethers.js` or `viem` into the backend. On `/projects/:id/approve`, trigger a real `contract.mintCredit()` transaction using an admin wallet loaded from `.env` (never committed to git).

---

### H-6: Client-Side-Only Tamper Detection
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) — backend accepts any data the frontend sends |
| Impact | Medium (2) — no real integrity guarantee; Merkle root check is cosmetic only |
| **Risk** | **High** — OWASP A04: Insecure Design |

The "random hash failure" during CSV import is simulated by randomly appending `(Tampered)` to a building name in the frontend. The backend has no independent hash generation or validation — it accepts whatever name the frontend sends.
- **Risk:** There is no real data integrity check. A production system must construct the Merkle tree of the raw CSV rows server-side and store the root immutably on first write. On any subsequent read, recompute and compare. If they differ, reject and flag the record.
- **Fix:** Move Merkle root generation to the backend `/api/calculate` route. Accept an optional `integrity_hash` field from the CSV, recompute server-side, compare, and reject on mismatch.

---

## Medium Risk

> Risk = Medium Likelihood × Medium Impact

### M-1: No HTTPS / TLS
| OWASP Factor | Score |
|---|---|
| Likelihood | Medium (2) |
| Impact | Medium (2) — credentials, token data, audit logs sent in plaintext |
| **Risk** | **Medium** — OWASP A02: Cryptographic Failures |

- **Fix:** Terminate TLS at a reverse proxy (Nginx or Caddy). Never expose the raw Node server over HTTP.

---

### M-2: No Security Headers (`helmet.js`)
| OWASP Factor | Score |
|---|---|
| Likelihood | Medium (2) |
| Impact | Medium (2) — missing `CSP`, `X-Frame-Options`, `HSTS`, `X-XSS-Protection` |
| **Risk** | **Medium** — OWASP A05: Security Misconfiguration |

- **Fix:** `app.use(helmet())` — one line, major improvement.

---

### M-3: Error Messages Leak Internal Info
| OWASP Factor | Score |
|---|---|
| Likelihood | Medium (2) |
| Impact | Medium (2) — exposes internal file paths and library versions |
| **Risk** | **Medium** — OWASP A09: Security Logging and Monitoring Failures |

```ts
} catch (e) {
  console.error("Failed to fetch backend data", e);
}
```
- **Attack vector:** Full stack traces and internal file paths are currently returned in API error responses. An attacker can use these to map the server's directory structure and library versions, enabling more targeted follow-up attacks.
- **Fix:** Centralise error handling middleware. Return generic `{ error: 'Internal Server Error' }` to the client. Log detailed errors server-side only.

---

### M-4: No Pagination on `/api/projects`
| OWASP Factor | Score |
|---|---|
| Likelihood | Low (1) |
| Impact | Medium (2) — memory exhaustion and slow queries at scale |
| **Risk** | **Medium** — OWASP A04: Insecure Design |

The `GET /api/projects` route returns all rows with a four-table JOIN with no row limit or pagination. With thousands of projects this becomes a slow, memory-hungry query that can hang the server.
- **Fix:** Add `LIMIT` and `OFFSET` query parameters. Add database indexes on `projects.status`, `buildings.owner_id`, and `audit_log.project_id`.

---

### M-5: Raw Request Body Stored Verbatim
| OWASP Factor | Score |
|---|---|
| Likelihood | Medium (2) |
| Impact | Medium (2) — information leakage and storage bloat |
| **Risk** | **Medium** — OWASP A09: Security Logging and Monitoring Failures |

```ts
JSON.stringify(req.body) // stored in calculations table
```
- **Attack vector:** An attacker can send arbitrary extra fields in the request body (e.g., `{ "__proto__": {...} }` or oversized JSON blobs), which are stored verbatim in the database. This can be exploited for prototype pollution, storage exhaustion, or leaking injected data through future API reads.
- **Fix:** Store only the known-good subset: `{ buildingId, periodStart, periodEnd, baselineKwh, actualKwh, emissionFactor }`.

---

### M-6: KYC is Entirely Simulated
| OWASP Factor | Score |
|---|---|
| Likelihood | High (3) |
| Impact | Medium (2) — no AML/CFT enforcement; regulatory risk in EU and US |
| **Risk** | **Medium** — Regulatory / OWASP A07 |

The KYC flow on the Market Buyer page accepts any company name and immediately grants `kycCompleted = true`. There is no identity verification, document check, or third-party KYC provider involved.
- **Risk:** This is fine for a demo but must never reach production without integrating a real KYC provider. Selling carbon credits without proper KYC/AML checks could violate EU AMLD and US FinCEN regulations, exposing the platform to regulatory shutdown.
- **Fix:** Integrate a real KYC provider (Jumio, Onfido, or Veriff) before any production deployment.

---

## Low Risk

> Risk = Low Likelihood × Low/Medium Impact

### L-1: No Wallet Signature Verification
The `/api/auth/claim-admin` endpoint accepts `walletAddress` from `req.body` and trusts it without any cryptographic proof that the caller actually controls that wallet. Anyone can claim any wallet address.
- **Fix:** Require ECDSA signature (`eth_sign` / EIP-712) to prove wallet ownership before any role is assigned.

### L-2: Emission Factors Hardcoded in Frontend
SEAI 2025 (`0.2241`) and DEFRA 2025 (`0.1280`) are hardcoded in UI dropdowns. They change annually.
- **Fix:** Source from a Chainlink Data Feed or a regularly updated regulatory API.

### L-3: No Session Expiry
No JWT expiration or refresh-token rotation.
- **Fix:** Implement strict JWT TTL and refresh token rotation on security events.

### L-4: Predictable Seed Data IDs
```ts
{ id: 'proj-1' }, { id: 'proj-2' }
```
Predictable IDs make API enumeration trivial.
- **Fix:** Use UUIDs for all seed records (already done for user-created records).

### L-5: No Structured Logging
No Winston, Pino, or Morgan. Every API call and state transition should produce a structured log entry for compliance.

### L-6: Single-Key Smart Contract Admin
Deployer wallet holds both `DEFAULT_ADMIN_ROLE` and `MINTER_ROLE`. One compromised key = full token economy takeover.
- **Fix:** Use a [Gnosis Safe](https://safe.global/) multi-sig wallet requiring m-of-n signatures from verified regulators to mint or pause.

---

## Compliance & Regulatory Notes

| Area | Current State | Production Requirement |
|------|--------------|----------------------|
| KYC/AML | Simulated (any name accepted) | Real KYC provider (Jumio/Onfido) + sanctions screening |
| Data Residency | Local SQLite file | Must meet GDPR data residency requirements for EU users |
| Audit Trail Immutability | Mutable SQLite table | Append-only log, Merkle root anchored on IPFS or chain |
| Smart Contract Audit | Foundry unit tests only | Mandatory third-party audit before mainnet deployment |
| Emission Factor Sourcing | Hardcoded | Must reference ISO 14064 / GHG Protocol certified sources |
| Double-Counting Prevention | Frontend checkbox attestation | Cross-registry API checks (Gold Standard, Verra) + on-chain uniqueness |

---

## Summary Risk Matrix (OWASP Rated)

| Issue | Likelihood | Impact | Risk |
|-------|-----------|--------|------|
| Wildcard CORS | High | High | **Critical** |
| No API authentication | High | High | **Critical** |
| Hardcoded admin secret | High | High | **Critical** |
| Weak session auth | High | High | **Critical** |
| No input validation | High | High | **Critical** |
| No rate limiting | High | Medium | **High** |
| SQLite as database | Medium | High | **High** |
| Mutable audit log | Medium | High | **High** |
| Command injection risk | Low | High | **High** |
| No on-chain minting | High | High | **High** |
| Client-side tamper only | High | Medium | **High** |
| No HTTPS/TLS | Medium | Medium | **Medium** |
| No security headers | Medium | Medium | **Medium** |
| Error info leakage | Medium | Medium | **Medium** |
| No pagination | Low | Medium | **Medium** |
| Raw body stored verbatim | Medium | Medium | **Medium** |
| Simulated KYC | High | Medium | **Medium** |
| No wallet sig verification | Low | Low | **Low** |
| Hardcoded emission factors | Low | Low | **Low** |
| No session expiry | Low | Low | **Low** |
| Predictable seed IDs | Low | Low | **Low** |
| No structured logging | Low | Low | **Low** |
| Single-key admin role | Low | High | **Low** |

---

📖 [README](../README.md) · 🏗️ [Architecture](./architecture.md) · ⚠️ [Known Limitations](../known-limitations.md) · 🚀 [Future Architecture](./architecture-future.md) · 📚 [References](./references.md)
