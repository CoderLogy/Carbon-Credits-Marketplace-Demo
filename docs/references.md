# References

This document lists all libraries, standards, protocols, and frameworks used or referenced in this prototype.

---

## Core Frameworks & Libraries

| Reference | Usage |
|-----------|-------|
| [Next.js](https://nextjs.org/) — Vercel | Frontend React framework (App Router, server-side API proxy via `rewrites`) |
| [React](https://react.dev/) — Meta | UI component model and state management |
| [TypeScript](https://www.typescriptlang.org/) — Microsoft | Strongly-typed superset of JavaScript used across frontend and backend |
| [Node.js](https://nodejs.org/) | Backend JavaScript runtime |
| [Express.js](https://expressjs.com/) | HTTP server and REST API routing for the backend |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Synchronous SQLite3 bindings for Node.js — used as the prototype database |
| [uuid](https://github.com/uuidjs/uuid) | RFC 4122 UUID generation for all database primary keys |
| [cors](https://github.com/expressjs/cors) — expressjs | Express middleware for Cross-Origin Resource Sharing |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework used in the frontend |
| [shadcn/ui](https://ui.shadcn.com/) | Accessible React component library (Dialog, Button, Input, Badge, etc.) |
| [Lucide React](https://lucide.dev/) | Icon library used throughout the frontend |
| [Papa Parse](https://www.papaparse.com/) | Browser-side CSV parsing library for the data upload workflow |

---

## Blockchain & Smart Contracts

| Reference | Usage |
|-----------|-------|
| [Solidity 0.8.20](https://docs.soliditylang.org/) — Ethereum Foundation | Smart contract programming language |
| [OpenZeppelin Contracts v5](https://docs.openzeppelin.com/contracts/5.x/) | Audited base contracts: `ERC1155`, `AccessControl`, `Pausable`, `ERC1155Burnable` |
| [Foundry](https://github.com/foundry-rs/foundry) — Paradigm | Smart contract compile, test, and deploy toolkit (`forge test`) |
| [EIP-1155: Multi-Token Standard](https://eips.ethereum.org/EIPS/eip-1155) — Ethereum Foundation | Token standard used for scalable batch carbon credit minting |
| [Polygon PoS](https://polygon.technology/) | Target L2 blockchain network for prototype token deployment (Amoy testnet) |

---

## Standards & Protocols Referenced

| Reference | Context |
|-----------|---------|
| [IPMVP Option C (Whole Facility)](https://evo-world.org/en/products-services-mainmenu-en/protocols/ipmvp) — EVO (Efficiency Valuation Organization) | The baseline energy measurement and verification protocol underpinning the carbon calculation logic |
| [GHG Protocol: Corporate Standard](https://ghgprotocol.org/corporate-standard) — WRI/WBCSD | Scope 1/2/3 emissions accounting methodology |
| [SEAI Grid Emission Factor](https://www.seai.ie/) — Sustainable Energy Authority of Ireland | Irish grid emission factor (0.2241 kg CO₂e/kWh, 2025) hardcoded in the frontend dropdown |
| [DEFRA Greenhouse Gas Reporting Factors](https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting) — UK Government | UK grid emission factor (0.1280 kg CO₂e/kWh, 2025) hardcoded in the frontend dropdown |
| [EIP-712: Typed Structured Data Signing](https://eips.ethereum.org/EIPS/eip-712) — Ethereum Foundation | Referenced in the security audit as the required production authentication pattern |
| [Sign-In With Ethereum (SIWE) — EIP-4361](https://eips.ethereum.org/EIPS/eip-4361) | Referenced as the recommended replacement for the prototype's hardcoded role-claim endpoint |
| [MerkleTree.js](https://github.com/merkletreejs/merkletreejs) — merkletreejs | Merkle tree library referenced for the data-integrity hashing layer on CSV imports |

---

## Security Methodology

| Reference | Usage |
|-----------|-------|
| [OWASP Risk Rating Methodology](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology) — OWASP Foundation | Risk scoring framework used to rank all vulnerabilities in `docs/security.md` |
| [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/) — OWASP Foundation | Cross-referenced against the security audit findings (A01 Broken Access Control, A02 Cryptographic Failures, A05 Security Misconfiguration, etc.) |
| [helmet.js](https://helmetjs.github.io/) | Referenced as the recommended HTTP security headers middleware for production |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | Referenced as the recommended rate-limiting solution for production |

---

## Ecosystem Tools Referenced (Not Integrated)

| Reference | Context |
|-----------|---------|
| [Hedera Guardian](https://github.com/hashgraph/guardian) — Hashgraph | Open-source dMRV policy-as-code engine; cited as a possible integration path for production |
| [Thallo](https://www.thallo.io) | Verra-compliant registry bridging infrastructure; cited as a possible integration path for production |
| [Chainlink Data Feeds](https://docs.chain.link/data-feeds) | Referenced in the production architecture for tamper-proof weather/emission factor oracles |
| [Circom / Groth16 ZK-SNARKs](https://docs.circom.io/) | Referenced in the production architecture for Zero-Knowledge proof of IPMVP calculation correctness |
| [Hyperledger Fabric](https://www.hyperledger.org/projects/fabric) | Referenced in the production architecture as the permissioned VVB audit chain |
| [IPFS / Arweave](https://ipfs.tech/) | Referenced in the production architecture for immutable off-chain evidence storage |
| [Gnosis Safe](https://safe.global/) | Referenced in the security audit as the recommended multi-sig wallet for the Admin minting role |
